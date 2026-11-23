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

// 松樹：樹幹加四層錐形樹冠
export function pineGeometry(th) {
  const r = rand(5), parts = [];
  const trunk = new THREE.CylinderGeometry(0.16, 0.28, 2.4, 7); trunk.translate(0, 1.2, 0);
  parts.push(paint(prep(trunk), th.trunk, 0.15, r));
  const base = new THREE.Color(th.leaf);
  for (let i = 0; i < 4; i++) {
    const g = new THREE.ConeGeometry(2.0 - i * 0.42, 2.3, 9, 1); g.translate(0, 2.3 + i * 1.25, 0);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) if (p.getY(k) < 2.3 + i * 1.25 - 0.9) { p.setX(k, p.getX(k) * (0.9 + r() * 0.25)); p.setZ(k, p.getZ(k) * (0.9 + r() * 0.25)); p.setY(k, p.getY(k) - r() * 0.25); }
    parts.push(paint(prep(g), '#' + base.clone().multiplyScalar(0.8 + i * 0.12).getHexString(), 0.12, r));
  }
  return mergeGeometries(parts.map((g) => { g.computeVertexNormals(); return g; }));
}

// 灌木：幾顆壓扁的球
export function bushGeometry(th) {
  const r = rand(9), parts = [];
  const base = new THREE.Color(th.leaf).lerp(new THREE.Color(th.rough), 0.3);
  for (let i = 0; i < 5; i++) {
    const g = new THREE.IcosahedronGeometry(0.55 + r() * 0.35, 1);
    g.scale(1, 0.75, 1); g.translate((r() - 0.5) * 1.3, 0.38 + r() * 0.25, (r() - 0.5) * 1.3);
    parts.push(paint(prep(g), '#' + base.clone().multiplyScalar(0.85 + r() * 0.35).getHexString(), 0.14, r));
  }
  return mergeGeometries(parts.map((g) => { g.computeVertexNormals(); return g; }));
}
// 岩石
export function rockGeometry(hex = '#8d8a84') {
  const r = rand(13), g = new THREE.IcosahedronGeometry(0.8, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.75 + r() * 0.5; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); }
  const o = prep(g); o.computeVertexNormals();
  return paint(o, hex, 0.16, r);
}
// 花叢（小色點）
export function flowerGeometry() {
  const r = rand(17), parts = [];
  const cols = ['#ff5a7a', '#ffd92e', '#ffffff', '#ff8a3c', '#c98bff'];
  for (let i = 0; i < 14; i++) { const g = new THREE.IcosahedronGeometry(0.09 + r() * 0.05, 0); g.translate((r() - 0.5) * 1.6, 0.18 + r() * 0.16, (r() - 0.5) * 1.6); parts.push(paint(prep(g), cols[Math.floor(r() * cols.length)], 0.05, r)); }
  const leaf = new THREE.IcosahedronGeometry(0.7, 0); leaf.scale(1.1, 0.22, 1.1); leaf.translate(0, 0.1, 0);
  parts.push(paint(prep(leaf), '#3f9a44', 0.1, r));
  return mergeGeometries(parts.map((g) => { g.computeVertexNormals(); return g; }));
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
