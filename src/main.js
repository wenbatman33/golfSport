// 角色展示／選擇頁：載入 public/models/characters/<id>.glb，沒有模型時先顯示概念圖
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CHARACTERS, STAT_LABELS } from './data/characters.js';
import { LAYOUT, SCENE, CHAR_TUNE, pickLayoutKey } from './data/layout.js';
import { createDevTool } from './dev/devTool.js';
import { createTitle } from './title.js';
import { COURSES, coursePar } from './game/courses.js';
import { startGame } from './game/game.js';
import { Golfer } from './game/golfer.js';
import { playBgm } from './audio/bgm.js';

// 概念圖（檔案不存在也不會報錯）
const conceptFiles = import.meta.glob('../assets/concepts/*.png', { eager: true, query: '?url', import: 'default' });
const conceptUrl = (id) => conceptFiles[`../assets/concepts/${id}.png`] || null;
const modelUrl = (id) => `${import.meta.env.BASE_URL}models/characters/${id}.glb`;

// —— 渲染器與場景 ——
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
controls.enableRotate = false; // 固定正面視角，不提供環繞
controls.enableZoom = false;
controls.enableDamping = true;
controls.minPolarAngle = Math.PI * 0.28;
controls.maxPolarAngle = Math.PI * 0.52;

const hemi = new THREE.HemisphereLight('#ffffff', '#8fb58a', 1);
const key = new THREE.DirectionalLight('#ffffff', 2);
key.position.set(3, 6, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -2.5;
key.shadow.camera.right = key.shadow.camera.top = 2.5;
key.shadow.bias = -0.0004;
key.shadow.radius = 6;
const rim = new THREE.DirectionalLight('#ffffff', 1.5);
rim.position.set(-4, 3.5, -5);
scene.add(hemi, key, rim);

// 展示台
const stageMat = new THREE.MeshStandardMaterial({ color: SCENE.stageColor, roughness: 0.85 });
const stageDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.45, 0.1, 96), stageMat);
stageDisc.position.y = -0.05;
stageDisc.receiveShadow = true;
const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.018, 12, 128), ringMat);
ring.rotation.x = Math.PI / 2;
ring.position.y = 0.004;
// 不用展示台：角色直接站在露台地板上，只留腳下的柔和陰影
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.32 }));
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);
let golfer = null; // 選角畫面的人物（帶待機動作）

const holder = new THREE.Group(); // 套用 CHAR_TUNE 的容器
scene.add(holder);

// —— 狀態 ——
let layoutKey = pickLayoutKey();
let layoutForced = false; // DEV 手動切版面後不再自動切
let current = CHARACTERS[0];
let loadToken = 0;
let mixer = null;
let actions = {};
let placeholder = null;
const gltfLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();

// —— 套用參數 ——
function applyLayout() {
  const L = LAYOUT[layoutKey];
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = L.camFov;
  // 保留使用者目前的水平旋轉角度
  const az = Math.atan2(camera.position.x, camera.position.z) || 0;
  controls.target.set(0, L.targetY, 0);
  camera.position.set(Math.sin(az) * L.camDist, L.camHeight, Math.cos(az) * L.camDist);
  controls.minDistance = L.camDist * 0.6;
  controls.maxDistance = L.camDist * 1.4;
  camera.setViewOffset(w, h, -L.viewShiftX * w, -L.viewShiftY * h, w, h);
  camera.updateProjectionMatrix();
  controls.update();
}

function applyScene() {
  renderer.toneMappingExposure = SCENE.exposure;
  scene.environmentIntensity = SCENE.envIntensity;
  hemi.intensity = SCENE.hemiIntensity;
  key.intensity = SCENE.keyIntensity; key.color.set(SCENE.keyColor);
  rim.intensity = SCENE.rimIntensity; rim.color.set(SCENE.rimColor);
  stageMat.color.set(SCENE.stageColor);
  document.documentElement.style.setProperty('--bg-top', SCENE.bgTop);
  document.documentElement.style.setProperty('--bg-bottom', SCENE.bgBottom);
  controls.autoRotate = SCENE.autoRotate && !placeholder;
  controls.autoRotateSpeed = SCENE.autoRotateSpeed;
}

function applyTune() {
  const t = CHAR_TUNE[current.id];
  holder.scale.setScalar(t.scale);
  holder.position.y = t.y;
  holder.rotation.y = THREE.MathUtils.degToRad(t.rotY);
}

// —— 載入角色 ——
function clearHolder() {
  mixer = null; actions = {}; placeholder = null; golfer = null;
  for (const child of [...holder.children]) {
    holder.remove(child);
    child.traverse((o) => {
      o.geometry?.dispose();
      for (const m of [].concat(o.material || [])) { m.map?.dispose(); m.dispose(); }
    });
  }
}

async function modelExists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok && !(r.headers.get('content-type') || '').includes('text/html'); // dev server 對缺檔會回 index.html
  } catch { return false; }
}

// 把模型縮放到角色身高、腳底貼地、水平置中
function fitModel(obj, height) {
  let box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  obj.scale.multiplyScalar(height / (size.y || 1));
  box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box.min.y;
}

function playClip(name) {
  if (!actions[name]) return;
  for (const a of Object.values(actions)) a.fadeOut(0.25);
  actions[name].reset().fadeIn(0.25).play();
}

async function selectCharacter(ch) {
  current = ch;
  const token = ++loadToken;
  renderInfo(ch, 'loading');
  const url = modelUrl(ch.id);
  const has = await modelExists(url);
  if (token !== loadToken) return;

  if (has) {
    try {
      const g = new Golfer();
      await g.load(ch);
      if (token !== loadToken) { g.dispose(); return; }
      clearHolder();
      g.club.visible = false;
      g.setEmote('idle');
      g.root.rotation.y = 0;
      holder.add(g.root);
      golfer = g;
      renderInfo(ch, 'ready');
    } catch (e) {
      console.error('模型載入失敗', ch.id, e);
      if (token !== loadToken) return;
      showPlaceholder(ch);
    }
  } else {
    showPlaceholder(ch);
  }
  applyTune();
  applyScene();
  dev.onCharChanged();
}

function showPlaceholder(ch) {
  clearHolder();
  const url = conceptUrl(ch.id);
  if (url) {
    const tex = texLoader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    const h = 2.05;
    placeholder = new THREE.Mesh(
      new THREE.PlaneGeometry(h * (2 / 3), h),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }),
    );
    placeholder.position.y = h / 2 + 0.01;
    holder.add(placeholder);
  }
  renderInfo(ch, url ? 'concept' : 'none');
}

// —— UI ——
const $ = (id) => document.getElementById(id);
const rosterEl = $('roster');
const statsEl = $('stats');

statsEl.innerHTML = STAT_LABELS.map((s) => `
  <div class="stat"><div>${s.zh}<small>${s.en}</small></div><div class="bar" data-k="${s.key}">${'<i></i>'.repeat(10)}</div><div class="num" data-n="${s.key}"></div></div>`).join('');

for (const ch of CHARACTERS) {
  const b = document.createElement('button');
  b.className = 'card';
  b.dataset.id = ch.id;
  b.style.setProperty('--c', ch.color);
  const img = conceptUrl(ch.id);
  if (img) b.style.setProperty('--face', `url("${img}")`);
  b.innerHTML = `<div class="tag"><b>${ch.zh}</b><span>${ch.en}</span></div>`;
  b.onclick = () => selectCharacter(ch);
  rosterEl.appendChild(b);
}

const STATE_TEXT = {
  loading: '加载中… LOADING',
  ready: '3D 模型已就绪 · MODEL READY',
  concept: '概念图预览 · 3D 模型待导入 MODEL PENDING',
  none: '概念图生成中 · CONCEPT PENDING',
};

function renderInfo(ch, state) {
  document.documentElement.style.setProperty('--accent', ch.color);
  ringMat.color.set(ch.color);
  $('cType').textContent = `${ch.typeZh} ${ch.typeEn}`;
  $('cZh').textContent = ch.zh;
  $('cEn').textContent = ch.en;
  $('cDesc').textContent = ch.desc;
  for (const s of STAT_LABELS) {
    [...statsEl.querySelector(`[data-k="${s.key}"]`).children].forEach((pip, i) => { pip.classList.toggle('on', i < ch.stats[s.key]); pip.style.transitionDelay = `${i * 25}ms`; }); // 固定十格，數值是幾就亮幾格
    statsEl.querySelector(`[data-n="${s.key}"]`).textContent = ch.stats[s.key];
  }
  const ms = $('modelState');
  ms.textContent = STATE_TEXT[state];
  ms.className = state === 'ready' ? 'ready' : '';
  for (const c of rosterEl.children) c.classList.toggle('on', c.dataset.id === ch.id);
}

// —— 封面 ——
const title = createTitle({
  onStart: () => { playBgm('menu'); }, // 第一次點擊後才能出聲
  isDragMode: () => dev.isDragMode(),
  onDragLogo: (dxVw, dyVh) => { // DEV 拖曳標誌
    const T = LAYOUT[layoutKey].title;
    T.logoX = +(T.logoX + dxVw).toFixed(2);
    T.logoY = +(T.logoY + dyVh).toFixed(2);
    applyTitle();
    dev.refresh();
  },
});
function applyTitle() { title.applyLayout(LAYOUT[layoutKey].title, layoutKey); }

// —— DEV 工具 ——
const dev = createDevTool({
  LAYOUT, SCENE, CHAR_TUNE, canvas, controls,
  getLayoutKey: () => layoutKey,
  setLayoutKey: (k) => { layoutKey = k; layoutForced = true; applyLayout(); applyTitle(); },
  getCharId: () => current.id,
  applyLayout, applyScene, applyTune, applyTitle,
  showTitle: () => title.show(),
  getClips: () => Object.keys(actions),
  playClip,
});
// 開發工具只在本機開發（npm run dev）時提供；正式版把齒輪按鈕拿掉，玩家打不開
if (import.meta.env.DEV) $('devBtn').onclick = () => dev.toggle(); else $('devBtn').remove();

// —— 球場選擇 → 進入遊戲 ——
let inGame = false;
function openCourseSelect() {
  const el = document.createElement('div');
  el.id = 'course-select';
  const UI = `${import.meta.env.BASE_URL}ui/`;
  el.innerHTML = `<div class="cs-box">
    <div class="cs-head"><b>选择球场</b><span>SELECT COURSE</span></div>
    <div class="cs-list">${COURSES.map((c) => `
    <button class="cs-card u-card" data-id="${c.id}" type="button">
      <div class="cs-art" style="--sky:linear-gradient(${c.theme.skyTop},${c.theme.skyBottom})"><img src="${UI}course_${c.id}.webp" alt="" onerror="this.remove()"></div>
      <div class="cs-holes"><b>${c.holes.length}</b><small>洞 HOLES</small></div>
      <div class="cs-body"><b>${c.zh}</b><span>${c.en}</span><p>${c.desc}</p>
        <div class="cs-meta"><span>PAR ${coursePar(c)}<em>${c.levelZh} ${c.levelEn}</em></span>
        <span class="cs-stars">${'★'.repeat(c.stars)}<s>${'★'.repeat(3 - c.stars)}</s></span></div></div>
    </button>`).join('')}</div><button class="u-btn ghost cs-back" type="button">返回<small>BACK</small></button></div>`;
  document.body.appendChild(el);
  el.querySelector('.cs-back').onclick = () => el.remove();
  for (const b of el.querySelectorAll('.cs-card')) b.onclick = () => { el.remove(); enterGame(COURSES.find((c) => c.id === b.dataset.id)); };
}
function enterGame(course) {
  inGame = true;
  renderer.setAnimationLoop(null); // 遊戲進行時暫停選角場景
  document.body.dataset.mode = 'game';
  startGame({ character: current, course, onExit: () => {
    inGame = false;
    document.body.dataset.mode = '';
    renderer.setAnimationLoop(loop);
    applyLayout();
    title.show();
    playBgm('menu');
  } }).then((g) => { if (import.meta.env.DEV) window.__game = g; }); // 只在本機開發時留給測試與除錯用，正式版不對外開放
}
$('confirmBtn').onclick = openCourseSelect;

window.addEventListener('resize', () => {
  if (!layoutForced) {
    const k = pickLayoutKey();
    if (k !== layoutKey) { layoutKey = k; dev.onLayoutChanged(); }
  }
  applyLayout();
  applyTitle();
});

// —— 主迴圈 ——
const clock = new THREE.Clock();
function loop() {
  const dt = clock.getDelta();
  mixer?.update(dt);
  golfer?.update(dt);
  controls.update();
  if (placeholder) { // 概念圖永遠面向鏡頭
    placeholder.rotation.y = Math.atan2(camera.position.x, camera.position.z) - holder.rotation.y;
  }
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(loop);

applyLayout();
applyScene();
applyTitle();
title.show();
selectCharacter(current);
