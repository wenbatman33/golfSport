// 開發用：六位角色並排，逐一套用姿勢，用來檢查穿模與破面
// 用法：開 /pose-check.html，在主控台呼叫 setPose('cheerA')，或網址加 ?pose=cheerA&zoom=1（zoom=1 只看上半身）
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Golfer, POSES } from '../game/golfer.js';
import { CHARACTERS } from '../data/characters.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#7fb6e6'); // 淺藍底，破洞透出背景時一眼看得出來
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight('#ffffff', '#8fb58a', 1.2));
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.position.set(2, 5, 6); scene.add(sun);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
const q = new URLSearchParams(location.search);
const yawDeg = +(q.get('yaw') || 0);

const golfers = [];
const row = q.get('row'); // row=0 或 1：只看那一排三位的上半身放大圖
const list = row == null ? CHARACTERS : CHARACTERS.slice(+row * 3, +row * 3 + 3);
const DX = row == null ? 1.5 : 0.92, DY = 2.15;
await Promise.all(list.map(async (ch, i) => {
  const g = new Golfer();
  await g.load(ch);
  g.club.visible = false;
  if (row == null) g.root.position.set(((i % 3) - 1) * DX, -Math.floor(i / 3) * DY, 0);
  else g.root.position.set((i - 1) * DX, -ch.height * 0.8, 0); // 肩膀對齊 y≈0
  g.root.rotation.y = (yawDeg * Math.PI) / 180;
  scene.add(g.root);
  golfers.push(g);
}));

window.poseNames = Object.keys(POSES);
window.setPose = (name) => {
  if (!POSES[name]) return `沒有這個姿勢：${name}`;
  for (const g of golfers) { g.emote = null; g.applyBlend(name, name, 0); g.club.visible = false; }
  document.getElementById('t').textContent = `${name}${row != null ? ` · 第 ${+row + 1} 排` : ''}`;
  return name;
};
window.setYaw = (deg) => { for (const g of golfers) g.root.rotation.y = (deg * Math.PI) / 180; };
window.setPose(q.get('pose') || 'stand');

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight, a = w / h;
  renderer.setSize(w, h, false);
  let halfW, cy;
  if (row == null) { halfW = Math.max(2.3, 2.25 * a); cy = -0.12; } else { halfW = 1.45; cy = 0.02; }
  const halfH = halfW / a;
  camera.left = -halfW; camera.right = halfW; camera.top = cy + halfH; camera.bottom = cy - halfH;
  camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
renderer.setAnimationLoop(() => renderer.render(scene, camera));
window.ready = true;
