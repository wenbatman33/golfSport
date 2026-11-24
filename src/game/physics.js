// 高爾夫球物理：飛行（空氣阻力、升力、側旋、風）、彈跳、滾動（坡度與地表摩擦）、進洞判定
import * as THREE from 'three';

export const G = 9.81;
export const BALL_R = 0.0213;
// 可在 DEV 工具調整
export const PHYS = { drag: 0.003, lift: 0.0011, side: 0.00035, capR: 0.15, capV: 3.2, dt: 1 / 240 };
const ROLL = { green: 1.3, fringe: 2.4, fairway: 3.3, tee: 3.3, rough: 9, bunker: 16 }; // 滾動減速度 m/s²
const BOUNCE = { green: [0.28, 0.42], fringe: [0.32, 0.3], fairway: [0.36, 0.28], tee: [0.36, 0.28], rough: [0.18, 0.55], bunker: [0.03, 0.9] }; // [反彈係數, 切向損失]

const UP = new THREE.Vector3(0, 1, 0);
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vN = new THREE.Vector3();

// 單步飛行積分（回傳後 vel / pos 已更新）
function flyStep(pos, vel, wind, spinB, spinS, h) {
  vA.copy(vel).sub(wind);
  const sp = vA.length();
  vB.copy(vA).multiplyScalar(-PHYS.drag * sp); // 阻力
  vB.y -= G;
  const vs = vel.length();
  if (vs > 0.5) {
    vC.crossVectors(vel, UP); // 水平側向
    if (vC.lengthSq() > 1e-6) {
      vN.crossVectors(vC, vel).normalize(); // 垂直於速度、朝上
      vB.addScaledVector(vN, PHYS.lift * vs * vs * spinB);
      vC.normalize().negate(); // cross(UP, vel)
      vB.addScaledVector(vC, PHYS.side * vs * vs * spinS);
    }
  }
  vel.addScaledVector(vB, h);
  pos.addScaledVector(vel, h);
}

// 平地無風的落點距離，用來校準各球桿的出球速度
function carryOf(speed, loft) {
  const pos = new THREE.Vector3(0, BALL_R, 0), vel = new THREE.Vector3(0, Math.sin(loft) * speed, Math.cos(loft) * speed), wind = new THREE.Vector3();
  for (let i = 0; i < 6000; i++) {
    flyStep(pos, vel, wind, 1, 0, 1 / 120);
    if (pos.y <= BALL_R && vel.y < 0) break;
  }
  return pos.z;
}
export function solveSpeed(carry, loftDeg) {
  const loft = THREE.MathUtils.degToRad(loftDeg);
  let lo = 2, hi = 120;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (carryOf(m, loft) < carry) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// 預覽彈道（到第一次落地為止），回傳取樣點
export function previewFlight(start, dir, speed, loftDeg, hole, wind) {
  const loft = THREE.MathUtils.degToRad(loftDeg);
  const pos = start.clone(), vel = new THREE.Vector3(dir.x * Math.cos(loft) * speed, Math.sin(loft) * speed, dir.z * Math.cos(loft) * speed);
  const pts = [pos.clone()];
  for (let i = 0; i < 4000; i++) {
    flyStep(pos, vel, wind, 1, 0, 1 / 120);
    if (i % 8 === 0) pts.push(pos.clone());
    if (pos.y <= hole.heightAt(pos.x, pos.z) + BALL_R && vel.y < 0) break;
  }
  pos.y = hole.heightAt(pos.x, pos.z) + 0.05;
  pts.push(pos.clone());
  return pts;
}

export const puttSpeedFor = (dist) => Math.sqrt(2 * ROLL.green * dist);

export class Ball {
  constructor() {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.mode = 'rest'; // rest | fly | roll
    this.spinB = 1; this.spinS = 0; this.spinStat = 6;
    this.acc = 0;
    this.maxHeight = 0;
    this.carryPoint = null; // 第一次落地位置
  }
  place(p) { this.pos.copy(p); this.vel.set(0, 0, 0); this.mode = 'rest'; }
  launch(dir, speed, loftDeg, spinS, spinStat, spinMode = 0) { // spinMode：1 上旋、-1 後旋、0 一般
    this.spinMode = spinMode;
    const loft = THREE.MathUtils.degToRad(loftDeg);
    this.vel.set(dir.x * Math.cos(loft) * speed, Math.sin(loft) * speed, dir.z * Math.cos(loft) * speed);
    this.spinB = spinMode < 0 ? 1.18 : spinMode > 0 ? 0.86 : 1; this.spinS = spinS; this.spinStat = spinStat;
    this.mode = 'fly'; this.carryPoint = null; this.maxHeight = this.pos.y;
  }
  putt(dir, speed) {
    this.vel.set(dir.x * speed, 0, dir.z * speed);
    this.mode = 'roll'; this.carryPoint = null; this.spinMode = 0;
  }

  // 推進 dt 秒；回傳事件：null | 'stop' | 'water' | 'ob' | 'holed'
  update(dt, hole, wind) {
    if (this.mode === 'rest') return null;
    this.acc += Math.min(dt, 0.05);
    while (this.acc >= PHYS.dt) {
      this.acc -= PHYS.dt;
      const ev = this.step(PHYS.dt, hole, wind);
      if (ev) { this.acc = 0; this.mode = 'rest'; this.vel.set(0, 0, 0); return ev; }
    }
    return null;
  }

  // 樹幹、岩石反彈；樹冠、灌木把球擋下來（每個障礙物進去一次只算一次）
  collide(hole) {
    const obs = hole.obstacles; if (!obs) return;
    const p = this.pos, v = this.vel, roll = this.mode === 'roll';
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i], dx = p.x - o.x, dz = p.z - o.z, d2 = dx * dx + dz * dz;
      let rad = o.r;
      if (d2 > (rad + BALL_R) * (rad + BALL_R)) { if (this.inSoft === o) this.inSoft = null; continue; }
      if (o.kind === 'trunk') {
        if (p.y < o.y0 || p.y > o.y1) continue;
        vN.set(dx, 0, dz);
      } else if (o.kind === 'cone') {
        if (p.y < o.y0 || p.y > o.y1) { if (this.inSoft === o) this.inSoft = null; continue; }
        rad = o.r * (1 - (p.y - o.y0) / (o.y1 - o.y0));
        if (d2 > rad * rad) { if (this.inSoft === o) this.inSoft = null; continue; }
      } else {
        const dy = p.y - o.y;
        if (d2 + dy * dy > (rad + BALL_R) * (rad + BALL_R)) { if (this.inSoft === o) this.inSoft = null; continue; }
        vN.set(dx, roll ? 0 : dy, dz);
      }
      if (o.kind === 'cone' || o.soft) { // 枝葉：速度大減、往下掉
        if (this.inSoft === o) continue;
        this.inSoft = o;
        const sp = v.length();
        if (sp < 1.5) continue;
        v.multiplyScalar(o.kind === 'cone' ? 0.32 : 0.28);
        if (!roll) v.y = Math.min(v.y, 0) - 0.6;
        this.spinS = 0; this.spinB = 1;
        this.onHit?.('leaf', sp, p);
        continue;
      }
      const len = vN.length(); if (len < 1e-5) continue;
      vN.multiplyScalar(1 / len);
      const vn = v.dot(vN);
      // 推到表面外，避免卡在裡面
      const push = rad + BALL_R - len;
      if (push > 0) p.addScaledVector(vN, push);
      if (vn >= 0) continue;
      const sp = v.length(), e = o.kind === 'trunk' ? 0.45 : 0.55;
      v.addScaledVector(vN, -(1 + e) * vn);
      const vn2 = v.dot(vN);
      vA.copy(vN).multiplyScalar(vn2);
      v.sub(vA).multiplyScalar(0.8).add(vA); // 切向也損失一些
      if (roll) v.y = 0;
      this.spinS = 0; this.spinB = 1;
      this.onHit?.(o.kind === 'trunk' ? 'wood' : 'rock', sp, p);
    }
  }

  step(h, hole, wind) {
    const ev = this.stepCore(h, hole, wind);
    if (!ev && this.mode !== 'rest') this.collide(hole);
    return ev;
  }
  stepCore(h, hole, wind) {
    const p = this.pos, v = this.vel;
    // 進洞判定
    const dx = p.x - hole.pin.x, dz = p.z - hole.pin.z;
    if (dx * dx + dz * dz < PHYS.capR * PHYS.capR && p.y - hole.pin.y < 0.2 && v.length() < PHYS.capV) return 'holed';

    if (this.mode === 'fly') {
      flyStep(p, v, wind, this.spinB, this.spinS, h);
      this.maxHeight = Math.max(this.maxHeight, p.y);
      const gnd = hole.heightAt(p.x, p.z);
      if (p.y <= gnd + BALL_R) {
        const s = hole.surfaceAt(p.x, p.z);
        if (s === 'water' || s === 'ob') return s;
        if (!this.carryPoint) this.carryPoint = p.clone();
        this.onBounce?.(s, v.length(), p);
        p.y = gnd + BALL_R;
        hole.normalAt(p.x, p.z, vN);
        const vn = v.dot(vN);
        if (vn < 0) {
          const [e, lossBase] = BOUNCE[s];
          let loss = s === 'green' ? Math.min(0.9, lossBase + 0.04 * this.spinStat) : lossBase; // 旋球能力讓球在果嶺上更快停住
          if (this.spinMode > 0) loss *= 0.5; // 上旋：落地後繼續往前滾
          else if (this.spinMode < 0) loss = Math.min(0.96, loss + 0.32 + 0.02 * this.spinStat); // 後旋：落地後很快停住
          if (-vn < 1.1) { v.addScaledVector(vN, -vn); v.y = 0; this.mode = 'roll'; }
          else {
            v.addScaledVector(vN, -(1 + e) * vn);
            const vn2 = v.dot(vN);
            vA.copy(vN).multiplyScalar(vn2); // 法向分量
            v.sub(vA).multiplyScalar(1 - loss).add(vA);
          }
          this.spinS = 0;
        }
      }
      if (p.y < hole.seaLevel - 1) return 'ob';
      return null;
    }

    // 滾動
    const s = hole.surfaceAt(p.x, p.z);
    if (s === 'water' || s === 'ob') return s;
    const g = hole.gradAt(p.x, p.z);
    const dec = (ROLL[s] ?? 3.3) * (this.spinMode > 0 ? 0.72 : this.spinMode < 0 ? 1.7 : 1);
    const ax = -G * g.x, az = -G * g.z;
    const sp = Math.hypot(v.x, v.z);
    if (sp < 0.06 && Math.hypot(ax, az) < dec * 0.7) return 'stop';
    v.x += ax * h; v.z += az * h;
    const sp2 = Math.hypot(v.x, v.z);
    if (sp2 > 1e-5) { const k = Math.max(0, sp2 - dec * h) / sp2; v.x *= k; v.z *= k; }
    v.y = 0;
    p.x += v.x * h; p.z += v.z * h;
    p.y = hole.heightAt(p.x, p.z) + BALL_R;
    return null;
  }
}
