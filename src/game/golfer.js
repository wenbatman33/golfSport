// 球員：載入角色 GLB（Mixamo 骨架），以程式化姿勢做揮桿／推桿／慶祝／沮喪
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const D2R = Math.PI / 180;
const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

// 模型座標：+X = 球員左手邊（揮桿時朝向目標）、+Y 上、+Z 球員正面
// eul：以「靜止姿勢的模型軸」旋轉（度，套用順序 Y→X→Z），會跟著父骨頭走
// dir：[x,y,z,參考骨頭] 骨頭要指向的方向（在參考骨頭帶著走的座標裡；'root' = 模型座標）
const LEAN = { Hips: [6, 0, 0], Spine: [14, 0, 0], Spine1: [10, 0, 0], Spine2: [8, 0, 0], Head: [10, 0, 0] };
const LEGS = {
  LeftUpLeg: [0.07, -0.96, 0.24, 'root'], LeftLeg: [0.03, -0.97, -0.2, 'root'],
  RightUpLeg: [-0.07, -0.96, 0.24, 'root'], RightLeg: [-0.03, -0.97, -0.2, 'root'],
};
// 手指彎曲的軸與方向（Mixamo 骨架：手指骨頭的局部座標）
const FIST_AXIS = new THREE.Vector3(0, 0, 1), FIST_SIGN = -1;

export const POSES = {
  address: {
    eul: LEAN,
    dir: { ...LEGS, LeftArm: [-0.26, -0.9, 0.34, 'root'], LeftForeArm: [-0.26, -0.9, 0.34, 'root'], RightArm: [0.26, -0.9, 0.34, 'root'], RightForeArm: [0.26, -0.9, 0.34, 'root'] },
    flat: ['LeftFoot', 'RightFoot'],
  },
  top: {
    eul: { Hips: [6, -35, 0], Spine: [14, -18, 0], Spine1: [10, -18, 0], Spine2: [8, -14, 0], Neck: [0, 40, 0], Head: [10, 35, 0] },
    dir: { ...LEGS, LeftLeg: [-0.1, -0.97, -0.2, 'root'], LeftArm: [-0.75, 0.55, 0.36, 'Spine2'], LeftForeArm: [-0.75, 0.55, 0.36, 'Spine2'], RightArm: [-0.75, -0.35, 0.5, 'Spine2'], RightForeArm: [0.24, 0.93, 0.26, 'Spine2'] },
    flat: ['LeftFoot', 'RightFoot'],
  },
  impact: {
    eul: { Hips: [6, 30, 0], Spine: [14, -8, 0], Spine1: [10, -6, 0], Spine2: [8, -6, 0], Neck: [0, -8, 0], Head: [10, -6, 0] },
    dir: { ...LEGS, LeftArm: [-0.2, -0.9, 0.36, 'root'], LeftForeArm: [-0.2, -0.9, 0.36, 'root'], RightArm: [0.3, -0.88, 0.36, 'root'], RightForeArm: [0.3, -0.88, 0.36, 'root'] },
    flat: ['LeftFoot', 'RightFoot'],
  },
  finish: {
    eul: { Hips: [0, 80, 0], Spine: [-4, 12, 0], Spine1: [0, 12, 0], Spine2: [0, 10, 0] },
    dir: {
      LeftUpLeg: [0.05, -0.99, 0.05, 'root'], LeftLeg: [0.02, -1, 0, 'root'],
      RightUpLeg: [0.35, -0.92, 0.15, 'root'], RightLeg: [-0.25, -0.85, -0.45, 'root'], RightFoot: [0.3, -0.9, 0.3, 'root'],
      RightArm: [0.7, 0.6, 0.38, 'Spine2'], RightForeArm: [0.5, 0.8, -0.2, 'Spine2'], LeftArm: [0.7, -0.1, 0.5, 'Spine2'], LeftForeArm: [-0.1, 0.95, -0.25, 'Spine2'],
    },
    flat: ['LeftFoot'],
  },
  // 推桿
  puttAddress: {
    eul: { Hips: [8, 0, 0], Spine: [18, 0, 0], Spine1: [12, 0, 0], Spine2: [10, 0, 0], Head: [14, 0, 0] },
    dir: { ...LEGS, LeftArm: [-0.27, -0.95, 0.14, 'root'], LeftForeArm: [-0.27, -0.95, 0.14, 'root'], RightArm: [0.27, -0.95, 0.14, 'root'], RightForeArm: [0.27, -0.95, 0.14, 'root'] },
    flat: ['LeftFoot', 'RightFoot'],
  },
  puttBack: {
    eul: { Hips: [8, 0, 0], Spine: [18, 0, 0], Spine1: [12, 0, -9], Spine2: [10, 0, -7], Head: [14, 0, 12] },
    dir: { ...LEGS, LeftArm: [-0.37, -0.95, 0.14, 'root'], LeftForeArm: [-0.37, -0.95, 0.14, 'root'], RightArm: [0.17, -0.95, 0.14, 'root'], RightForeArm: [0.17, -0.95, 0.14, 'root'] },
    flat: ['LeftFoot', 'RightFoot'],
  },
  puttThrough: {
    eul: { Hips: [8, 0, 0], Spine: [18, 0, 0], Spine1: [12, 0, 11], Spine2: [10, 0, 9], Head: [14, 0, -14] },
    dir: { ...LEGS, LeftArm: [-0.15, -0.95, 0.14, 'root'], LeftForeArm: [-0.15, -0.95, 0.14, 'root'], RightArm: [0.39, -0.95, 0.14, 'root'], RightForeArm: [0.39, -0.95, 0.14, 'root'] },
    flat: ['LeftFoot', 'RightFoot'],
  },
  // 情緒
  stand: {
    eul: {},
    dir: { LeftArm: [0.3, -0.94, 0.08, 'Spine2'], LeftForeArm: [0.2, -0.96, 0.18, 'Spine2'], RightArm: [-0.3, -0.94, 0.08, 'Spine2'], RightForeArm: [-0.2, -0.96, 0.18, 'Spine2'] },
    flat: [],
  },
  // 進球後的振臂打氣：右手握拳舉起（A）再用力往下收（B），來回幾下；雙腳不離地
  cheerA: {
    eul: { Spine1: [-4, 4, 0], Head: [-8, 0, 0] },
    fist: ['Right', 'Left'],
    dir: { RightShoulder: [-0.94, 0.3, 0.05, 'Spine2'], RightArm: [-0.55, 0.62, 0.55, 'Spine2'], RightForeArm: [-0.1, 0.98, 0.15, 'Spine2'], LeftArm: [0.3, -0.92, 0.12, 'Spine2'], LeftForeArm: [0.22, -0.7, 0.68, 'Spine2'] },
    flat: [],
  },
  cheerB: {
    eul: { Spine1: [5, -6, 0], Head: [4, 0, 0] },
    fist: ['Right', 'Left'],
    dir: { RightArm: [-0.42, -0.56, 0.71, 'Spine2'], RightForeArm: [-0.05, 0.94, 0.33, 'Spine2'], LeftArm: [0.3, -0.92, 0.12, 'Spine2'], LeftForeArm: [0.22, -0.62, 0.75, 'Spine2'] },
    flat: [],
  },
  // —— 待機手勢（選角畫面）：每組 A／B 兩個姿勢來回擺動 ——
  waveA: { eul: { Head: [0, 0, -5] }, dir: { RightShoulder: [-0.94, 0.3, 0.05, 'Spine2'], RightArm: [-0.86, 0.3, 0.3, 'Spine2'], RightForeArm: [-0.15, 0.98, 0.15, 'Spine2'], LeftArm: [0.3, -0.94, 0.08, 'Spine2'], LeftForeArm: [0.2, -0.96, 0.18, 'Spine2'] }, flat: [] },
  waveB: { eul: { Head: [0, 0, -5] }, dir: { RightShoulder: [-0.94, 0.3, 0.05, 'Spine2'], RightArm: [-0.86, 0.3, 0.3, 'Spine2'], RightForeArm: [-0.6, 0.78, 0.15, 'Spine2'], LeftArm: [0.3, -0.94, 0.08, 'Spine2'], LeftForeArm: [0.2, -0.96, 0.18, 'Spine2'] }, flat: [] },
  scratchA: { eul: { Head: [8, 0, 8], Spine2: [0, 0, 3] }, dir: { RightShoulder: [-0.9, 0.4, 0.15, 'Spine2'], RightArm: [-0.8, 0.15, 0.58, 'Spine2'], RightForeArm: [0.65, 0.72, -0.25, 'Spine2'], LeftArm: [0.3, -0.94, 0.08, 'Spine2'], LeftForeArm: [0.2, -0.96, 0.18, 'Spine2'] }, flat: [] },
  scratchB: { eul: { Head: [10, 0, 10], Spine2: [0, 0, 3] }, dir: { RightShoulder: [-0.9, 0.4, 0.15, 'Spine2'], RightArm: [-0.8, 0.2, 0.56, 'Spine2'], RightForeArm: [0.58, 0.76, -0.3, 'Spine2'], LeftArm: [0.3, -0.94, 0.08, 'Spine2'], LeftForeArm: [0.2, -0.96, 0.18, 'Spine2'] }, flat: [] },
  hipsA: { eul: { Spine1: [0, 10, 0], Head: [0, 14, 0] }, dir: { LeftArm: [0.78, -0.6, -0.15, 'Spine2'], LeftForeArm: [-0.5, -0.6, 0.55, 'Spine2'], RightArm: [-0.78, -0.6, -0.15, 'Spine2'], RightForeArm: [0.5, -0.6, 0.55, 'Spine2'] }, flat: [] },
  hipsB: { eul: { Spine1: [0, -10, 0], Head: [0, -14, 0] }, dir: { LeftArm: [0.78, -0.6, -0.15, 'Spine2'], LeftForeArm: [-0.5, -0.6, 0.55, 'Spine2'], RightArm: [-0.78, -0.6, -0.15, 'Spine2'], RightForeArm: [0.5, -0.6, 0.55, 'Spine2'] }, flat: [] },
  stretchA: { eul: { Spine1: [0, 12, 0], Head: [0, 8, 0] }, dir: { RightArm: [0.82, 0.02, 0.57, 'Spine2'], RightForeArm: [0.95, 0.05, 0.3, 'Spine2'], LeftArm: [0.25, -0.62, 0.74, 'Spine2'], LeftForeArm: [-0.6, 0.35, 0.72, 'Spine2'] }, flat: [] },
  stretchB: { eul: { Spine1: [0, 18, 0], Head: [0, 12, 0] }, dir: { RightArm: [0.88, 0.02, 0.47, 'Spine2'], RightForeArm: [0.98, 0.05, 0.18, 'Spine2'], LeftArm: [0.3, -0.6, 0.74, 'Spine2'], LeftForeArm: [-0.55, 0.38, 0.74, 'Spine2'] }, flat: [] },
  thinkA: { eul: { Head: [6, -8, 0] }, dir: { RightArm: [-0.05, -0.92, 0.38, 'Spine2'], RightForeArm: [0.35, 0.72, 0.6, 'Spine2'], LeftArm: [0.15, -0.85, 0.5, 'Spine2'], LeftForeArm: [-0.92, 0.05, 0.38, 'Spine2'] }, flat: [] },
  thinkB: { eul: { Head: [2, 10, 4] }, dir: { RightArm: [-0.05, -0.92, 0.38, 'Spine2'], RightForeArm: [0.3, 0.75, 0.6, 'Spine2'], LeftArm: [0.15, -0.85, 0.5, 'Spine2'], LeftForeArm: [-0.92, 0.05, 0.38, 'Spine2'] }, flat: [] },
  sad: {
    eul: { Spine: [12, 0, 0], Spine1: [10, 0, 0], Spine2: [8, 0, 0], Neck: [14, 0, 0], Head: [22, 0, 0] },
    dir: { LeftArm: [0.26, -0.94, 0.2, 'Spine2'], LeftForeArm: [0.16, -0.95, 0.27, 'Spine2'], RightArm: [-0.26, -0.94, 0.2, 'Spine2'], RightForeArm: [-0.16, -0.95, 0.27, 'Spine2'] },
    flat: [],
  },
};

// 球桿方向關鍵格（球員座標，s = 揮桿進度 0 站位 → 1 上桿頂點 → 2 擊球 → 3 收桿）
const CLUB_KEYS = [
  [0, V(0.02, -0.8, 0.6)], [0.45, V(-0.9, 0, 0.44)], [0.8, V(-0.15, 0.98, -0.1)], [1, V(0.9, 0.05, -0.42)],
  [1.5, V(-0.15, 0.9, -0.4)], [1.8, V(-0.9, -0.1, 0.4)], [2, V(0.04, -0.8, 0.6)], [2.3, V(0.9, 0, 0.44)], [2.7, V(0.2, 0.95, -0.25)], [3, V(-0.75, -0.25, -0.6)],
];
const PUTT_KEYS = [[0, V(0, -0.93, 0.36)], [1, V(-0.16, -0.92, 0.36)], [2, V(0, -0.93, 0.36)], [3, V(0.2, -0.91, 0.36)]];

const CHILD = { LeftShoulder: 'LeftArm', RightShoulder: 'RightArm', LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', RightArm: 'RightForeArm', RightForeArm: 'RightHand', LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', LeftFoot: 'LeftToeBase', RightFoot: 'RightToeBase' };
const smooth = (t) => t * t * (3 - 2 * t);

export class Golfer {
  constructor() {
    this.root = new THREE.Group(); // 位置與朝向
    this.bones = {};
    this.rest = {}; // name → { local, world, parentWorld, dir }
    this.poseQ = {}; // poseName → { boneName: Quaternion(local) }
    this.height = 1.75;
    this.hasRig = false;
    this.club = this.makeClub();
    this.root.add(this.club);
    this.emote = null; this.emoteT = 0;
    this.swingS = 0; this.putt = false;
  }

  makeClub() {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 1, 8), new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.8, roughness: 0.3 }));
    shaft.geometry.translate(0, -0.5, 0); // 握把在原點，往 -Y 延伸
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.26, 8), new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.9 }));
    grip.position.y = -0.05;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.085), new THREE.MeshStandardMaterial({ color: '#2a2f3a', metalness: 0.6, roughness: 0.35 }));
    head.position.set(0.035, -1.0, 0);
    shaft.castShadow = head.castShadow = true;
    g.add(shaft, grip, head);
    g.userData = { shaft, head };
    return g;
  }

  async load(character) {
    this.height = character.height;
    const url = `${import.meta.env.BASE_URL}models/characters/${character.id}.glb`;
    let model = null;
    try {
      const r = await fetch(url, { method: 'HEAD' });
      if (r.ok && !(r.headers.get('content-type') || '').includes('text/html')) model = (await loader.loadAsync(url)).scene;
    } catch (e) { console.warn('角色模型載入失敗，改用替身', e); }
    if (!model) { this.buildDummy(character); return; }

    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; for (const m of [].concat(o.material)) m.side = THREE.DoubleSide; } }); // 雙面渲染，腋下等處撐開時不會透出背景
    let box = new THREE.Box3().setFromObject(model);
    model.scale.multiplyScalar(this.height / (box.getSize(new THREE.Vector3()).y || 1));
    box = new THREE.Box3().setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box.min.y;
    this.model = model;
    this.root.add(model);
    model.updateMatrixWorld(true);

    model.traverse((o) => { if (o.isBone) this.bones[o.name.replace(/^mixamorig:?/, '')] = o; });
    this.hasRig = !!(this.bones.Hips && this.bones.LeftArm && this.bones.Spine2);
    if (!this.hasRig) return;
    // 記錄靜止姿勢（此時 root 尚未旋轉，world = 模型座標）
    const wp = new THREE.Vector3(), wc = new THREE.Vector3();
    for (const [name, b] of Object.entries(this.bones)) {
      const rec = { local: b.quaternion.clone(), world: b.getWorldQuaternion(new THREE.Quaternion()), parentWorld: b.parent.getWorldQuaternion(new THREE.Quaternion()) };
      const child = this.bones[CHILD[name]];
      if (child) rec.dir = child.getWorldPosition(wc).sub(b.getWorldPosition(wp)).normalize().clone();
      this.rest[name] = rec;
    }
    for (const [name, spec] of Object.entries(POSES)) this.poseQ[name] = this.solvePose(spec);
    this.applyBlend('stand', 'stand', 0);
  }

  buildDummy(character) {
    const mat = new THREE.MeshStandardMaterial({ color: character.color, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, this.height - 0.75, 6, 12), mat);
    body.position.y = (this.height - 0.3) / 2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshStandardMaterial({ color: '#f2c9a5', roughness: 0.7 }));
    head.position.y = this.height - 0.16;
    body.castShadow = head.castShadow = true;
    this.model = new THREE.Group();
    this.model.add(body, head);
    this.root.add(this.model);
  }

  // 把姿勢規格解成每根骨頭的 local quaternion
  solvePose(spec) {
    const D = {}; // 骨頭相對靜止姿勢的模型空間旋轉
    const ident = new THREE.Quaternion();
    const getD = (name) => {
      if (name === 'root' || !this.bones[name]) return ident;
      if (D[name]) return D[name];
      const b = this.bones[name];
      const pName = b.parent.isBone ? b.parent.name.replace(/^mixamorig:?/, '') : null;
      const Dp = pName ? getD(pName) : ident;
      let d = Dp;
      const e = spec.eul?.[name], dr = spec.dir?.[name];
      if (e) d = Dp.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0] * D2R, e[1] * D2R, e[2] * D2R, 'YXZ')));
      else if (dr && this.rest[name].dir) {
        const target = new THREE.Vector3(dr[0], dr[1], dr[2]).normalize().applyQuaternion(getD(dr[3]));
        const cur = this.rest[name].dir.clone().applyQuaternion(Dp);
        d = new THREE.Quaternion().setFromUnitVectors(cur, target).multiply(Dp);
        // 手臂自然下垂時把上臂內旋，手掌才會朝向身體而不是朝前（模型原始站姿是掌心向前）
        // 上臂只轉一點（轉太多肩膀會被擰細），其餘交給前臂
        const side = name.startsWith('Left') ? 1 : -1, down = target.y < -0.7;
        const tw = spec.twist?.[name] ?? (down && /^(Left|Right)Arm$/.test(name) ? 22 * side : down && /ForeArm$/.test(name) ? 52 * side : 0);
        if (tw) d = new THREE.Quaternion().setFromAxisAngle(target, tw * D2R).multiply(d);
      } else if (spec.flat?.includes(name)) d = ident; // 腳掌保持貼地
      D[name] = d;
      return d;
    };
    const out = {};
    for (const name of Object.keys(this.bones)) {
      const b = this.bones[name], r = this.rest[name];
      const pName = b.parent.isBone ? b.parent.name.replace(/^mixamorig:?/, '') : null;
      const Dp = pName ? getD(pName) : ident;
      const d = getD(name);
      // L = (Dp * Wp_rest)^-1 * d * W_rest
      out[name] = Dp.clone().multiply(r.parentWorld).invert().multiply(d).multiply(r.world);
    }
    // 握拳：把指定那隻手的四指每一節往掌心捲（繞手指骨頭自己的軸轉）
    if (spec.fist) for (const name of Object.keys(out)) {
      const m = /^(Left|Right)Hand(Index|Middle|Ring|Pinky)[123]$/.exec(name);
      if (m && spec.fist.includes(m[1])) out[name] = out[name].clone().multiply(new THREE.Quaternion().setFromAxisAngle(FIST_AXIS, (m[1] === 'Right' ? FIST_SIGN : -FIST_SIGN) * 1.3));
    }
    return out;
  }

  applyBlend(a, b, t) {
    if (!this.hasRig) return;
    const A = this.poseQ[a], B = this.poseQ[b];
    for (const name of Object.keys(this.bones)) this.bones[name].quaternion.slerpQuaternions(A[name], B[name], t);
  }

  // 站到球旁：aim 為水平單位向量（擊球方向）
  place(ballPos, aim, putt, groundAt = null) {
    this.putt = putt;
    const th = Math.atan2(-aim.z, aim.x); // 讓模型 +X 指向目標
    this.root.rotation.set(0, th, 0);
    const k = this.height / 1.75;
    const off = new THREE.Vector3(putt ? 0.02 : 0.06, 0, (putt ? 0.55 : 0.9) * k).applyAxisAngle(new THREE.Vector3(0, 1, 0), th);
    const gx = ballPos.x - off.x, gz = ballPos.z - off.z;
    // 依腳下的實際地面高度站立（沙坑是碗狀，不能用球的高度）
    this.root.position.set(gx, groundAt ? groundAt(gx, gz) + 0.045 : ballPos.y - 0.02, gz);
    this.club.userData.shaft.scale.y = this.club.userData.head.position.y = 1;
    const L = (putt ? 0.86 : 1.06) * k;
    this.club.userData.shaft.scale.y = L;
    this.club.userData.head.position.y = -L;
    this.club.userData.head.scale.set(putt ? 0.9 : 1, putt ? 0.45 : 1, putt ? 0.35 : 1);
    this.emote = null;
    this.addrDir = null;
    this.setSwing(0);
    // 量出手到球的方向與距離，讓桿頭剛好落在球後方
    if (this.hasRig) {
      const hands = this.club.position.clone();
      const ballL = this.root.worldToLocal(ballPos.clone());
      ballL.x -= 0.05; ballL.y += 0.02;
      const d = ballL.sub(hands);
      const len = THREE.MathUtils.clamp(d.length(), 0.6, 1.3);
      this.addrDir = d.normalize();
      this.club.userData.shaft.scale.y = len;
      this.club.userData.head.position.y = -len;
      this.setSwing(0);
    }
  }

  // 面向某個方向站著（結算畫面用）
  face(pos, dir) {
    this.root.position.copy(pos);
    this.root.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
  }

  setSwing(s) {
    this.swingS = s;
    const names = this.putt ? ['puttAddress', 'puttBack', 'puttAddress', 'puttThrough'] : ['address', 'top', 'impact', 'finish'];
    const i = Math.min(2, Math.floor(s)), t = Math.min(1, s - i);
    this.applyBlend(names[i], names[i + 1], smooth(t));
    this.updateClub(s);
  }

  updateClub(s) {
    this.club.visible = true;
    const keys = this.putt ? PUTT_KEYS : CLUB_KEYS;
    let i = 0;
    while (i < keys.length - 2 && s > keys[i + 1][0]) i++;
    const [s0, k0] = keys[i], [s1, k1] = keys[i + 1];
    // 站位（s=0）與擊球（s=2）的球桿方向改用「手 → 球」的實際方向
    const fix = (sv, d) => (this.addrDir && (sv === 0 || sv === 2) ? this.addrDir : this.addrDir && this.putt ? d.clone().setY(this.addrDir.y).setZ(this.addrDir.z).normalize() : d);
    const d0 = fix(s0, k0), d1 = fix(s1, k1);
    const t = THREE.MathUtils.clamp((s - s0) / (s1 - s0), 0, 1);
    const q0 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d0);
    const q1 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d1);
    this.club.quaternion.slerpQuaternions(q0, q1, t);
    if (this.hasRig) {
      this.root.updateMatrixWorld(true);
      const a = this.bones.LeftHand.getWorldPosition(new THREE.Vector3()), b = this.bones.RightHand.getWorldPosition(new THREE.Vector3());
      this.club.position.copy(this.root.worldToLocal(a.add(b).multiplyScalar(0.5)));
    } else this.club.position.set(0, this.height * 0.55, 0.3);
  }

  setEmote(name) { this.emote = name; this.emoteT = 0; this.club.visible = false; this.idle = null; }

  // 三向混合：站姿 ↔（A／B 之間擺動）
  applyGesture(a, b, osc, w) {
    if (!this.hasRig) return;
    const S = this.poseQ.stand, A = this.poseQ[a], B = this.poseQ[b], q = new THREE.Quaternion();
    for (const name of Object.keys(this.bones)) { q.slerpQuaternions(A[name], B[name], osc); this.bones[name].quaternion.slerpQuaternions(S[name], q, w); }
  }
  // 待機：呼吸起伏，隔幾秒隨機做一個手勢
  updateIdle(dt) {
    const G = [['waveA', 'waveB', 9, 2.0], ['scratchA', 'scratchB', 7, 2.2], ['hipsA', 'hipsB', 1.6, 3.4], ['stretchA', 'stretchB', 1.8, 3.0], ['thinkA', 'thinkB', 1.2, 3.2]]; // [A, B, 擺動速度, 持續秒數]
    const st = (this.idle ||= { phase: 'rest', t: 0, dur: 0.8 + Math.random() * 1.2, g: null, last: -1 });
    st.t += dt;
    const ease = (x) => x * x * (3 - 2 * x);
    if (st.phase === 'rest') {
      this.applyGesture('stand', 'stand', 0, 0);
      if (st.t > st.dur) { let i; do { i = Math.floor(Math.random() * G.length); } while (i === st.last); st.last = i; st.g = G[i]; st.phase = 'in'; st.t = 0; }
    } else {
      const [a, b, sp, hold] = st.g;
      const osc = 0.5 - 0.5 * Math.cos(this.emoteT * sp);
      let w = 1;
      if (st.phase === 'in') { w = ease(Math.min(1, st.t / 0.5)); if (st.t > 0.5) { st.phase = 'hold'; st.t = 0; } }
      else if (st.phase === 'hold') { if (st.t > hold) { st.phase = 'out'; st.t = 0; } }
      else { w = 1 - ease(Math.min(1, st.t / 0.6)); if (st.t > 0.6) { st.phase = 'rest'; st.t = 0; st.dur = 1.6 + Math.random() * 2.4; } }
      this.applyGesture(a, b, osc, w);
    }
    // 呼吸與輕微晃動（疊加在姿勢上）
    if (this.hasRig) {
      const t = this.emoteT, e = new THREE.Euler(Math.sin(t * 1.7) * 0.022, Math.sin(t * 0.6) * 0.03, Math.sin(t * 0.9) * 0.012);
      this.bones.Spine1?.quaternion.multiply(new THREE.Quaternion().setFromEuler(e));
      this.bones.Head?.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(t * 0.8) * 0.03, Math.sin(t * 0.45) * 0.06, 0)));
    }
  }

  update(dt) {
    if (!this.emote) return;
    this.emoteT += dt;
    const t = this.emoteT;
    if (this.emote === 'cheer') {
      // 先把拳頭舉起來，再有力地上下打氣；往下收快、往上舉慢，才有「用力」的感覺。不跳躍
      const w = Math.sin(t * 7.5), k = Math.min(1, t * 4);
      this.applyBlend('stand', 'cheerA', k);
      if (k >= 1) this.applyBlend('cheerA', 'cheerB', Math.pow(0.5 - 0.5 * w, 1.6));
      if (this.model && this.model.userData.hop) { this.model.position.y -= this.model.userData.hop; this.model.userData.hop = 0; } // 清掉舊版跳躍留下的位移
    } else if (this.emote === 'idle') {
      this.updateIdle(dt);
    } else if (this.emote === 'sad') {
      this.applyBlend('stand', 'sad', Math.min(1, t * 1.5));
    } else this.applyBlend('stand', 'stand', 0);
  }

  dispose() {
    this.root.traverse((o) => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) { for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) m[k]?.dispose(); m.dispose(); } });
  }
}
