// 依球洞資料產生 3D 地形：高度場、地表類型、沙坑／水池／果嶺、樹木、旗桿
import * as THREE from 'three';
import { grassTexture, greenTexture, sandTexture, waterNormal, palmGeometry, pineGeometry, bushGeometry, rockGeometry, flowerGeometry } from './scenery.js';

export const OB_DIST = 58; // 離球道中心線多遠算出界
const STEP = 2; // 地形網格間距(m)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function buildHole(course, index) {
  const spec = course.holes[index];
  const th = course.theme;
  const rnd = mulberry32(course.seed * 100 + index * 7 + 1);
  const s1 = rnd() * 6.28, s2 = rnd() * 6.28, s3 = rnd() * 6.28;
  const len = spec.len;

  // —— 球道中心線（二次貝茲）——
  const P0 = { x: 0, z: 0 }, P1 = { x: spec.dog * 2, z: len * 0.5 }, P2 = { x: spec.pinX, z: len };
  const N = 48;
  const pathPoint = (t) => ({
    x: (1 - t) * (1 - t) * P0.x + 2 * (1 - t) * t * P1.x + t * t * P2.x,
    z: (1 - t) * (1 - t) * P0.z + 2 * (1 - t) * t * P1.z + t * t * P2.z,
  });
  const path = Array.from({ length: N + 1 }, (_, i) => pathPoint(i / N));
  function distPath(x, z) {
    let best = 1e12, bt = 0;
    for (let i = 0; i < N; i++) {
      const a = path[i], b = path[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const u = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
      const px = a.x + dx * u - x, pz = a.z + dz * u - z;
      const d2 = px * px + pz * pz;
      if (d2 < best) { best = d2; bt = (i + u) / N; }
    }
    return { d: Math.sqrt(best), t: bt };
  }
  const hazardCenter = ([t, off]) => {
    const p = pathPoint(t), q = pathPoint(Math.min(1, t + 0.01)), r = pathPoint(Math.max(0, t - 0.01));
    const dx = q.x - r.x, dz = q.z - r.z, l = Math.hypot(dx, dz) || 1;
    return { x: p.x + (dz / l) * off, z: p.z - (dx / l) * off };
  };

  const amp = course.amp;
  const raw = (x, z) => amp * (Math.sin(x * 0.021 + s1) * Math.cos(z * 0.017 + s2) + 0.5 * Math.sin(x * 0.047 + z * 0.039 + s3));
  const pinXZ = { x: P2.x, z: P2.z };
  const hPin = raw(pinXZ.x, pinXZ.z), hTee = raw(0, 0);
  const gx = (rnd() - 0.5) * 0.05, gz = (rnd() - 0.5) * 0.05; // 果嶺坡度
  const greenR = spec.greenR;
  const bunkers = spec.bunkers.map((b) => ({ ...hazardCenter(b), r: b[2] }));
  const waters = spec.water.map((w) => { const c = hazardCenter(w); return { ...c, r: w[2], level: raw(c.x, c.z) - 0.45 }; });
  const seaLevel = -1.5 * amp - 2.0;

  function trueHeight(x, z) {
    let h = raw(x, z);
    const dPin = Math.hypot(x - pinXZ.x, z - pinXZ.z);
    h = mix(h, hPin + gx * (x - pinXZ.x) + gz * (z - pinXZ.z), smooth(greenR + 12, greenR + 1, dPin));
    h = mix(h, hTee, smooth(16, 6, Math.hypot(x, z)));
    for (const b of bunkers) h -= 0.6 * smooth(b.r, b.r * 0.45, Math.hypot(x - b.x, z - b.z));
    for (const w of waters) h = mix(h, w.level - 1.3, smooth(w.r + 4, w.r - 2, Math.hypot(x - w.x, z - w.z)));
    const dp = distPath(x, z).d;
    if (dp > 50) h -= (dp - 50) * (dp - 50) * 0.012; // 島嶼邊緣沉入海面
    return h;
  }

  // —— 高度網格 ——
  let minX = Infinity, maxX = -Infinity;
  for (const p of path) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); }
  const M = OB_DIST + 18;
  minX -= M; maxX += M;
  const minZ = -M, maxZ = len + M;
  const nx = Math.ceil((maxX - minX) / STEP), nz = Math.ceil((maxZ - minZ) / STEP);
  const H = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) H[j * (nx + 1) + i] = trueHeight(minX + i * STEP, minZ + j * STEP);

  function heightAt(x, z) {
    const fx = clamp((x - minX) / STEP, 0, nx - 1e-4), fz = clamp((z - minZ) / STEP, 0, nz - 1e-4);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = H[j * (nx + 1) + i], b = H[j * (nx + 1) + i + 1], c = H[(j + 1) * (nx + 1) + i], d = H[(j + 1) * (nx + 1) + i + 1];
    // 網格每格沿 b–c 對角線切成兩個三角形，這裡取所在三角形的平面高度，才會和畫出來的地面完全貼合
    return u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b - d);
  }
  function gradAt(x, z) {
    const e = 0.6;
    return { x: (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), z: (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e) };
  }
  function normalAt(x, z, out = new THREE.Vector3()) {
    const g = gradAt(x, z);
    return out.set(-g.x, 1, -g.z).normalize();
  }

  function surfaceAt(x, z) {
    const dp = distPath(x, z);
    if (dp.d > OB_DIST) return 'ob';
    for (const w of waters) if (Math.hypot(x - w.x, z - w.z) < w.r) return 'water';
    const dPin = Math.hypot(x - pinXZ.x, z - pinXZ.z);
    if (dPin < greenR) return 'green';
    for (const b of bunkers) if (Math.hypot(x - b.x, z - b.z) < b.r) return 'bunker';
    if (dPin < greenR + 3) return 'fringe';
    if (Math.abs(x) < 4 && Math.abs(z) < 5) return 'tee';
    if (spec.width > 0 ? (dp.d < spec.width / 2 && dp.t > 0.1) : (dp.d < 9 && dp.t > 0.78)) return 'fairway';
    return 'rough';
  }

  // —— 地形網格（頂點色）——
  const group = new THREE.Group();
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  const col = new Float32Array((nx + 1) * (nz + 1) * 3);
  const uvs = new Float32Array((nx + 1) * (nz + 1) * 2);
  const C = (hex) => new THREE.Color(hex);
  const cFA = C(th.fairwayA), cFB = C(th.fairwayB), cR = C(th.rough), cBeach = C(th.beach), cTmp = new THREE.Color();
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const k = j * (nx + 1) + i, x = minX + i * STEP, z = minZ + j * STEP, h = H[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      uvs[k * 2] = x / 7; uvs[k * 2 + 1] = z / 7;
      const dp = distPath(x, z), s = surfaceAt(x, z);
      if (s === 'fairway' || s === 'tee' || s === 'fringe' || s === 'green') cTmp.copy(Math.floor((dp.t * len) / 9) % 2 ? cFA : cFB).multiplyScalar(Math.floor((dp.t * len) / 9) % 2 ? 1.06 : 0.94);
      else { const n = 0.92 + 0.16 * Math.sin(x * 0.9 + z * 1.3) * Math.sin(x * 0.37 - z * 0.53); cTmp.copy(cR).multiplyScalar(n); }
      cTmp.lerp(cBeach, smooth(49, 56, dp.d));
      if (h < seaLevel + 0.4) cTmp.multiplyScalar(0.8);
      col[k * 3] = cTmp.r; col[k * 3 + 1] = cTmp.g; col[k * 3 + 2] = cTmp.b;
    }
  }
  const idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: grassTexture(), roughness: 0.95, metalness: 0 }));
  ground.receiveShadow = true;
  group.add(ground);

  // —— 貼地圓盤（果嶺、沙坑等，邊緣清晰）——
  function disc(cx, cz, r, color, yOff, flat = null, opts = {}) {
    const rings = flat != null ? 6 : Math.max(6, Math.ceil(r / 0.45)), segs = flat != null ? 48 : Math.max(48, Math.ceil((Math.PI * 2 * r) / 0.5)), p = [], ix = [], uv = [], us = opts.uvScale ?? 3;
    p.push(cx, (flat ?? heightAt(cx, cz)) + yOff, cz); uv.push(cx / us, cz / us);
    for (let ri = 1; ri <= rings; ri++) for (let si = 0; si < segs; si++) {
      const a = (si / segs) * Math.PI * 2, rr = (r * ri) / rings, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      p.push(x, (flat ?? heightAt(x, z)) + yOff, z); uv.push(x / us, z / us);
    }
    for (let si = 0; si < segs; si++) ix.push(0, 1 + ((si + 1) % segs), 1 + si);
    for (let ri = 1; ri < rings; ri++) for (let si = 0; si < segs; si++) {
      const a = 1 + (ri - 1) * segs + si, b = 1 + (ri - 1) * segs + ((si + 1) % segs), c = a + segs, d = b + segs;
      ix.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ix);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, map: opts.map ?? null, normalMap: opts.normalMap ?? null, roughness: opts.rough ?? 0.9, metalness: opts.metal ?? 0, transparent: !!opts.opacity, opacity: opts.opacity ?? 1, polygonOffset: true, polygonOffsetFactor: -2 - yOff * 20, polygonOffsetUnits: -2 }));
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  disc(pinXZ.x, pinXZ.z, greenR + 3, th.fringe, 0.03, null, { map: grassTexture(), uvScale: 5 });
  disc(pinXZ.x, pinXZ.z, greenR, th.green, 0.05, null, { map: greenTexture(), uvScale: 4 });
  for (const b of bunkers) {
    disc(b.x, b.z, b.r + 0.5, th.fringe, 0.035, null, { map: grassTexture(), uvScale: 5 }); // 沙坑外緣的草唇
    disc(b.x, b.z, b.r, th.sand, 0.045, null, { map: sandTexture(), uvScale: 2.5 });
  }
  const waterMeshes = waters.map((w) => disc(w.x, w.z, w.r + 1.5, th.water, 0, w.level, { rough: 0.08, metal: 0.3, opacity: 0.88, normalMap: waterNormal(), uvScale: 9 }));
  const gridPts = [];
  for (let a = -greenR; a <= greenR; a += 1.5) {
    const half = Math.sqrt(Math.max(0, greenR * greenR - a * a));
    for (let b = -half; b < half; b += 0.75) {
      const b2 = Math.min(half, b + 0.75);
      gridPts.push(pinXZ.x + a, heightAt(pinXZ.x + a, pinXZ.z + b) + 0.075, pinXZ.z + b, pinXZ.x + a, heightAt(pinXZ.x + a, pinXZ.z + b2) + 0.075, pinXZ.z + b2);
      gridPts.push(pinXZ.x + b, heightAt(pinXZ.x + b, pinXZ.z + a) + 0.075, pinXZ.z + a, pinXZ.x + b2, heightAt(pinXZ.x + b2, pinXZ.z + a) + 0.075, pinXZ.z + a);
    }
  }
  const greenGrid = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3)), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.38, depthWrite: false }));
  greenGrid.visible = false;
  group.add(greenGrid);
  const pinY = heightAt(pinXZ.x, pinXZ.z);
  const cup = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), new THREE.MeshBasicMaterial({ color: '#0b1a12', polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 }));
  cup.rotation.x = -Math.PI / 2;
  cup.position.set(pinXZ.x, pinY + 0.07, pinXZ.z);
  group.add(cup);

  // —— 發球台 ——
  const teeY = heightAt(0, 0);
  // 發球台：略高的草皮平台，套草紋並帶刈草條紋（短草，顏色比球道稍亮）
  const padGeo = new THREE.BoxGeometry(8, 0.14, 10, 8, 1, 10);
  const pp = padGeo.attributes.position, pu = padGeo.attributes.uv, padCol = new Float32Array(pp.count * 3);
  const cPadA = new THREE.Color(th.fairwayA).lerp(new THREE.Color(th.green), 0.35), cPadB = cPadA.clone().multiplyScalar(0.9);
  for (let k = 0; k < pp.count; k++) {
    pu.setXY(k, pp.getX(k) / 3.5, pp.getZ(k) / 3.5); // 與世界座標對齊的草紋
    const c = Math.floor((pp.getX(k) + 4.001) / 1) % 2 ? cPadA : cPadB; // 每 1m 一條刈草紋
    padCol[k * 3] = c.r; padCol[k * 3 + 1] = c.g; padCol[k * 3 + 2] = c.b;
  }
  padGeo.setAttribute('color', new THREE.BufferAttribute(padCol, 3));
  const teePad = new THREE.Mesh(padGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: grassTexture(), roughness: 0.95 }));
  teePad.position.set(0, teeY - 0.03, 0);
  teePad.receiveShadow = true;
  group.add(teePad);
  for (const sx of [-2.6, 2.6]) {
    const mk = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), new THREE.MeshStandardMaterial({ color: '#f4f1e6', roughness: 0.45 }));
    mk.position.set(sx, teeY + 0.12, 0.8);
    mk.castShadow = true;
    group.add(mk);
  }

  // —— 旗桿 ——
  const flag = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 8), new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.4 }));
  pole.position.y = 1.3;
  pole.castShadow = true;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.46, 8, 1), new THREE.MeshStandardMaterial({ color: '#ff3b30', side: THREE.DoubleSide, roughness: 0.7 }));
  cloth.geometry.translate(0.375, 0, 0);
  cloth.position.y = 2.34;
  cloth.castShadow = true;
  flag.add(pole, cloth);
  flag.position.set(pinXZ.x, pinY, pinXZ.z);
  flag.userData.cloth = cloth;
  group.add(flag);

  // —— 樹木（InstancedMesh）——
  const spots = [];
  for (let tries = 0; tries < 1400 && spots.length < 150; tries++) {
    const x = minX + rnd() * (maxX - minX), z = minZ + rnd() * (maxZ - minZ);
    const dp = distPath(x, z);
    const lo = (spec.width > 0 ? spec.width / 2 : 12) + 9;
    if (dp.d < lo || dp.d > 53) continue;
    if (surfaceAt(x, z) !== 'rough') continue;
    if (Math.hypot(x, z) < 14 || Math.hypot(x - pinXZ.x, z - pinXZ.z) < greenR + 10) continue;
    if (bunkers.some((b) => Math.hypot(x - b.x, z - b.z) < b.r + 4) || waters.some((w) => Math.hypot(x - w.x, z - w.z) < w.r + 5)) continue;
    spots.push({ x, z, y: heightAt(x, z), s: 0.8 + rnd() * 0.6, r: rnd() * 6.28 });
  }
  const treeGeo = course.tree === 'pine' ? pineGeometry(th) : palmGeometry(th);
  const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }), spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), tp = new THREE.Vector3();
  const treeMatrix = (t) => { q.setFromEuler(new THREE.Euler(0, t.r, 0)); return m4.compose(tp.set(t.x, t.y - 0.1, t.z), q, sc.set(t.s, t.s * (0.9 + (t.r % 1) * 0.3), t.s)); };
  spots.forEach((t, i) => trees.setMatrixAt(i, treeMatrix(t)));
  trees.castShadow = true; trees.receiveShadow = true;
  group.add(trees);

  // 灌木、岩石、花叢：點綴在長草區
  function scatter(geo, count, lo, hi, scaleLo, scaleHi, mat) {
    const list = [];
    for (let tries = 0; tries < count * 12 && list.length < count; tries++) {
      const x = minX + rnd() * (maxX - minX), z = minZ + rnd() * (maxZ - minZ), dp = distPath(x, z);
      if (dp.d < lo || dp.d > hi || surfaceAt(x, z) !== 'rough') continue;
      if (Math.hypot(x, z) < 9 || Math.hypot(x - pinXZ.x, z - pinXZ.z) < greenR + 5) continue;
      if (bunkers.some((b) => Math.hypot(x - b.x, z - b.z) < b.r + 2) || waters.some((w) => Math.hypot(x - w.x, z - w.z) < w.r + 3)) continue;
      list.push({ x, z, y: heightAt(x, z), s: scaleLo + rnd() * (scaleHi - scaleLo), r: rnd() * 6.28 });
    }
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((t, i) => { q.setFromEuler(new THREE.Euler(0, t.r, 0)); mesh.setMatrixAt(i, m4.compose(tp.set(t.x, t.y - 0.05, t.z), q, sc.setScalar(t.s))); });
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  }
  const fwHalf = spec.width > 0 ? spec.width / 2 : 10;
  const vegMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  scatter(bushGeometry(th), 90, fwHalf + 4, 55, 0.8, 1.9, vegMat);
  scatter(rockGeometry(course.id === 'volcano' ? '#4f4548' : '#9a968e'), course.id === 'volcano' ? 70 : 26, fwHalf + 3, 57, 0.6, 2.4, vegMat);
  scatter(flowerGeometry(), course.id === 'volcano' ? 20 : 70, fwHalf + 1.5, 40, 0.8, 1.4, vegMat);

  // 隱藏擋在鏡頭與目標之間的樹（a、b 為世界座標，只看水平距離）
  const hidden = new Uint8Array(spots.length);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function cullTrees(a, b, radius = 3.2) {
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    let changed = false;
    for (let i = 0; i < spots.length; i++) {
      const t = spots[i];
      const u = clamp(((t.x - a.x) * dx + (t.z - a.z) * dz) / l2, 0, 1);
      const h = Math.hypot(a.x + dx * u - t.x, a.z + dz * u - t.z) < radius * t.s ? 1 : 0;
      if (h === hidden[i]) continue;
      hidden[i] = h; changed = true;
      trees.setMatrixAt(i, h ? zero : treeMatrix(t));
    }
    if (changed) trees.instanceMatrix.needsUpdate = true;
  }

  const tee = new THREE.Vector3(0, teeY, 0);
  const pin = new THREE.Vector3(pinXZ.x, pinY, pinXZ.z);

  function dispose() {
    group.traverse((o) => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) m.dispose(); });
  }

  return { spec, group, heightAt, gradAt, normalAt, surfaceAt, distPath, pathPoint, tee, pin, flag, seaLevel, len, greenR, cullTrees, waterMeshes, greenGrid, path, bunkers, waters, dispose };
}
