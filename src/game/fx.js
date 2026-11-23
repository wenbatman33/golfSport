// 擊球特效：粒子（草屑、沙、水花、彩帶、火花）、衝擊波、閃光、帶狀球尾跡；以及合成音效
import * as THREE from 'three';

const MAX = 900;

export class Fx {
  constructor(scene) {
    // —— 粒子（自訂 shader：每顆有自己的大小與透明度）——
    this.n = 0;
    this.p = new Float32Array(MAX * 3); this.v = new Float32Array(MAX * 3); this.c = new Float32Array(MAX * 3);
    this.a = new Float32Array(MAX); this.s = new Float32Array(MAX);
    this.life = new Float32Array(MAX); this.max = new Float32Array(MAX); this.grav = new Float32Array(MAX); this.drag = new Float32Array(MAX); this.size0 = new Float32Array(MAX);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.a, 1));
    g.setAttribute('size', new THREE.BufferAttribute(this.s, 1));
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { scale: { value: 600 } },
      vertexShader: 'attribute float alpha; attribute float size; attribute vec3 color; varying float vA; varying vec3 vC; uniform float scale; void main(){ vA=alpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying float vA; varying vec3 vC; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard; gl_FragColor=vec4(vC, vA*smoothstep(0.5,0.25,r)); }',
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);

    // —— 衝擊波與閃光 ——
    this.rings = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      m.visible = false; m.userData = { t: 0, dur: 0.4, r: 3 };
      scene.add(m); this.rings.push(m);
    }
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff7c8', transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.flash.visible = false; this.flashT = 0;
    scene.add(this.flash);

    // —— 擊球光柱 ——
    this.beamM = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.16, 40, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.beamM.visible = false; this.beamT = 0;
    scene.add(this.beamM);

    // —— 帶狀球尾跡（面向鏡頭的三角帶）——
    this.TN = 90;
    this.tPts = []; // { p: Vector3, t: 存活秒數 }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.TN * 2 * 3), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.TN * 2 * 4), 4));
    const ix = [];
    for (let i = 0; i < this.TN - 1; i++) ix.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    tg.setIndex(ix);
    this.trail = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.trail.frustumCulled = false;
    this.trailColor = new THREE.Color('#ffffff'); this.trailColor2 = new THREE.Color('#8fd3ff');
    scene.add(this.trail);
    this.shake = 0;
  }

  emit(pos, opt) {
    const { count = 20, speed = 3, up = 3, spread = 1, gravity = 9, drag = 1.2, life = 0.8, size = 0.12, colors = ['#ffffff'], dir = null } = opt;
    const col = new THREE.Color();
    for (let k = 0; k < count; k++) {
      const i = this.n % MAX; this.n++;
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      this.p[i * 3] = pos.x + Math.cos(a) * r * 0.15; this.p[i * 3 + 1] = pos.y + Math.random() * 0.05; this.p[i * 3 + 2] = pos.z + Math.sin(a) * r * 0.15;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.v[i * 3] = Math.cos(a) * sp * spread + (dir ? dir.x * speed : 0);
      this.v[i * 3 + 1] = up * (0.5 + Math.random() * 0.8);
      this.v[i * 3 + 2] = Math.sin(a) * sp * spread + (dir ? dir.z * speed : 0);
      col.set(colors[Math.floor(Math.random() * colors.length)]);
      this.c[i * 3] = col.r; this.c[i * 3 + 1] = col.g; this.c[i * 3 + 2] = col.b;
      this.life[i] = this.max[i] = life * (0.6 + Math.random() * 0.7);
      this.grav[i] = gravity; this.drag[i] = drag; this.size0[i] = size * (0.6 + Math.random() * 0.8);
    }
  }

  ring(pos, normalUp = true, r = 3, dur = 0.4, color = '#ffffff') {
    const m = this.rings.find((x) => !x.visible) || this.rings[0];
    m.position.copy(pos); m.position.y += 0.06;
    if (normalUp) m.rotation.set(-Math.PI / 2, 0, 0);
    m.material.color.set(color);
    m.userData.t = 0; m.userData.dur = dur; m.userData.r = r; m.visible = true;
  }
  beam(pos, color = '#ffe9a0', width = 1) { this.beamM.position.set(pos.x, pos.y + 20, pos.z); this.beamM.material.color.set(color); this.beamM.userData.w = width; this.beamT = 0.6; this.beamM.visible = true; }
  burst(pos, size = 0.9) { this.flash.position.copy(pos); this.flash.userData.size = size; this.flashT = 0.16; this.flash.visible = true; }

  // —— 各種情境 ——
  impact(pos, dir, quality, surf) { // 擊球瞬間
    this.burst(pos, quality === 'perfect' ? 1.3 : 0.8);
    if (quality === 'perfect') this.beam(pos, '#ffe08a', 1.2); else if (quality === 'nice') this.beam(pos, '#ffffff', 0.55);
    this.ring(pos, true, quality === 'perfect' ? 4.5 : 2.6, 0.35, quality === 'perfect' ? '#ffd92e' : '#ffffff');
    const turf = surf === 'bunker' ? ['#f1dfa6', '#e2cc8a'] : ['#4f9a3a', '#6bbf4c', '#7a5a3a'];
    this.emit(pos, { count: surf === 'bunker' ? 46 : 26, speed: 2.4, up: 3.4, spread: 0.7, life: 0.7, size: 0.1, colors: turf, dir });
    if (quality === 'perfect') this.emit(pos, { count: 30, speed: 5, up: 2.5, spread: 1, gravity: 2, life: 0.5, size: 0.14, colors: ['#ffd92e', '#fff3b0', '#ff8a3c'] });
    this.shake = quality === 'perfect' ? 0.22 : 0.1;
    this.trailColor.set(quality === 'perfect' ? '#fff0a0' : '#ffffff');
    this.trailColor2.set(quality === 'perfect' ? '#ff7a1f' : '#8fd3ff');
  }
  land(pos, surf, power = 1) { // 落地
    const k = Math.min(1.6, 0.4 + power);
    if (surf === 'bunker') this.emit(pos, { count: Math.round(40 * k), speed: 2.6, up: 4, life: 0.8, size: 0.11, colors: ['#f1dfa6', '#e8d090', '#fff3cf'] });
    else if (surf === 'green' || surf === 'fringe') this.emit(pos, { count: Math.round(10 * k), speed: 1.2, up: 1.4, life: 0.4, size: 0.07, colors: ['#bff09a', '#8fe06a'] });
    else this.emit(pos, { count: Math.round(22 * k), speed: 2, up: 2.8, life: 0.6, size: 0.09, colors: ['#4f9a3a', '#6bbf4c', '#8a6a45'] });
    this.ring(pos, true, 1.2 * k, 0.3, '#ffffff');
  }
  splash(pos, lava = false) { // 落水（或掉進熔岩）
    this.emit(pos, { count: 70, speed: 2.2, up: 7, spread: 0.6, gravity: 12, life: 1.0, size: 0.14, colors: lava ? ['#ff5a1a', '#ffd23a', '#ff8a3c'] : ['#ffffff', '#bfe6ff', '#7cc4f5'] });
    this.ring(pos, true, 4, 0.7, lava ? '#ff8a3c' : '#dff3ff'); this.ring(pos, true, 2.2, 0.45, lava ? '#ffd23a' : '#ffffff');
  }
  cupIn(pos) { // 進洞
    this.burst(pos, 0.7);
    this.ring(pos, true, 2.4, 0.5, '#ffd92e');
    this.emit(pos, { count: 40, speed: 1.6, up: 5, spread: 0.5, gravity: 5, life: 1.1, size: 0.09, colors: ['#ffd92e', '#fff3b0', '#ffffff'] });
  }
  confetti(pos) { // 慶祝彩帶
    const p = pos.clone(); p.y += 2.6;
    this.emit(p, { count: 160, speed: 3.2, up: 4.5, spread: 1, gravity: 3.2, drag: 2.2, life: 2.6, size: 0.12, colors: ['#ff3b30', '#ffd92e', '#34c8ff', '#7be07a', '#ff7ad1', '#ffffff'] });
  }

  resetTrail() { this.tPts.length = 0; }
  pushTrail(pos) { this.tPts.push({ p: pos.clone(), t: 0 }); if (this.tPts.length > this.TN) this.tPts.shift(); }

  update(dt, camera, viewH) {
    // 粒子
    const live = Math.min(this.n, MAX);
    for (let i = 0; i < live; i++) {
      if (this.life[i] <= 0) { this.a[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.v[i * 3] *= k; this.v[i * 3 + 2] *= k; this.v[i * 3 + 1] -= this.grav[i] * dt;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      const u = Math.max(0, this.life[i] / this.max[i]);
      this.a[i] = Math.min(1, u * 2.2); this.s[i] = this.size0[i] * (0.6 + 0.4 * u);
    }
    const ga = this.points.geometry.attributes;
    ga.position.needsUpdate = ga.color.needsUpdate = ga.alpha.needsUpdate = ga.size.needsUpdate = true;
    this.points.material.uniforms.scale.value = viewH / (2 * Math.tan((camera.fov * Math.PI) / 360));
    // 衝擊波
    for (const m of this.rings) {
      if (!m.visible) continue;
      m.userData.t += dt;
      const u = m.userData.t / m.userData.dur;
      if (u >= 1) { m.visible = false; continue; }
      m.scale.setScalar(0.2 + m.userData.r * (1 - (1 - u) * (1 - u)));
      m.material.opacity = 0.85 * (1 - u);
    }
    // 閃光
    if (this.flash.visible) {
      this.flashT -= dt;
      const u = Math.max(0, this.flashT / 0.16);
      this.flash.scale.setScalar((this.flash.userData.size || 1) * (1.4 - u * 0.6));
      this.flash.material.opacity = u * 0.9;
      if (this.flashT <= 0) this.flash.visible = false;
    }
    if (this.beamM.visible) {
      this.beamT -= dt;
      const u = Math.max(0, this.beamT / 0.6), w = (this.beamM.userData.w || 1) * (0.4 + u * 0.8);
      this.beamM.scale.set(w, 1, w); this.beamM.material.opacity = u * u * 0.85;
      if (this.beamT <= 0) this.beamM.visible = false;
    }
    this.shake = Math.max(0, this.shake - dt * 0.7);
    // 球尾跡
    const pos = this.trail.geometry.attributes.position.array, colr = this.trail.geometry.attributes.color.array;
    const n = this.tPts.length;
    const side = new THREE.Vector3(), tan = new THREE.Vector3(), toCam = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const cur = this.tPts[i];
      cur.t += dt;
      tan.subVectors(this.tPts[Math.min(n - 1, i + 1)].p, this.tPts[Math.max(0, i - 1)].p);
      toCam.subVectors(camera.position, cur.p);
      side.crossVectors(tan, toCam).normalize();
      const u = i / Math.max(1, n - 1); // 0 尾端 → 1 球
      const w = (0.02 + 0.0035 * toCam.length()) * u * u * Math.max(0, 1 - cur.t / 0.9); // 細長、越靠近尾端越細
      pos[i * 6] = cur.p.x + side.x * w; pos[i * 6 + 1] = cur.p.y + side.y * w; pos[i * 6 + 2] = cur.p.z + side.z * w;
      pos[i * 6 + 3] = cur.p.x - side.x * w; pos[i * 6 + 4] = cur.p.y - side.y * w; pos[i * 6 + 5] = cur.p.z - side.z * w;
      const cr = this.trailColor2.r + (this.trailColor.r - this.trailColor2.r) * u, cg = this.trailColor2.g + (this.trailColor.g - this.trailColor2.g) * u, cb = this.trailColor2.b + (this.trailColor.b - this.trailColor2.b) * u;
      const al = 0.85 * u * u * u * Math.max(0, 1 - cur.t / 0.9);
      for (const o of [0, 4]) { colr[i * 8 + o] = cr; colr[i * 8 + o + 1] = cg; colr[i * 8 + o + 2] = cb; colr[i * 8 + o + 3] = al; }
    }
    this.trail.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
    this.trail.geometry.attributes.position.needsUpdate = this.trail.geometry.attributes.color.needsUpdate = true;
  }
}

// —— 合成音效（Web Audio，不需要音檔）——
let ac = null, master = null, noiseBuf = null;
export let muted = false;
export function setMuted(v) { muted = v; if (master) master.gain.value = v ? 0 : 0.6; }
function ctx() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function noise(dur, f0, f1, gain, type = 'bandpass', q = 1, delay = 0) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay, src = a.createBufferSource(), flt = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuf; src.loop = true;
  flt.type = type; flt.Q.value = q; flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(master); src.start(t); src.stop(t + dur + 0.05);
}
function tone(freq, dur, gain, type = 'sine', delay = 0, slide = 0) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
export const sfx = {
  unlock: () => ctx(),
  tick: () => tone(880, 0.05, 0.12, 'square'),
  select: () => { tone(660, 0.07, 0.16, 'triangle'); tone(990, 0.1, 0.14, 'triangle', 0.06); },
  meterSet: () => tone(1320, 0.06, 0.14, 'square'),
  whoosh: () => noise(0.32, 300, 2600, 0.5, 'bandpass', 0.8),
  hit: (perfect) => { tone(180, 0.12, 0.7, 'sine', 0, 0.4); noise(0.06, 3000, 5000, 0.8, 'highpass'); tone(perfect ? 2400 : 1800, 0.09, 0.35, 'triangle'); if (perfect) { tone(1320, 0.3, 0.2, 'sine', 0.03); tone(1980, 0.4, 0.16, 'sine', 0.08); } },
  putt: () => { tone(1400, 0.04, 0.4, 'triangle'); tone(240, 0.06, 0.3, 'sine'); },
  bounce: (v = 1) => { tone(140, 0.1, Math.min(0.5, 0.2 * v), 'sine', 0, 0.5); noise(0.08, 900, 300, Math.min(0.3, 0.12 * v), 'lowpass'); },
  sand: () => noise(0.3, 2400, 500, 0.5, 'bandpass', 0.6),
  splash: () => { noise(0.7, 1800, 300, 0.7, 'lowpass'); tone(300, 0.25, 0.3, 'sine', 0, 0.3); },
  cup: () => { for (let i = 0; i < 4; i++) tone(700 + i * 90, 0.05, 0.3, 'square', i * 0.06); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 0.22, 'triangle', 0.3 + i * 0.1)); },
  cheer: () => { for (let i = 0; i < 6; i++) noise(0.5, 900 + Math.random() * 600, 1400, 0.16, 'bandpass', 0.5, i * 0.12); },
  bad: () => { tone(330, 0.2, 0.25, 'sawtooth', 0, 0.7); tone(220, 0.35, 0.25, 'sawtooth', 0.18, 0.7); },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, 0.22, 'triangle', i * 0.13)),
  lose: () => [392, 349, 311, 262].forEach((f, i) => tone(f, 0.45, 0.2, 'triangle', i * 0.2)),
};
