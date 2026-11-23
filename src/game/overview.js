// 全場總覽圖：把整座球場的球洞畫在同一張圖上，標出洞號與走向，目前這一洞以金色標示
// 林克斯球場用真實輪廓（links_data.js）；其他球場的每一洞是各自獨立的地形，這裡依球洞資料排成去程、回程兩排
import * as THREE from 'three';
import { LINKS_OVERVIEW } from './links_data.js';

const cache = new Map();
const pairs = (flat) => { const o = []; for (let i = 0; i < flat.length; i += 2) o.push([flat[i], flat[i + 1]]); return o; };

function buildModel(course) {
  if (course.overview) {
    const O = LINKS_OVERVIEW;
    return {
      real: true, north: O.north,
      fairPolys: O.fairways.map(pairs), greenPolys: O.greens.map(pairs), bunkers: O.bunkers, burn: O.burn.map(pairs),
      holes: O.holes.map((f) => ({ line: pairs(f) })),
      marks: [{ p: O.town, zh: '古镇', en: 'TOWN' }],
    };
  }
  // 路線規劃：從會館出發，每一洞接在上一洞果嶺旁邊，試很多個方向，挑「不跟其他球洞相撞、不離會館太遠」的那個；
  // 前九洞結束與最後一洞要繞回會館。用球場固定的亂數種子，所以每次畫出來都一樣
  let a = course.seed * 7919 + 13; const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const n = course.holes.length, total = course.holes.reduce((q, h) => q + h.len, 0), R = Math.sqrt((total * 175) / Math.PI) * (n > 9 ? 1.18 : 0.95);
  const placed = [], holes = [];
  let prev = { x: 0, y: 0 };
  course.holes.forEach((h, i) => {
    const P1 = { x: h.dog * 2, z: h.len * 0.5 }, P2 = { x: h.pinX, z: h.len };
    const pt = (t) => ({ x: 2 * (1 - t) * t * P1.x + t * t * P2.x, z: 2 * (1 - t) * t * P1.z + t * t * P2.z });
    const home = i === n - 1 || (n > 9 && i === 8); // 這一洞要打回會館
    let best = null;
    for (let k = 0; k < 520; k++) {
      const th = rnd() * 6.283, sa = rnd() * 6.283, sd = i === 0 ? 30 : 34 + rnd() * 22;
      const sx = prev.x + Math.cos(sa) * sd, sy = prev.y + Math.sin(sa) * sd, fx = Math.cos(th), fy = Math.sin(th);
      const G = (x, z) => [sx + fx * z - fy * x, sy + fy * z + fx * x];
      const smp = []; for (let q = 0; q <= 16; q++) { const p = pt(q / 16); smp.push(G(p.x, p.z)); }
      let sep = 1e9; for (const o of placed) for (const u of smp) { const d = Math.hypot(u[0] - o[0], u[1] - o[1]); if (d < sep) sep = d; }
      const end = smp[16], far = Math.max(...smp.map((u) => Math.hypot(u[0], u[1])));
      const score = Math.min(sep, 95) * 3 - Math.max(0, far - R) * 1.6 - (home ? Math.hypot(end[0], end[1]) * 0.9 : Math.hypot(end[0], end[1]) * 0.05 * (i / n)) - (sep < 72 ? 600 : 0);
      if (!best || score > best.score) best = { score, G, smp };
    }
    const { G, smp } = best; placed.push(...smp);
    const haz = ([t, off, r]) => { const p = pt(t), q = pt(Math.min(1, t + 0.01)), c = pt(Math.max(0, t - 0.01)), dx = q.x - c.x, dz = q.z - c.z, l = Math.hypot(dx, dz) || 1; return [...G(p.x + (dz / l) * off, p.z - (dx / l) * off), r]; };
    const from = h.width > 0 ? 0.1 : 0.78, line = [], fair = [];
    for (let k = 0; k <= 16; k++) { const p = pt(k / 16); line.push(G(p.x, p.z)); if (k / 16 >= from) fair.push(G(p.x, p.z)); }
    holes.push({ line, fair, width: h.width > 0 ? h.width : 18, green: [...G(P2.x, P2.z), h.greenR], bunkers: h.bunkers.map(haz), waters: h.water.map(haz), walk: [[prev.x, prev.y], line[0]] });
    prev = { x: smp[16][0], y: smp[16][1] };
  });
  // 樹：長在球道外、離球洞不太遠的地方
  const trees = [], near = (x, y) => { let m = 1e9; for (const o of placed) { const d = Math.hypot(x - o[0], y - o[1]); if (d < m) m = d; } return m; };
  for (let k = 0; k < 2600 && trees.length < 420; k++) { const o = placed[Math.floor(rnd() * placed.length)], an = rnd() * 6.283, d = 30 + rnd() * 62, x = o[0] + Math.cos(an) * d, y = o[1] + Math.sin(an) * d, m = near(x, y); if (m > 27 && m < 84 && Math.hypot(x, y) > 34) trees.push([x, y, 0.7 + rnd() * 0.7]); }
  return { real: false, holes, trees, marks: [], house: [0, 0], palm: course.tree !== 'pine', lava: course.feature === 'lava' };
}

// landscape：把圖轉 90 度（細長的球場在寬螢幕上比較好讀）
// ui：標記的放大倍率（畫布在小螢幕上會被縮小顯示，洞號要跟著放大才看得清楚）
export function drawOverview(cv, course, cur, landscape, ui = 1) {
  const key = course.id;
  if (!cache.has(key)) cache.set(key, buildModel(course));
  const M = cache.get(key), th = course.theme, R = (p) => (landscape ? [p[1], -p[0]] : p);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const h of M.holes) for (const p of h.line) { const q = R(p); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  const pad = M.real ? 70 : 185; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  const W = 1200, H = Math.round(Math.min(1500, Math.max(520, (W * (y1 - y0)) / (x1 - x0))));
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), k = Math.min(W / (x1 - x0), H / (y1 - y0)), ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
  const T = (p) => { const q = R(p); return [ox + (q[0] - x0) * k, H - oy - (q[1] - y0) * k]; };
  const shade = (hex, f) => { const c = new THREE.Color(hex); return f <= 1 ? c.multiplyScalar(f).getStyle() : c.lerp(new THREE.Color('#ffffff'), f - 1).getStyle(); };
  const poly = (pts, fill, stroke, lw = 1) => { g.beginPath(); pts.forEach((p, i) => { const [x, y] = T(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
  const line = (pts, col, lw, dash = null) => { g.beginPath(); pts.forEach((p, i) => { const [x, y] = T(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.strokeStyle = col; g.lineWidth = lw; g.lineCap = g.lineJoin = 'round'; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]); };
  const disc = (c, r, fill) => { const [x, y] = T(c); g.beginPath(); g.arc(x, y, Math.max(1.6, r * k), 0, 6.3); g.fillStyle = fill; g.fill(); };

  const base = '#' + new THREE.Color(th.rough).lerp(new THREE.Color(th.fairwayB), 0.45).getHexString();
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const speckle = (cnt) => { for (let i = 0; i < cnt; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rnd() * 0.04})`; g.beginPath(); g.arc(rnd() * W, rnd() * H, 1 + rnd() * 3, 0, 6.3); g.fill(); } };
  if (M.real) { // 內陸球場：整片都是草地
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, shade(base, 0.6)); bg.addColorStop(1, shade(base, 0.45));
    g.fillStyle = bg; g.fillRect(0, 0, W, H); speckle(900);
  } else { // 島嶼球場：海 → 淺灘 → 沙灘 → 長草，由球洞的走廊疊出自然的海岸線
    const sea = g.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85); sea.addColorStop(0, shade(th.sea, 1.12)); sea.addColorStop(1, shade(th.sea, 0.68));
    g.fillStyle = sea; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 2; g.lineCap = 'round';
    for (let i = 0; i < 150; i++) { const x = rnd() * W, y = rnd() * H, l = 10 + rnd() * 20; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 4, x + l, y); g.stroke(); }
    const land = (wid, col) => { for (const h of M.holes) { line(h.line, col, wid * k); line(h.walk, col, wid * k * 0.8); } };
    land(300, shade(th.sea, 1.3)); // 淺灘
    land(268, M.lava ? '#3a3034' : th.beach); land(248, M.lava ? '#4a3d40' : shade(th.beach, 1.12)); // 沙灘（火山島是黑色岩岸）
    land(214, shade(base, 0.62)); land(200, shade(base, 0.72)); land(108, shade(base, 0.86));
    // 樹林
    for (const [x, y, sc] of M.trees) {
      const [cx, cy] = T([x, y]), r = Math.max(3.2, 8.5 * k * sc);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.arc(cx + r * 0.25, cy + r * 0.3, r, 0, 6.3); g.fill();
      if (M.palm) { g.fillStyle = shade(th.leaf, 0.85); g.beginPath(); for (let q = 0; q < 12; q++) { const an = (q / 12) * 6.283 + x, rr = q % 2 ? r * 0.45 : r * 1.15; g.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); } g.fill(); g.fillStyle = shade(th.leaf, 1.2); g.beginPath(); g.arc(cx, cy, r * 0.32, 0, 6.3); g.fill(); }
      else { g.fillStyle = shade(th.leaf, 0.78); g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill(); g.fillStyle = shade(th.leaf, 1.12); g.beginPath(); g.arc(cx - r * 0.22, cy - r * 0.25, r * 0.55, 0, 6.3); g.fill(); }
    }
    // 球車道：上一洞果嶺 → 這一洞發球台
    for (const h of M.holes) line(h.walk, 'rgba(240,228,196,.85)', 2.2, [5, 5]);
  }

  if (M.real) {
    for (const p of M.fairPolys) poly(p, null, shade(base, 0.82), 22 * k + 6); // 球道外一圈較亮的半長草
    for (const p of M.fairPolys) poly(p, th.fairwayA, shade(th.fairwayB, 0.75), 1.5);
    for (const b of M.burn) { line(b, shade(th.water, 0.7), 5.5 * k + 2); line(b, th.water, 3.5 * k + 1); }
    for (const p of M.greenPolys) poly(p, th.green, shade(th.fringe, 0.8), 1.5);
    for (const b of M.bunkers) { disc(b, b[2] + 1.2, shade(th.sand, 0.72)); disc(b, b[2], th.sand); }
  } else {
    for (const h of M.holes) { line(h.fair, shade(th.fairwayB, 0.7), (h.width + 5) * k); line(h.fair, th.fairwayA, h.width * k); line(h.fair, shade(th.fairwayB, 0.94), h.width * k, [9 * k, 9 * k]); } // 虛線疊色＝割草條紋
    // 會館
    { const [cx, cy] = T(M.house), w = Math.max(22, 44 * k), hh = w * 0.62;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(cx - w / 2 + 3, cy - hh / 2 + 4, w, hh);
      g.fillStyle = '#f4ead2'; g.fillRect(cx - w / 2, cy - hh / 2, w, hh);
      g.fillStyle = '#b5553c'; g.beginPath(); g.moveTo(cx - w / 2 - 3, cy - hh / 2); g.lineTo(cx, cy - hh * 1.05); g.lineTo(cx + w / 2 + 3, cy - hh / 2); g.fill();
      g.fillStyle = 'rgba(250,247,238,.92)'; g.font = `600 ${Math.max(15, 17 * ui)}px ui-serif, Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText('会馆 CLUBHOUSE', cx, cy + hh / 2 + 6); }
    for (const h of M.holes) {
      for (const w of h.waters) { disc(w, w[2] + 1.6, shade(th.water, 0.7)); disc(w, w[2], th.water); }
      disc(h.green, h.green[2] + 3.5, th.fringe); disc(h.green, h.green[2], th.green);
      for (const b of h.bunkers) { disc(b, b[2] + 1, shade(th.sand, 0.72)); disc(b, b[2], th.sand); }
    }
  }
  // 地標文字
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const m of M.marks) { const [x, y] = T(m.p); g.fillStyle = 'rgba(250,247,238,.85)'; g.font = '600 20px ui-serif, Georgia, serif'; g.fillText(`${m.zh} ${m.en}`, Math.min(W - 80, Math.max(80, x)), Math.min(H - 20, Math.max(20, y))); }

  // 每洞的走向（虛線箭頭）、洞號與旗子
  const arrow = (pts, col, lw, dash) => {
    line(pts, col, lw, dash);
    const [ax, ay] = T(pts[pts.length - 2]), [bx, by] = T(pts[pts.length - 1]), a = Math.atan2(by - ay, bx - ax), s = lw * 3.2 + 5;
    g.fillStyle = col; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - Math.cos(a - 0.45) * s, by - Math.sin(a - 0.45) * s); g.lineTo(bx - Math.cos(a + 0.45) * s, by - Math.sin(a + 0.45) * s); g.fill();
  };
  M.holes.forEach((h, i) => { if (i !== cur) arrow(h.line, 'rgba(255,255,255,.78)', 2.2 * ui, [9 * ui, 7 * ui]); });
  if (M.holes[cur]) { arrow(M.holes[cur].line, 'rgba(20,40,25,.5)', 9 * ui); arrow(M.holes[cur].line, '#f3dc9a', 4.5 * ui); }
  M.holes.forEach((h, i) => {
    // 洞號放在發球台往前一小段的位置，才不會跟上一洞的果嶺疊在一起
    const a = T(h.line[0]), b = T(h.line[Math.min(h.line.length - 1, Math.max(1, Math.round(h.line.length * 0.18)))]), on = i === cur;
    const dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, x = a[0] + ((b[0] - a[0]) / dl) * 26 * ui, y = a[1] + ((b[1] - a[1]) / dl) * 26 * ui, r = (on ? 19 : 15) * ui;
    g.beginPath(); g.arc(x, y, r + 2.5, 0, 6.3); g.fillStyle = on ? '#8a6a1c' : 'rgba(10,40,25,.75)'; g.fill();
    g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fillStyle = on ? '#f3dc9a' : '#faf7ee'; g.fill();
    g.fillStyle = '#145a37'; g.font = `700 ${(on ? 21 : 17) * ui}px ui-sans-serif, system-ui, sans-serif`; g.fillText(String(i + 1), x, y + 1);
    const [px, py] = T(h.line[h.line.length - 1]);
    g.strokeStyle = '#fff'; g.lineWidth = 2 * ui; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - 17 * ui); g.stroke();
    g.fillStyle = on ? '#f3dc9a' : '#d8453a'; g.beginPath(); g.moveTo(px, py - 17 * ui); g.lineTo(px + 11 * ui, py - 13 * ui); g.lineTo(px, py - 9 * ui); g.fill();
  });
  // 指北針（只有真實球場才有方位）
  if (M.real) {
    const a = ((M.north + (landscape ? 90 : 0)) * Math.PI) / 180, cx = W - 46, cy = 46;
    g.save(); g.translate(cx, cy); g.rotate(a);
    g.fillStyle = 'rgba(10,40,25,.6)'; g.beginPath(); g.arc(0, 0, 28, 0, 6.3); g.fill();
    g.fillStyle = '#f3dc9a'; g.beginPath(); g.moveTo(0, -22); g.lineTo(8, 6); g.lineTo(0, 1); g.lineTo(-8, 6); g.fill();
    g.fillStyle = '#faf7ee'; g.font = '700 13px ui-sans-serif, system-ui, sans-serif'; g.fillText('N', 0, 16);
    g.restore();
  }
}
