// 場景美術：程序化紋理（草、果嶺、沙、水波法線）、樹木與植被模型、遠景島嶼與火山、手繪天空
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const rand = (seed) => { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const cache = {};
function canvasTex(key, size, draw, repeat = true) {
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return (cache[key] = t);
}
// 可無縫平鋪的筆觸：超出邊界的部分在另一側補畫
function strokes(g, s, n, r, len, colors, width = 1.2) {
  for (let i = 0; i < n; i++) {
    const x = r() * s, y = r() * s, a = -Math.PI / 2 + (r() - 0.5) * 1.1, l = len * (0.5 + r());
    g.strokeStyle = colors[Math.floor(r() * colors.length)];
    g.lineWidth = width * (0.6 + r());
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke();
    }
  }
}

// 草地：中性亮度的底色加草葉筆觸，會與頂點色相乘
export const grassTexture = () => canvasTex('grass', 512, (g, s) => {
  const r = rand(7);
  g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '120,120,120'},${0.05 + r() * 0.07})`; const x = r() * s, y = r() * s, w = 20 + r() * 60; for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { g.beginPath(); g.ellipse(x + ox, y + oy, w, w * 0.6, r() * 3, 0, 6.3); g.fill(); } }
  strokes(g, s, 5200, r, 9, ['rgba(255,255,255,0.22)', 'rgba(255,255,230,0.16)', 'rgba(90,110,80,0.22)', 'rgba(60,80,60,0.16)']);
});
// 果嶺：細緻的交叉刈草紋
export const greenTexture = () => canvasTex('green', 256, (g, s) => {
  const r = rand(11);
  g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.fillRect(0, 0, s / 2, s / 2); g.fillRect(s / 2, s / 2, s / 2, s / 2);
  strokes(g, s, 1800, r, 4, ['rgba(255,255,255,0.14)', 'rgba(80,100,80,0.12)'], 0.8);
});
// 沙：細顆粒與耙痕
export const sandTexture = () => canvasTex('sand', 256, (g, s) => {
  const r = rand(19);
  g.fillStyle = '#eeeeee'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 5000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(150,130,100,0.22)'; g.fillRect(r() * s, r() * s, 1.4, 1.4); }
  g.strokeStyle = 'rgba(150,130,100,0.16)'; g.lineWidth = 2;
  for (let y = 0; y < s; y += 16) { g.beginPath(); for (let x = 0; x <= s; x += 8) g.lineTo(x, y + Math.sin((x / s) * Math.PI * 4) * 3); g.stroke(); }
});
// 水波法線貼圖（由多層正弦高度場算出）
export function waterNormal() {
  if (cache.waterN) return cache.waterN;
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S);
  const h = (x, y) => { const u = (x / S) * Math.PI * 2, v = (y / S) * Math.PI * 2; return Math.sin(u * 3 + v * 2) * 0.5 + Math.sin(u * 5 - v * 4 + 1.3) * 0.3 + Math.sin(u * 9 + v * 7 + 2.1) * 0.18 + Math.sin(-u * 13 + v * 11) * 0.1; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * 1.6, dy = (h(x, y + 1) - h(x, y - 1)) * 1.6, l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (cache.waterN = t);
}

// —— 幾何小工具 ——
function paint(geo, hex, jitter = 0, r = Math.random) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const k = 1 + (r() - 0.5) * jitter; a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
const prep = (g) => { const o = g.index ? g.toNonIndexed() : g; o.deleteAttribute('uv'); return o; };

// 椰子樹：彎曲的樹幹、下垂的羽狀葉、椰子
export function palmGeometry(th) {
  const r = rand(3), parts = [];
  const top = new THREE.Vector3(0.9, 6.4, 0.2);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.25, 3.4, 0), top);
  const trunk = new THREE.TubeGeometry(curve, 10, 0.17, 7, false);
  // 樹幹往上收細
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i), k = 1.25 - (y / 6.4) * 0.55, c = curve.getPoint(Math.min(1, Math.max(0, y / 6.4))); tp.setX(i, c.x + (tp.getX(i) - c.x) * k); tp.setZ(i, c.z + (tp.getZ(i) - c.z) * k); }
  parts.push(paint(prep(trunk), th.trunk, 0.18, r));
  const leafMain = new THREE.Color(th.leaf), leafLight = leafMain.clone().lerp(new THREE.Color('#d8f06a'), 0.35);
  for (let i = 0; i < 11; i++) {
    const ang = (i / 11) * Math.PI * 2 + r() * 0.3, len = 3.1 + r() * 0.9, droop = 0.55 + r() * 0.5, lift = 0.9 - (i % 3) * 0.35;
    const segs = 7, pos = [], col = [], idx = [];
    for (let s = 0; s <= segs; s++) {
      const u = s / segs, w = Math.sin(Math.PI * Math.min(1, u * 1.15)) * 0.52 + 0.04;
      const out = u * len, y = lift * Math.sin(u * 1.6) - droop * u * u * len * 0.55;
      const cx = Math.cos(ang) * out, cz = Math.sin(ang) * out, px = -Math.sin(ang) * w, pz = Math.cos(ang) * w;
      // 中肋稍高，兩側下垂，形成 V 形葉面
      pos.push(top.x + cx + px, top.y + y - 0.12, top.z + cz + pz, top.x + cx, top.y + y + 0.06, top.z + cz, top.x + cx - px, top.y + y - 0.12, top.z + cz - pz);
      const c = leafMain.clone().lerp(leafLight, u * 0.8 + r() * 0.1);
      for (let k = 0; k < 3; k++) col.push(c.r * (k === 1 ? 1.12 : 0.92), c.g * (k === 1 ? 1.12 : 0.92), c.b * (k === 1 ? 1.12 : 0.92));
      if (s < segs) { const a = s * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    parts.push(g.toNonIndexed());
  }
  for (let i = 0; i < 4; i++) { const g = new THREE.SphereGeometry(0.2, 7, 6); g.translate(top.x + Math.cos(i * 1.7) * 0.28, top.y - 0.28, top.z + Math.sin(i * 1.7) * 0.28); parts.push(paint(prep(g), '#6b4a2a', 0.1, r)); }
  const out = mergeGeometries(parts.map((g) => { g.computeVertexNormals(); return g; }));
  return out;
}

// 依高度上色：底部暗、頂端亮（讓樹冠、灌木有體積感）
function shadeByHeight(geo, lo, hi, y0, y1, r, jitter = 0.08) {
  const p = geo.attributes.position, a = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) { // 以三角形為單位上色，保持低面數的塊面感
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, k = 1 + (r() - 0.5) * jitter;
    c.copy(lo).lerp(hi, Math.min(1, Math.max(0, (y - y0) / (y1 - y0))));
    for (let j = 0; j < 3; j++) { a[(i + j) * 3] = c.r * k; a[(i + j) * 3 + 1] = c.g * k; a[(i + j) * 3 + 2] = c.b * k; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

// 松樹：有根的樹幹、七層鋸齒狀下垂的枝葉（內深外亮）
export function pineGeometry(th) {
  const r = rand(5), parts = [];
  const trunk = new THREE.CylinderGeometry(0.11, 0.34, 3.2, 7, 3); trunk.translate(0, 1.6, 0);
  const tk = shadeByHeight(prep(trunk), new THREE.Color(th.trunk).multiplyScalar(0.7), new THREE.Color(th.trunk).multiplyScalar(1.15), 0, 3.2, r, 0.2);
  parts.push(tk);
  const base = new THREE.Color(th.leaf), dark = base.clone().multiplyScalar(0.55), light = base.clone().lerp(new THREE.Color('#8fdc7a'), 0.3);
  const tiers = 7, SEG = 14;
  for (let i = 0; i < tiers; i++) {
    const u = i / (tiers - 1), rad = 2.25 * (1 - u * 0.8), h = 1.75 - u * 0.55, y0 = 1.55 + i * 0.95;
    const g = new THREE.ConeGeometry(rad, h, SEG, 1); g.translate(0, y0 + h / 2, 0); g.rotateY(i * 0.7);
    const o = prep(g), p = o.attributes.position;
    for (let k = 0; k < p.count; k++) {
      if (p.getY(k) > y0 + 0.05) continue;
      const x = p.getX(k), z = p.getZ(k), rr = Math.hypot(x, z);
      if (rr < 0.01) { p.setY(k, y0 + h * 0.3); continue; } // 底面中心往上凹，從下面看不是平的
      const tip = Math.round((Math.atan2(z, x) - i * 0.7) / ((Math.PI * 2) / SEG)) % 2 === 0, m = tip ? 1.14 : 0.72;
      p.setXYZ(k, x * m, y0 - (tip ? 0.38 : 0.02), z * m); // 枝尖往外往下垂，凹處往內縮
    }
    const col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let k = 0; k < p.count; k += 3) {
      let rr = 0, yy = 0; for (let j = 0; j < 3; j++) { rr += Math.hypot(p.getX(k + j), p.getZ(k + j)); yy += p.getY(k + j); }
      const t = Math.min(1, (rr / 3 / rad) * 0.55 + u * 0.3 + ((yy / 3 - y0) / h) * 0.25), jit = 0.92 + r() * 0.16;
      c.copy(dark).lerp(light, t);
      for (let j = 0; j < 3; j++) { col[(k + j) * 3] = c.r * jit; col[(k + j) * 3 + 1] = c.g * jit; col[(k + j) * 3 + 2] = c.b * jit; }
    }
    o.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(o);
  }
  return mergeGeometries(parts.map((g) => { g.computeVertexNormals(); return g; }));
}

// 灌木：一叢大小不一的葉團，底暗頂亮，點綴小花
export function bushGeometry(th, blossom = '#fff3f6') {
  const r = rand(9), parts = [];
  const base = new THREE.Color(th.leaf).lerp(new THREE.Color(th.rough), 0.25), lo = base.clone().multiplyScalar(0.55), hi = base.clone().lerp(new THREE.Color('#d9f08a'), 0.32);
  for (let i = 0; i < 7; i++) {
    const rad = 0.42 + r() * 0.42, g = new THREE.IcosahedronGeometry(rad, 1), a = r() * 6.28, d = i === 0 ? 0 : 0.35 + r() * 0.55;
    g.scale(1, 0.8, 1); g.translate(Math.cos(a) * d, rad * 0.62 + (i === 0 ? 0.25 : 0), Math.sin(a) * d);
    parts.push(shadeByHeight(prep(g), lo, hi, 0, 1.25, r, 0.12));
  }
  if (blossom) for (let i = 0; i < 9; i++) {
    const a = r() * 6.28, d = r() * 0.75, g = new THREE.IcosahedronGeometry(0.05 + r() * 0.03, 0);
    g.translate(Math.cos(a) * d, 0.82 + r() * 0.3 - d * 0.35, Math.sin(a) * d);
    parts.push(paint(prep(g), blossom, 0.06, r));
  }
  return mergeGeometries(parts.map((g) => { g.computeVertexNormals(); return g; }));
}
// 岩石：兩三顆大小不一的石塊，朝上的面長青苔
export function rockGeometry(hex = '#8d8a84', moss = '#6f9a4a') {
  const r = rand(13), parts = [];
  const stone = new THREE.Color(hex), mossC = moss ? new THREE.Color(moss) : null;
  for (const [sx, x, z] of [[1, 0, 0], [0.55, 0.85, 0.3], [0.4, -0.6, 0.65]]) {
    const g = new THREE.IcosahedronGeometry(0.8 * sx, 1), p = g.attributes.position, seen = new Map();
    for (let i = 0; i < p.count; i++) { // 同一位置的頂點用同一個擾動，石頭才不會裂開
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      if (!seen.has(key)) seen.set(key, 0.72 + r() * 0.5);
      const k = seen.get(key);
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.72, p.getZ(i) * k);
    }
    g.translate(x, 0.12 * sx, z);
    const o = prep(g); o.computeVertexNormals();
    const n = o.attributes.normal, q = o.attributes.position, col = new Float32Array(q.count * 3), c = new THREE.Color();
    for (let i = 0; i < q.count; i += 3) {
      const up = n.getY(i), jit = 0.82 + r() * 0.3;
      c.copy(stone).multiplyScalar(0.62 + Math.max(0, up) * 0.5);
      if (mossC && up > 0.62) c.lerp(mossC, 0.65);
      for (let j = 0; j < 3; j++) { col[(i + j) * 3] = c.r * jit; col[(i + j) * 3 + 1] = c.g * jit; col[(i + j) * 3 + 2] = c.b * jit; }
    }
    o.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(o);
  }
  return mergeGeometries(parts);
}
// 花叢：一株一株有莖、五片花瓣與花心的小花，底下有幾片葉子
export function flowerGeometry() {
  const r = rand(17), parts = [];
  const cols = ['#ff5a7a', '#ffd92e', '#ffffff', '#ff9a4c', '#c79bff', '#ff86c0'];
  for (let i = 0; i < 12; i++) {
    const x = (r() - 0.5) * 1.7, z = (r() - 0.5) * 1.7, h = 0.3 + r() * 0.26, col = cols[Math.floor(r() * cols.length)], lean = (r() - 0.5) * 0.3, yaw = r() * 6.28;
    const stem = new THREE.CylinderGeometry(0.012, 0.02, h, 4); stem.translate(0, h / 2, 0);
    const head = [];
    for (let k = 0; k < 5; k++) {
      const pt = new THREE.CircleGeometry(0.085, 6); pt.rotateX(-Math.PI / 2); pt.scale(1, 1, 0.62); pt.translate(0.085, 0, 0); pt.rotateZ(0.42); pt.rotateY((k / 5) * Math.PI * 2); pt.translate(0, h, 0);
      head.push(paint(prep(pt), col, 0.1, r));
    }
    const core = new THREE.IcosahedronGeometry(0.04, 0); core.translate(0, h + 0.025, 0);
    const one = mergeGeometries([paint(prep(stem), '#4f9a3c', 0.1, r), ...head, paint(prep(core), col === '#ffd92e' ? '#b0661c' : '#ffd23a', 0.05, r)]);
    one.rotateZ(lean); one.rotateY(yaw); one.translate(x, 0, z);
    parts.push(one);
  }
  for (let i = 0; i < 16; i++) { // 葉片
    const g = new THREE.ConeGeometry(0.05, 0.26 + r() * 0.2, 3); g.translate(0, 0.14, 0); g.rotateZ((r() - 0.5) * 1.3); g.rotateY(r() * 6.28); g.translate((r() - 0.5) * 1.7, 0, (r() - 0.5) * 1.7);
    parts.push(paint(prep(g), r() < 0.5 ? '#4f9a3c' : '#6bb84a', 0.12, r));
  }
  return mergeGeometries(parts.map((g) => { g.computeVertexNormals(); return g; }));
}
// 草叢：一撮往外彎的長草葉
export function grassTuftGeometry(th) {
  const r = rand(21), parts = [];
  const lo = new THREE.Color(th.rough).multiplyScalar(0.8), hi = new THREE.Color(th.fairwayA).lerp(new THREE.Color('#e6f08a'), 0.3);
  for (let i = 0; i < 11; i++) {
    const h = 0.32 + r() * 0.34, g = new THREE.ConeGeometry(0.035, h, 3); g.translate(0, h / 2, 0); g.rotateZ(0.15 + r() * 0.55); g.rotateY(r() * 6.28); g.translate((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3);
    parts.push(shadeByHeight(prep(g), lo, hi, 0, 0.6, r, 0.1));
  }
  return mergeGeometries(parts.map((g) => { g.computeVertexNormals(); return g; }));
}
// 水邊的蘆葦（香蒲）
export function reedGeometry() {
  const r = rand(23), parts = [];
  for (let i = 0; i < 9; i++) {
    const h = 0.9 + r() * 0.9, x = (r() - 0.5) * 0.7, z = (r() - 0.5) * 0.7, lean = (r() - 0.5) * 0.28, yaw = r() * 6.28;
    const blade = new THREE.ConeGeometry(0.03, h, 3); blade.translate(0, h / 2, 0);
    const list = [paint(prep(blade), r() < 0.5 ? '#6fa04a' : '#88b25a', 0.12, r)];
    if (i % 3 === 0) { const head = new THREE.CylinderGeometry(0.035, 0.035, 0.24, 5); head.translate(0, h * 0.86, 0); list.push(paint(prep(head), '#6b4423', 0.1, r)); }
    const one = mergeGeometries(list); one.rotateZ(lean); one.rotateY(yaw); one.translate(x, 0, z);
    parts.push(one);
  }
  return mergeGeometries(parts.map((g) => { g.computeVertexNormals(); return g; }));
}
// 睡蓮：有缺口的圓葉，part = 'pad' 葉片、'bloom' 花
export function lilyGeometry(part) {
  const r = rand(27);
  if (part === 'pad') {
    const g = new THREE.CircleGeometry(0.5, 12, 0.3, Math.PI * 2 - 0.6); g.rotateX(-Math.PI / 2);
    return paint(prep(g), '#4fa04a', 0.16, r);
  }
  const parts = [];
  for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 6; k++) {
    const pt = new THREE.ConeGeometry(0.06, 0.24 - ring * 0.06, 4); pt.translate(0, 0.12, 0); pt.rotateZ(0.95 - ring * 0.5); pt.rotateY((k / 6) * Math.PI * 2 + ring * 0.5);
    parts.push(paint(prep(pt), ring ? '#fff1f6' : '#ff9cc4', 0.06, r));
  }
  const core = new THREE.IcosahedronGeometry(0.05, 0); core.translate(0, 0.06, 0); parts.push(paint(prep(core), '#ffd23a', 0.05, r));
  return mergeGeometries(parts.map((g) => { g.computeVertexNormals(); return g; }));
}

// —— 水面著色器（海與水坑共用）：兩層流動水波、菲涅耳天空反光、太陽亮點、岸邊淺水與浪花 ——
export const waterEnv = {
  time: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color('#ffffff') }, sky: { value: new THREE.Color('#bfe6ff') },
  fogCol: { value: new THREE.Color('#ffffff') }, fogNear: { value: 180 }, fogFar: { value: 900 },
};
const WATER_VERT = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const WATER_HEAD = `
  uniform sampler2D nrm; uniform float time, fogNear, fogFar; uniform vec3 deep, shallow, sky, sunCol, sunDir, fogCol; varying vec3 vW;
  vec3 waveN(vec2 p, float s, out vec2 a, out vec2 b) {
    a = texture2D(nrm, p * 0.047 * s + vec2(time * 0.013, time * 0.008)).xy * 2.0 - 1.0;
    b = texture2D(nrm, p * vec2(0.019, -0.023) * s + vec2(-time * 0.007, time * 0.011)).xy * 2.0 - 1.0;
    return normalize(vec3((a.x + b.x) * 0.5, 1.0, (a.y + b.y) * 0.5));
  }
  vec3 shadeWater(vec3 base, vec3 n, float foam) {
    vec3 v = normalize(cameraPosition - vW);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 col = mix(base, sky, clamp(fres * 0.5 + 0.03, 0.0, 1.0));
    col += sunCol * pow(max(dot(reflect(-sunDir, n), v), 0.0), 160.0) * 1.1;
    col = mix(col, vec3(1.0), foam);
    return mix(col, fogCol, smoothstep(fogNear, fogFar, length(cameraPosition - vW)));
  }`;
const WATER_TAIL = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}';
const envU = () => ({ time: waterEnv.time, sunDir: waterEnv.sunDir, sunCol: waterEnv.sunCol, sky: waterEnv.sky, fogCol: waterEnv.fogCol, fogNear: waterEnv.fogNear, fogFar: waterEnv.fogFar, nrm: { value: waterNormal() } });
// 海：shore 是地形高度圖（相對海面），用來畫出岸邊的淺水色與一波一波的浪花
export function seaMaterial(th) {
  const sea = new THREE.Color(th.sea);
  return new THREE.ShaderMaterial({
    uniforms: { ...envU(), deep: { value: sea.clone().multiplyScalar(0.72) }, shallow: { value: sea.clone().lerp(new THREE.Color('#8ff0e0'), 0.6) }, shore: { value: null }, bounds: { value: new THREE.Vector4(0, 0, 1, 1) } },
    vertexShader: WATER_VERT,
    fragmentShader: `${WATER_HEAD}
      uniform sampler2D shore; uniform vec4 bounds;
      void main(){
        vec2 a, b; vec3 n = waveN(vW.xz, 1.0, a, b);
        vec2 uv = (vW.xz - bounds.xy) * bounds.zw, e = min(uv, 1.0 - uv);
        float inside = smoothstep(0.0, 0.05, min(e.x, e.y));
        float hgt = (texture2D(shore, clamp(uv, 0.0, 1.0)).r - 0.5) * 4.0; // 地面比海面高多少公尺（負值＝水深）
        float shal = smoothstep(-1.9, -0.15, hgt) * inside;
        vec3 base = mix(deep, shallow, shal * 0.9);
        float wave = sin(hgt * 7.0 + time * 1.5 + a.x * 2.5 + b.y * 2.0) * 0.5 + 0.5;
        float foam = smoothstep(-0.75, -0.2, hgt) * smoothstep(0.62, 0.95, wave) * 0.75;
        foam = max(foam, smoothstep(-0.22, -0.02, hgt)) * inside;
        foam = max(foam, smoothstep(0.9, 1.0, a.x * b.y + a.y * b.x + 0.42) * 0.25 * (1.0 - shal)); // 外海零星的白浪
        gl_FragColor = vec4(shadeWater(base, n, clamp(foam, 0.0, 0.92)), 1.0);${WATER_TAIL}`,
  });
}
// 水坑：中央深、岸邊淺，邊緣一圈淡淡的水沫
export function pondMaterial(th, cx, cz, radius) {
  const w = new THREE.Color(th.water);
  return new THREE.ShaderMaterial({
    uniforms: { ...envU(), deep: { value: w.clone().multiplyScalar(0.5) }, shallow: { value: w.clone().lerp(new THREE.Color('#bff3ea'), 0.45) }, center: { value: new THREE.Vector2(cx, cz) }, radius: { value: radius } },
    vertexShader: WATER_VERT,
    fragmentShader: `${WATER_HEAD}
      uniform vec2 center; uniform float radius;
      void main(){
        vec2 a, b; vec3 n = waveN(vW.xz, 2.4, a, b);
        float d = length(vW.xz - center) / radius;
        vec3 base = mix(deep, shallow, smoothstep(0.3, 1.0, d));
        float foam = smoothstep(0.86, 1.0, d + a.x * 0.04) * 0.55;
        gl_FragColor = vec4(shadeWater(base, n, foam), 1.0);${WATER_TAIL}`,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

// 遠景：環繞的小島；火山球場加一座冒煙的火山
export function buildBackdrop(course, seaLevel) {
  const th = course.theme, g = new THREE.Group(), r = rand(course.seed * 3 + 1);
  const land = new THREE.Color(th.rough).lerp(new THREE.Color(th.fog), 0.45), rock = new THREE.Color(course.id === 'volcano' ? '#4a3f44' : '#8a9aa0').lerp(new THREE.Color(th.fog), 0.4);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.5, d = 620 + r() * 420, w = 90 + r() * 150, h = 35 + r() * 90;
    const geo = new THREE.ConeGeometry(w, h, 9, 3), p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const j = 0.75 + r() * 0.5; p.setX(k, p.getX(k) * j); p.setZ(k, p.getZ(k) * j * (0.6 + r() * 0.3)); }
    geo.translate(Math.cos(a) * d, h / 2 - 4, Math.sin(a) * d);
    const o = prep(geo), n = o.attributes.position.count, col = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { const c = o.attributes.position.getY(k) > h * 0.45 ? rock : land, j = 0.9 + r() * 0.2; col[k * 3] = c.r * j; col[k * 3 + 1] = c.g * j; col[k * 3 + 2] = c.b * j; }
    o.setAttribute('color', new THREE.BufferAttribute(col, 3));
    o.computeVertexNormals(); parts.push(o);
  }
  const isles = new THREE.Mesh(mergeGeometries(parts), mat);
  isles.position.y = seaLevel;
  g.add(isles);
  g.userData.smoke = [];
  if (course.id === 'volcano') {
    const H = 300, vg = new THREE.CylinderGeometry(55, 330, H, 14, 5, true), p = vg.attributes.position, rr = rand(99);
    for (let k = 0; k < p.count; k++) { const j = 0.88 + rr() * 0.24; p.setX(k, p.getX(k) * j); p.setZ(k, p.getZ(k) * j); }
    const o = prep(vg), n = o.attributes.position.count, col = new Float32Array(n * 3), dark = new THREE.Color('#3a2f33').lerp(new THREE.Color(th.fog), 0.25), hot = new THREE.Color('#ff6a2a');
    for (let k = 0; k < n; k++) { const y = o.attributes.position.getY(k) / H + 0.5, c = dark.clone().lerp(hot, Math.max(0, (y - 0.82) * 4.5)); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
    o.setAttribute('color', new THREE.BufferAttribute(col, 3)); o.computeVertexNormals();
    const vol = new THREE.Mesh(o, mat);
    vol.position.set(-420, seaLevel + H / 2 - 6, 980);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(52, 20), new THREE.MeshBasicMaterial({ color: '#ff7a2a', fog: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(-420, seaLevel + H - 12, 980);
    g.add(vol, glow);
    const sm = new THREE.MeshBasicMaterial({ color: '#6a5f66', transparent: true, opacity: 0.55, fog: false, depthWrite: false });
    for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(40, 10, 8), sm.clone()); s.userData = { t: i / 9, base: new THREE.Vector3(-420, seaLevel + H, 980) }; g.add(s); g.userData.smoke.push(s); }
  }
  g.userData.update = (time) => {
    for (const s of g.userData.smoke) {
      const u = (s.userData.t + time * 0.035) % 1;
      s.position.copy(s.userData.base).add(new THREE.Vector3(u * 260 + Math.sin(u * 9 + s.userData.t * 20) * 20, u * 330, -u * 90));
      s.scale.setScalar(0.5 + u * 2.6); s.material.opacity = 0.6 * (1 - u) * Math.min(1, u * 6);
    }
  };
  return g;
}

// 各球場的特色地標：椰林湾＝陽傘與帆船、珊瑚海岸＝燈塔與礁岩、火山岭＝玄武岩石柱
export function buildLandmarks(course, H) {
  const g = new THREE.Group(), r = H.rnd, parts = [];
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const add = (geo, hex, x, y, z, jitter = 0.06) => { const o = prep(geo); o.translate(x, y, z); parts.push(paint(o, hex, jitter, r)); };
  // 在離球道中心線 lo~hi 的範圍內找一個點
  const spot = (lo, hi, tries = 60) => { for (let i = 0; i < tries; i++) { const x = H.minX + r() * (H.maxX - H.minX), z = H.minZ + r() * (H.maxZ - H.minZ), d = H.distPath(x, z).d; if (d >= lo && d <= hi) return { x, z, d }; } return null; };
  const sea = H.seaLevel;

  if (course.feature === 'beach') {
    const stripes = [['#ff5a5a', '#ffffff'], ['#3aa0e0', '#ffffff'], ['#ffd23a', '#ffffff'], ['#ff8a3c', '#fff3d6']];
    for (let i = 0; i < 9; i++) { // 沙灘遮陽傘
      const p = spot(51, 56); if (!p) continue;
      const y = H.heightAt(p.x, p.z), [c1, c2] = stripes[i % stripes.length];
      add(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), '#f4f1e6', p.x, y + 1.2, p.z);
      for (let k = 0; k < 8; k++) { const seg = new THREE.ConeGeometry(1.7, 0.7, 8, 1, true, (k / 8) * Math.PI * 2, Math.PI / 4); add(seg, k % 2 ? c1 : c2, p.x, y + 2.5, p.z, 0.02); }
      const towel = new THREE.BoxGeometry(0.9, 0.05, 1.9); towel.rotateY(r() * 3); add(towel, c1, p.x + 1.4, y + 0.05, p.z + 0.6, 0.03);
    }
    for (let i = 0; i < 6; i++) { // 帆船
      const p = spot(85, 170, 200) || { x: H.maxX + 60 + i * 30, z: H.len * r() }, a = r() * 6.28;
      const hull = new THREE.BoxGeometry(5.5, 1.1, 1.8); hull.rotateY(a); add(hull, i % 2 ? '#ffffff' : '#2463c9', p.x, sea + 0.5, p.z, 0.03);
      const mast = new THREE.CylinderGeometry(0.08, 0.08, 7, 5); add(mast, '#8a6a45', p.x, sea + 4.4, p.z);
      const sail = new THREE.ConeGeometry(2.3, 6, 3, 1); sail.scale(1, 1, 0.12); sail.rotateY(a); add(sail, '#fff8ec', p.x, sea + 4.6, p.z, 0.02);
    }
  } else if (course.feature === 'lighthouse') {
    // 果嶺旁的紅白燈塔
    let lp = null;
    for (let i = 0; i < 80 && !lp; i++) { const a = r() * 6.28, x = H.pin.x + Math.cos(a) * 34, z = H.pin.z + Math.sin(a) * 34, d = H.distPath(x, z).d; if (d > 30 && d < 50 && H.surfaceAt(x, z) === 'rough') lp = { x, z }; }
    if (lp) {
      const y = H.heightAt(lp.x, lp.z);
      add(new THREE.CylinderGeometry(3.4, 3.8, 1.2, 12), '#8f8a84', lp.x, y + 0.5, lp.z);
      for (let k = 0; k < 5; k++) add(new THREE.CylinderGeometry(2.3 - k * 0.2, 2.5 - k * 0.2, 3.2, 14), k % 2 ? '#ffffff' : '#e23b30', lp.x, y + 2.6 + k * 3.2, lp.z, 0.02);
      add(new THREE.CylinderGeometry(2.2, 2.2, 0.35, 14), '#3a3a40', lp.x, y + 17.3, lp.z);
      add(new THREE.ConeGeometry(1.7, 1.8, 10), '#e23b30', lp.x, y + 20.4, lp.z, 0.02);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2, 10), new THREE.MeshBasicMaterial({ color: '#fff2b0', fog: false }));
      lamp.position.set(lp.x, y + 18.5, lp.z); g.add(lamp);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(7, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending }));
      beam.geometry.rotateZ(Math.PI / 2); beam.geometry.translate(30, 0, 0);
      beam.position.set(lp.x, y + 18.5, lp.z); g.add(beam);
      g.userData.spin = beam;
    }
    for (let i = 0; i < 9; i++) { // 海上的礁岩
      const p = spot(72, 130, 200); if (!p) continue;
      const h = 6 + r() * 12, rock = new THREE.CylinderGeometry(1.2 + r() * 1.5, 3 + r() * 3, h, 6, 2), pp = rock.attributes.position;
      for (let k = 0; k < pp.count; k++) { const j = 0.8 + r() * 0.4; pp.setX(k, pp.getX(k) * j); pp.setZ(k, pp.getZ(k) * j); }
      add(rock, '#8a6f62', p.x, sea + h / 2 - 1, p.z, 0.18);
    }
  } else if (course.feature === 'lava') {
    for (let i = 0; i < 26; i++) { // 玄武岩石柱群
      const p = spot(38, 58); if (!p || H.surfaceAt(p.x, p.z) !== 'rough') continue;
      const y = H.heightAt(p.x, p.z);
      for (let k = 0, n = 3 + Math.floor(r() * 4); k < n; k++) {
        const h = 2 + r() * 7, col = new THREE.CylinderGeometry(0.7, 0.75, h, 6);
        add(col, r() < 0.15 ? '#5a3a2e' : '#3b3438', p.x + (r() - 0.5) * 2.6, y + h / 2 - 0.4, p.z + (r() - 0.5) * 2.6, 0.2);
      }
    }
  } else if (course.feature === 'links') {
    const sp = H.spec;
    // 石造建築：方盒＋斜屋頂；rot 為朝向
    const house = (x, z, w, d, h, rot, wall, roof) => {
      const y = H.heightAt(x, z), body = new THREE.BoxGeometry(w, h, d); body.rotateY(rot); add(body, wall, x, y + h / 2, z, 0.08);
      const rh = Math.min(w, d) * 0.42, top = new THREE.CylinderGeometry(0.01, 1, 1, 4, 1); top.rotateY(Math.PI / 4); top.scale((w / Math.SQRT2) * 1.06, rh, (d / Math.SQRT2) * 1.06); top.rotateY(rot); add(top, roof, x, y + h + rh / 2, z, 0.08); // 四坡屋頂，高度看短邊
    };
    // 把建築群推到球道外（離中心線至少 lo 公尺）
    const away = (x, z, lo) => { const mx = 0, mz = H.len / 2; let vx = x - mx, vz = z - mz; const l = Math.hypot(vx, vz) || 1; vx /= l; vz /= l; let d = Math.min(l, 320), px = mx + vx * d, pz = mz + vz * d; for (let i = 0; i < 80 && H.distPath(px, pz).d < lo; i++) { d += 6; px = mx + vx * d; pz = mz + vz * d; } return { x: px, z: pz, vx, vz }; };
    // 古鎮天際線：放在俱樂部會館的真實方位
    if (sp.town) {
      const t = away(sp.town[0], sp.town[1], 84), ax = -t.vz, az = t.vx, rot = Math.atan2(t.vx, t.vz);
      const walls = ['#b9b0a0', '#a8a094', '#c4bba8', '#9c958a'], roofs = ['#5a5f6a', '#6a5a52', '#4f5560'];
      for (let i = -6; i <= 6; i++) {
        const w = 9 + r() * 7, h = 8 + r() * 7, d = 9 + r() * 4, off = i * 13 + (r() - 0.5) * 3, back = (r() - 0.5) * 10;
        house(t.x + ax * off + t.vx * back, t.z + az * off + t.vz * back, w, d, h, rot, walls[Math.floor(r() * walls.length)], roofs[Math.floor(r() * roofs.length)]);
      }
      // 會館：較大的石樓與鐘樓
      house(t.x - t.vx * 14, t.z - t.vz * 14, 26, 15, 13, rot, '#c9bfa8', '#59606c');
      const tw = new THREE.BoxGeometry(5, 22, 5); tw.rotateY(rot); add(tw, '#c2b8a2', t.x - t.vx * 14 + ax * 8, H.heightAt(t.x, t.z) + 11, t.z - t.vz * 14 + az * 8, 0.06);
      const spire = new THREE.ConeGeometry(4.2, 9, 4); spire.rotateY(rot + Math.PI / 4); add(spire, '#4f5560', t.x - t.vx * 14 + ax * 8, H.heightAt(t.x, t.z) + 26.5, t.z - t.vz * 14 + az * 8, 0.06);
      const church = new THREE.ConeGeometry(2.6, 26, 6); add(church, '#8f8a84', t.x + ax * 52 + t.vx * 18, H.heightAt(t.x, t.z) + 20, t.z + az * 52 + t.vz * 18, 0.06);
    }
    // 球道旁的大飯店（第 17 洞開球要越過它的一角）
    if (sp.hotel && H.distPath(sp.hotel[0], sp.hotel[1]).d < 130) {
      let hx = sp.hotel[0], hz = sp.hotel[1]; const side = Math.sign(hx) || 1;
      for (let i = 0; i < 40 && H.distPath(hx, hz).d < 46; i++) hx += side * 3;
      house(hx, hz, 22, 64, 15, 0, '#e6dcc4', '#5c5a60');
    }
    // 小溪上的石拱橋
    if (sp.bridge) {
      const [bx, bz] = sp.bridge, y0 = Math.max(H.heightAt(bx, bz - 6), H.heightAt(bx, bz + 6));
      for (let k = -4; k <= 4; k++) { const u = k / 4, deck = new THREE.BoxGeometry(2.8, 0.5, 1.5); deck.rotateX(-u * 0.32); add(deck, '#b9b0a0', bx, y0 + 1.15 * (1 - u * u) - 0.1, bz + k * 1.4, 0.1); }
      for (const sd of [-1, 1]) for (let k = -4; k <= 4; k++) { const u = k / 4, wall = new THREE.BoxGeometry(0.35, 0.75, 1.5); wall.rotateX(-u * 0.32); add(wall, '#a8a094', bx + sd * 1.4, y0 + 1.15 * (1 - u * u) + 0.5, bz + k * 1.4, 0.1); }
    }
  }

  if (parts.length) { const m = new THREE.Mesh(mergeGeometries(parts.map((o) => { o.computeVertexNormals(); return o; })), mat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  return g;
}

// 手繪天空：把全景圖貼到天空球上，左右鏡射避免接縫
export function loadSky(course, skyMesh, onLoaded) {
  new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}ui/sky_${course.id}.webp`, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.MirroredRepeatWrapping; t.repeat.set(2, 1);
    skyMesh.material.dispose();
    skyMesh.material = new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, toneMapped: false });
    onLoaded?.();
  }, undefined, () => {});
}
