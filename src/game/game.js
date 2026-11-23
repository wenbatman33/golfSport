// 遊戲主流程：開球 → 瞄準 → 力道條 → 揮桿 → 球飛行 → 進洞 → 計分卡 → 結算（輸贏）
import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CLUBS, LIE, SCORE_NAMES, coursePar } from './courses.js';
import { buildHole } from './terrain.js';
import { Ball, PHYS, BALL_R, solveSpeed, previewFlight, puttSpeedFor } from './physics.js';
import { Golfer } from './golfer.js';
import { Fx, sfx } from './fx.js';
import { buildBackdrop, loadSky, waterNormal } from './scenery.js';
import { playBgm, setBgmMuted, isMuted } from '../audio/bgm.js';
import { setMuted as setSfxMuted } from './fx.js';
import { GAME, SWING, pickLayoutKey } from '../data/layout.js';
import { CHARACTERS } from '../data/characters.js';
import './game.css';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtPar = (n) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`);
const ease = (t) => t * t * (3 - 2 * t);

export async function startGame({ character, course, onExit }) {
  // —— DOM ——
  const root = document.createElement('div');
  root.id = 'game';
  root.innerHTML = `
    <canvas id="g-canvas"></canvas>
    <div id="g-hud">
      <div class="g-player u-card"><div class="g-avatar" id="g-avatar"></div><div class="g-total" id="g-total">E</div><div class="g-pname"><b id="g-name"></b><span id="g-nameEn"></span></div><div class="g-strokeTag">第<b id="g-stroke">1</b>杆</div></div>
      <div class="g-rival"><span id="g-rivalName"></span><b id="g-rivalScore">E</b></div>
      <div class="g-points" id="g-points"></div>
      <div class="g-award" id="g-award"></div>
      <div class="g-mark g-bubble" id="g-bubble"></div>
      <button id="g-fast" type="button">快进<small>▶▶ FAST</small></button>
      <div class="g-holeCard u-card">
        <div><div class="g-holeTop"><small>HOLE</small><b id="g-holeNo"></b></div><div class="g-holeBot"><span class="u-tab" id="g-par"></span><span id="g-holeInfo"></span></div><small id="g-course"></small></div>
        <div><svg id="g-windArrow" viewBox="0 0 40 40"><path d="M20 4 L31 26 L20 21 L9 26 Z" fill="#1f7a4d"/><rect x="18.4" y="20" width="3.2" height="15" rx="1.6" fill="#1f7a4d"/></svg><span id="g-windSpeed"></span></div>
      </div>
      <button id="g-quit" type="button" title="退出 QUIT">✕</button>
      <button id="g-help" type="button" title="玩法说明 HOW TO PLAY">?</button>
      <button id="g-mute" type="button" title="声音 SOUND (M)">♪</button>
      <canvas id="g-map" width="180" height="300"></canvas>
      <div class="g-mark g-pinMark" id="g-pinMark"><i><svg viewBox="0 0 24 24"><path d="M7 3v18" stroke="#26343c" stroke-width="2" stroke-linecap="round"/><path d="M8 4l10 4-10 4z" fill="#c8463c"/></svg></i><span id="g-pinTag"></span></div>
      <div class="g-mark g-tgtMark" id="g-tgtMark"><b id="g-tgtTag"></b></div>
      <div class="g-dock u-card">
        <div class="g-club">
          <img class="g-clubIcon" id="g-clubIcon" alt="">
          <div class="g-clubText"><b id="g-clubId"></b><span id="g-clubName"></span><em id="g-clubDist"></em></div>
          <div class="g-clubNav"><button id="g-clubPrev" type="button">▲</button><button id="g-clubNext" type="button">▼</button></div>
        </div>
        <div class="g-cell g-remain"><span class="u-lab">剩余 REMAIN</span><b id="g-dist"></b></div>
        <div class="g-gauge">
          <div class="g-coach"><span data-s="idle"><b>1</b>开始</span><i>›</i><span data-s="up"><b>2</b>力量</span><i>›</i><span data-s="down"><b>3</b>击球点</span><em class="g-prompt" id="g-prompt"></em></div>
          <div class="g-meter" id="g-meter"><div class="g-track"><div class="g-fill" id="g-fill"></div><div class="g-zero"></div><div class="g-sweet" id="g-sweet"></div></div><div class="g-need" id="g-need"></div><div class="g-powerMark" id="g-powerMark"></div><div class="g-cursor" id="g-cursor"></div></div>
          <div class="g-ticks"><span id="g-tick2" style="left:0"></span><span id="g-tick1" style="left:45.45%"></span><span class="g-tSweet" style="left:81.82%">IMPACT</span></div>
        </div>
        <div class="g-cell g-spin" id="g-spin"><span class="u-lab">旋球 SPIN</span><div class="g-spinBtns"><button type="button" data-spin="1" title="上旋 TOPSPIN">▲</button><button type="button" data-spin="0" title="普通 NORMAL">●</button><button type="button" data-spin="-1" title="后旋 BACKSPIN">▼</button></div><b id="g-spinName"></b></div>
        <button class="g-cell g-power" id="g-power" type="button"><span class="u-lab">强力 POWER</span><i class="g-powerIcon">⚡</i><b id="g-powerLeft"></b></button>
        <div class="g-cell g-lie"><span class="u-lab" id="g-lie"></span><div class="g-lieView" id="g-lieView"></div><b id="g-liePct"></b></div>
        <button id="g-swing" type="button"><b id="g-swingZh">击球</b><small id="g-swingEn">SHOT</small></button>
      </div>
      <div class="g-fly u-card" id="g-fly"><span class="u-lab">飞行距离 CARRY</span><b id="g-flyNum">0.0</b><small>m</small></div>
      <div class="g-hint" id="g-hint"></div>
      <div class="g-toast" id="g-toast"></div>
    </div>
    <div class="g-overlay" id="g-tutor" hidden>
      <div class="g-board u-card g-tutorCard">
        <div class="g-boardHead"><b>点三下击球</b><span>3 TAPS TO SHOOT</span></div>
        <div class="g-tut">
          <div><i>1</i><div class="g-demo d1"><u></u></div><b>点一下</b><span>开始 START</span></div>
          <div><i>2</i><div class="g-demo d2"><u></u></div><b>再点一下</b><span>定力量 POWER</span></div>
          <div><i>3</i><div class="g-demo d3"><u></u></div><b>回到白色再点</b><span>击球 IMPACT</span></div>
        </div>
        <p class="g-tutNote">拖动画面 = 瞄准　·　越接近白色正中，球越直</p>
        <button class="u-btn" id="g-tutorOk" type="button">开始<small>GOT IT</small></button>
      </div>
    </div>
    <div class="g-overlay" id="g-loading"><div class="g-spinner"></div><p>加载中 LOADING…</p></div>
    <div class="g-overlay" id="g-card" hidden></div>
    <div class="g-overlay" id="g-result" hidden></div>`;
  document.body.appendChild(root);
  const $ = (id) => root.querySelector(`#${id}`);
  const canvas = $('g-canvas');

  // —— 渲染 ——
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  const th = course.theme;
  scene.fog = new THREE.Fog(th.fog, 180, 900);

  // 天空球（上下漸層）
  const skyGeo = new THREE.SphereGeometry(1800, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.56); // 只做上半球，全景圖的底邊落在地平線
  const skyCol = [], cTop = new THREE.Color(th.skyTop), cBot = new THREE.Color(th.skyBottom), cT = new THREE.Color();
  for (let i = 0; i < skyGeo.attributes.position.count; i++) {
    const y = skyGeo.attributes.position.getY(i) / 1800;
    cT.copy(cBot).lerp(cTop, clamp(y * 1.6 + 0.05, 0, 1));
    skyCol.push(cT.r, cT.g, cT.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyCol, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, toneMapped: false }));
  scene.add(sky);
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, fog: false });
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group(), a = (i / 16) * Math.PI * 2 + Math.sin(i * 7.3), r = 700 + (i % 5) * 110;
    for (let k = 0; k < 5; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(30 + ((i * 13 + k * 7) % 22), 10, 8), cloudMat); s.position.set(k * 34 - 70, ((k * 17) % 14) - 4, ((k * 29) % 30) - 15); s.scale.y = 0.55; g.add(s); }
    g.position.set(Math.cos(a) * r, 150 + (i % 4) * 45, Math.sin(a) * r);
    clouds.add(g);
  }
  scene.add(clouds);
  loadSky(course, sky, () => { clouds.visible = false; }); // 手繪天空到位後換掉幾何雲
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: th.sea, roughness: 0.12, metalness: 0.35, normalMap: waterNormal(), normalScale: new THREE.Vector2(0.6, 0.6) }));
  const seaUv = sea.geometry.attributes.uv; for (let i = 0; i < seaUv.count; i++) seaUv.setXY(i, seaUv.getX(i) * 140, seaUv.getY(i) * 140);
  let backdrop = null;
  sea.rotation.x = -Math.PI / 2;
  scene.add(sea);

  const hemi = new THREE.HemisphereLight('#ffffff', '#6f9a66', 0.95);
  const sun = new THREE.DirectionalLight(th.sun, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 160 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  scene.add(hemi, sun, sun.target);
  const SUN_OFF = new THREE.Vector3(-34, 62, -28);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 4000);
  const camPos = new THREE.Vector3(0, 30, -30), camLook = new THREE.Vector3();
  const camPosT = new THREE.Vector3(), camLookT = new THREE.Vector3();

  // —— 球 ——
  // 目前輪到的玩家的球、球員等（由 setActive 切換）
  let P = null, ball = null, ballMesh = null, ballDot = null, golfer = null, stats = null, powerFactor = 1, lastPos = null, scores = null;
  const ballGeo = new THREE.SphereGeometry(0.045, 20, 14), dotGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const fx = new Fx(scene);
  let slowT = 0, whooshed = false;
  const aimLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 2.2, gapSize: 1.6, transparent: true, opacity: 0.85, fog: false }));
  aimLine.frustumCulled = false;
  const aimRing = new THREE.Mesh(new THREE.RingGeometry(1.25, 2.0, 48), new THREE.MeshBasicMaterial({ color: '#ffe14a', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -12 }));
  aimRing.rotation.x = -Math.PI / 2;
  // 擊球路徑：一串沿彈道流動的圓點（取代細線，遠近維持相同的畫面大小）
  const DOTS = 46;
  const aimDots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false, toneMapped: false }), DOTS);
  aimDots.frustumCulled = false;
  const aimHalo = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: '#14402a', fog: false, toneMapped: false, side: THREE.BackSide }), DOTS); // 只畫背面，形成白點外的一圈深色描邊
  aimHalo.frustumCulled = false; aimHalo.renderOrder = -1;
  let aimPts = [], aimLen = [];
  aimLine.material.opacity = 0; // 舊的細線不再顯示，只保留做可見性控制
  scene.add(aimLine, aimRing, aimDots, aimHalo);

  // —— 狀態 ——
  let spinMode = 0, powerShot = false, powerLeft = Math.max(2, Math.round(course.holes.length / 2)), tutorOpen = false;
  const rivalChar = CHARACTERS.filter((c) => c.id !== character.id)[Math.floor(Math.random() * (CHARACTERS.length - 1))];
  // 玩家：你與對手各有自己的球、球員、成績
  const mkPlayer = (ch, ai) => {
    const b = new Ball();
    const mesh = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color: ai ? '#ffe7a0' : '#ffffff', roughness: 0.35 }));
    const dot = new THREE.Points(dotGeo, new THREE.PointsMaterial({ color: ai ? '#ffd45a' : '#ffffff', size: 5, sizeAttenuation: false, fog: false }));
    mesh.castShadow = true;
    const g = new Golfer();
    scene.add(mesh, dot, g.root);
    b.onBounce = (surf, sp, p) => { fx.land(p, surf, sp / 12); if (surf === 'bunker') sfx.sand(); else sfx.bounce(sp / 8); };
    return { ch, ai, ball: b, mesh, dot, golfer: g, stats: ch.stats, powerFactor: 0.82 + ch.stats.power * 0.03, lastPos: new THREE.Vector3(), scores: [], strokes: 0, done: false, points: 0, shotLie: 'tee' };
  };
  const players = [mkPlayer(character, false), mkPlayer(rivalChar, true)];
  const me = players[0], rival = players[1];
  let teeOrder = [me, rival], aiFast = false;
  function setActive(pl) { P = pl; ball = pl.ball; ballMesh = pl.mesh; ballDot = pl.dot; golfer = pl.golfer; stats = pl.stats; powerFactor = pl.powerFactor; lastPos = pl.lastPos; scores = pl.scores; }
  setActive(me);
  const diffOf = (pl, n = pl.scores.length) => pl.scores.slice(0, n).reduce((a, v, i) => a + v - course.holes[i].par, 0);
  let layoutKey = pickLayoutKey();
  let holeIdx = 0, hole = null, phase = 'loading';
  let yaw = 0, clubs = [], clubIdx = 0, lie = 'tee', previewDirty = true, landing = null;
  const wind = new THREE.Vector3();
  const meter = { mode: 'idle', pos: 0, power: 0 };
  const swing = { t: 0, shot: null, launched: false };
  let phaseT = 0, afterTimer = 0, afterFn = null, toastTimer = 0, disposed = false, devScrub = -1;
  const aimDir = new THREE.Vector3(0, 0, 1);

  const after = (sec, fn) => { afterTimer = sec; afterFn = fn; };
  const timers = [];
  const after2 = (sec, fn) => timers.push({ t: sec, fn }); // 不互相覆蓋的延遲呼叫
  const UI = `${import.meta.env.BASE_URL}ui/`;
  const faces = import.meta.glob('../../assets/concepts/*.png', { eager: true, query: '?url', import: 'default' });
  const faceOf = (id) => faces[`../../assets/concepts/${id}.png`] || '';
  const letters = (t) => [...t].map((ch, i) => (ch === ' ' ? '<i class="sp"></i>' : `<i style="--i:${i}">${ch}</i>`)).join('');
  const TONE = { call_hio: 'great', call_albatross: 'great', call_eagle: 'great', call_birdie: 'great', call_perfect: 'great', call_par: 'good', call_nice: 'good' };
  // 大字用英文專業用語（純 ASCII 時），中文放在下方小標；數字或含中文時反過來
  function say(id, zh, en, sec = 2.2, cls = '') {
    const ascii = /^[\x20-\x7e]+$/.test(en || '') && !/^[0-9]/.test(zh);
    const big = ascii ? en : zh, sub = ascii ? zh : en;
    const tone = TONE[id] || (cls.includes('bad') ? 'cool' : 'plain');
    toast(`<div class="u-word t-${tone}">${letters(big)}</div>${sub ? `<span class="g-sub">${sub}</span>` : ''}`, sec, cls);
  }
  const CLUB_ICON = { '1W': 'wood', '3W': 'wood', '5I': 'iron', '7I': 'iron', '9I': 'iron', PW: 'wedge', SW: 'wedge', PT: 'putter' };
  const TURF = { tee: [th.fairwayA, '38%', '0%'], fairway: [th.fairwayA, '38%', '0%'], fringe: [th.fringe, '38%', '0%'], green: [th.green, '40%', '0%'], rough: [th.rough, '26%', '30%'], bunker: [th.sand, '22%', '22%'] };
  function toast(html, sec = 2.2, cls = '') {
    const el = $('g-toast');
    el.className = `g-toast ${cls}`;
    el.innerHTML = html;
    void el.offsetWidth; // 重新觸發砸入動畫
    el.classList.add('show');
    toastTimer = sec;
  }
  const distToPin = () => Math.hypot(ball.pos.x - hole.pin.x, ball.pos.z - hole.pin.z);
  const totalDiff = () => diffOf(P);
  const pinDist = (pl) => Math.hypot(pl.ball.pos.x - hole.pin.x, pl.ball.pos.z - hole.pin.z);
  // 玩家條：顯示目前擊球的人；下方小條顯示另一位
  function updatePlayerUI() {
    const o = players.find((x) => x !== P);
    $('g-avatar').style.backgroundImage = `url("${faceOf(P.ch.id)}")`;
    $('g-name').textContent = P.ch.zh; $('g-nameEn').textContent = P.ai ? '对手 RIVAL' : P.ch.en;
    $('g-total').textContent = fmtPar(diffOf(P));
    $('g-stroke').textContent = P.strokes + 1;
    $('g-rivalName').textContent = `${o.ai ? '对手' : '你'} ${o.ch.zh} · ${o.done ? '已进洞' : `第 ${o.strokes + 1} 杆`}`;
    $('g-rivalScore').textContent = fmtPar(diffOf(o));
    $('g-points').textContent = `技术分 SKILL ${me.points}`;
    root.dataset.ai = P.ai ? '1' : '';
  }
  // 技術分：好球的獎勵
  function award(pl, pts, zh, en) {
    pl.points += pts;
    $('g-points').textContent = `技术分 SKILL ${me.points}`;
    if (pl !== me) return;
    const el = $('g-award');
    el.innerHTML = `<b>+${pts}</b>${zh}<small>${en}</small>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  // 表情泡泡
  const bubbles = [];
  function bubble(pl, emoji, sec = 2.2) { bubbles.length = 0; bubbles.push({ pl, t: sec }); $('g-bubble').textContent = emoji; $('g-bubble').classList.add('show'); }
  // 沒輪到的人站到一旁等待
  function parkOthers() {
    for (const pl of players) {
      if (pl === P) continue;
      const a = P.ball.pos, b = pl.ball.pos, pos = new THREE.Vector3();
      const toPin = new THREE.Vector3(hole.pin.x - a.x, 0, hole.pin.z - a.z).normalize(), side = new THREE.Vector3(-toPin.z, 0, toPin.x);
      if (pl.done || b.distanceTo(a) < 5) pos.copy(a).addScaledVector(toPin, -1.6).addScaledVector(side, -3.6); // 球很近（例如發球台）或已進洞：站在擊球者旁邊
      else pos.copy(b).addScaledVector(side, -0.9);
      pos.y = hole.heightAt(pos.x, pos.z) + 0.045;
      pl.golfer.face(pos, new THREE.Vector3(a.x - pos.x, 0, a.z - pos.z).normalize());
      pl.golfer.setEmote('idle');
    }
  }
  // 決定下一位擊球者：都還沒開球照發球順序，之後離洞遠的先打
  function nextTurn() {
    const left = players.filter((x) => !x.done);
    if (!left.length) { showCard(); return; }
    const pl = left.some((x) => x.strokes === 0) ? teeOrder.find((x) => !x.done && x.strokes === 0) : left.reduce((x, y) => (pinDist(x) >= pinDist(y) ? x : y));
    setActive(pl);
    parkOthers();
    updatePlayerUI();
    beginAim();
  }
  // 對手 AI：選好方向與力量後自動擊球
  const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 1.2;
  function aiShoot() {
    if (phase !== 'ai') return;
    const c = clubs[clubIdx], d = distToPin();
    let power, y0 = yaw;
    if (c.putter) power = clamp((d * 1.07 + Math.max(0, hole.pin.y - ball.pos.y) * 9) / puttMax(), 0.08, 1);
    else {
      power = clamp((d * 0.96) / clubMax(c), 0.15, 1);
      const rt = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
      y0 += wind.dot(rt) * 0.0035 * (d / 100); // 稍微逆風修正
      // 避開水障礙與出界：落點危險就往兩側或縮短力量試試
      const safe = (yy, pw) => { const dir = new THREE.Vector3(Math.sin(yy), 0, Math.cos(yy)), pts = previewFlight(ball.pos, dir, solveSpeed(Math.max(4, clubMax(c) * pw), c.loft), c.loft, hole, wind), e = pts[pts.length - 1], sf = hole.surfaceAt(e.x, e.z); return sf !== 'water' && sf !== 'ob'; };
      const tries = [[0, 1], [0.1, 1], [-0.1, 1], [0, 0.8], [0.2, 0.9], [-0.2, 0.9], [0, 0.6]];
      const ok = tries.find(([dy, k]) => safe(y0 + dy, power * k));
      if (ok) { y0 += ok[0]; power *= ok[1]; }
      power = clamp(power * (1 + gauss() * 0.035 * (1 + (10 - stats.accuracy) / 8)), 0.12, 1);
    }
    yaw = y0;
    meter.power = power;
    commitShot(clamp(gauss() * (c.putter ? (11 - stats.putting) / 9 : (11 - stats.accuracy) / 8), -1.5, 1.5));
  }

  // —— 球洞載入 ——
  function loadHole(i) {
    if (hole) { scene.remove(hole.group); hole.dispose(); }
    holeIdx = i;
    hole = buildHole(course, i);
    scene.add(hole.group);
    sea.position.y = hole.seaLevel;
    if (!backdrop) { backdrop = buildBackdrop(course, hole.seaLevel); scene.add(backdrop); }
    const [ws, wd] = hole.spec.wind;
    wind.set(Math.sin((wd * Math.PI) / 180) * ws, 0, Math.cos((wd * Math.PI) / 180) * ws);
    // 發球順序：第一洞你先，之後上一洞成績好的先（榮譽發球）
    teeOrder = i === 0 ? [me, rival] : [...players].sort((a, b) => a.scores[i - 1] - b.scores[i - 1]);
    for (const pl of players) {
      pl.strokes = 0; pl.done = false; pl.mesh.visible = pl.dot.visible = true;
      pl.ball.place(new THREE.Vector3(pl === teeOrder[0] ? 0 : 0.9, hole.tee.y + BALL_R, pl === teeOrder[0] ? 0 : -0.6));
      pl.lastPos.copy(pl.ball.pos);
    }
    setActive(teeOrder[0]);
    fx.resetTrail();
    $('g-holeNo').textContent = i + 1;
    $('g-par').textContent = `PAR ${hole.spec.par}`;
    $('g-holeInfo').textContent = `${hole.len} m`;
    $('g-course').textContent = `${course.zh} ${course.en} · ${i + 1}/${course.holes.length}`;
    $('g-windSpeed').textContent = `${ws} m`;
    updatePlayerUI();
    // 開場鏡頭：從果嶺上空飛回發球台
    phase = 'intro'; phaseT = 0;
    yaw = Math.atan2(hole.pin.x, hole.pin.z);
    golfer.place(ball.pos, aimDir.set(Math.sin(yaw), 0, Math.cos(yaw)), false, hole.heightAt);
    parkOthers();
    camPos.set(hole.pin.x + 18, hole.pin.y + 26, hole.pin.z + 34);
    camLook.copy(hole.pin);
    root.dataset.phase = 'intro';
    say(null, `HOLE ${i + 1}`, `PAR ${hole.spec.par} · ${hole.len} m`, 2.6, 'big');
  }

  function clubMax(c) {
    const l = LIE[lie] || LIE.fairway;
    const k = lie === 'bunker' && c.id === 'SW' ? 0.92 : l.dist;
    return c.carry * powerFactor * k * (powerShot && !c.putter ? 1.1 : 1);
  }

  function beginAim() {
    lie = hole.surfaceAt(ball.pos.x, ball.pos.z);
    if (!LIE[lie]) lie = 'rough';
    const d = distToPin();
    clubs = lie === 'green' ? CLUBS.filter((c) => c.putter) : CLUBS.filter((c) => (c.putter ? lie === 'fringe' : !c.teeOnly || lie === 'tee'));
    clubIdx = 0;
    if (lie !== 'green') {
      const cand = clubs.map((c, i) => [c, i]).filter(([c]) => !c.putter);
      let pick = cand[0];
      for (const ci of cand) if (clubMax(ci[0]) >= d * 0.96) pick = ci; // 清單由遠到近，取剛好夠的最短桿
      clubIdx = pick[1];
    }
    yaw = Math.atan2(hole.pin.x - ball.pos.x, hole.pin.z - ball.pos.z);
    meter.mode = 'idle'; meter.pos = 0; meter.power = 0;
    spinMode = 0; powerShot = false;
    fx.resetTrail(); // 清掉上一桿的球軌跡
    phase = 'aim'; phaseT = 0; previewDirty = true;
    root.dataset.phase = 'aim';
    $('g-stroke').textContent = P.strokes + 1;
    $('g-lie').textContent = `${LIE[lie].zh} ${LIE[lie].en}`;
    $('g-liePct').textContent = `${Math.round(LIE[lie].dist * 100)}%`;
    const tf = TURF[lie] || TURF.fairway, lv = $('g-lieView').style;
    lv.setProperty('--turf', tf[0]); lv.setProperty('--sink', tf[1]); lv.setProperty('--grass', tf[2]);
    $('g-dist').textContent = d < 30 ? `${d.toFixed(1)} m` : `${Math.round(d)} m`;
    $('g-hint').textContent = '';
    updateClubUI();
    updateOptsUI();
    updateMeterUI();
    if (P.ai) { // 對手回合：看他站位一下再自動擊球
      phase = 'ai'; root.dataset.phase = 'ai';
      say(null, `${P.ch.zh} 击球`, `RIVAL · ${clubs[clubIdx].en}`, 1.3);
      after(1.5, aiShoot);
    } else if (!tutorSeen()) showTutor();
  }

  function updateClubUI() {
    const c = clubs[clubIdx];
    $('g-clubId').textContent = c.id;
    $('g-clubIcon').src = `${UI}icon_${CLUB_ICON[c.id]}.webp`;
    $('g-clubName').textContent = `${c.zh} ${c.en}`;
    const far = c.putter ? puttMax() : clubMax(c);
    $('g-clubDist').textContent = `${far.toFixed(far < 20 ? 1 : 0)} m`;
    $('g-tick2').textContent = `${far.toFixed(far < 20 ? 1 : 0)} m`;
    $('g-tick1').textContent = `${(far / 2).toFixed(far < 20 ? 1 : 0)} m`;
    hole.greenGrid.visible = !!c.putter;
    $('g-clubPrev').disabled = $('g-clubNext').disabled = clubs.length < 2;
    golfer.place(ball.pos, aimDir.set(Math.sin(yaw), 0, Math.cos(yaw)), !!c.putter, hole.heightAt);
    previewDirty = true;
    updateOptsUI(); updateMeterUI();
  }
  const puttMax = () => clamp(distToPin() * 1.6, 3, 45);

  function updatePreview() {
    previewDirty = false;
    const c = clubs[clubIdx];
    aimDir.set(Math.sin(yaw), 0, Math.cos(yaw));
    let pts;
    if (c.putter) {
      const n = 24, L = puttMax();
      pts = Array.from({ length: n + 1 }, (_, i) => { const x = ball.pos.x + aimDir.x * (L * i) / n, z = ball.pos.z + aimDir.z * (L * i) / n; return new THREE.Vector3(x, hole.heightAt(x, z) + 0.06, z); });
    } else pts = previewFlight(ball.pos, aimDir, solveSpeed(clubMax(c), c.loft), c.loft, hole, wind);
    aimLine.geometry.dispose();
    aimLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    aimLine.computeLineDistances();
    landing = pts[pts.length - 1];
    aimPts = pts; aimLen = [0];
    for (let i = 1; i < pts.length; i++) aimLen.push(aimLen[i - 1] + pts[i].distanceTo(pts[i - 1]));
    aimRing.position.set(landing.x, landing.y + 0.08, landing.z);
    aimRing.scale.setScalar(c.putter ? 0.25 : 1);
    const ld = Math.hypot(landing.x - ball.pos.x, landing.z - ball.pos.z);
    $('g-tgtTag').textContent = `${ld.toFixed(ld < 20 ? 1 : 0)} m`;
    drawMap();
    golfer.place(ball.pos, aimDir, !!c.putter, hole.heightAt);
  }

  // —— 擊球量表：擊球點在右端，游標往左跑到 100% 再折返 ——
  const sweetHalf = () => (powerShot && !clubs[clubIdx]?.putter ? 0.062 : 0.1); // 擊球點容許範圍（強力擊球較窄）
  const needPower = () => { const c = clubs[clubIdx]; if (!c) return 0; return clamp(c.putter ? distToPin() / puttMax() : (distToPin() * 0.96) / clubMax(c), 0.05, 1); };
  function updateMeterUI() {
    const P = (v) => ((v + 0.1) / 1.1) * 100; // 距右端的百分比
    $('g-cursor').style.left = `${100 - P(meter.pos)}%`;
    $('g-fill').style.width = `${P(meter.mode === 'down' || meter.mode === 'done' ? meter.power : meter.pos)}%`;
    $('g-powerMark').style.left = `${100 - P(meter.power)}%`;
    $('g-powerMark').style.opacity = meter.mode === 'down' || meter.mode === 'done' ? 1 : 0;
    const sw = (sweetHalf() / 1.1) * 100;
    $('g-sweet').style.right = `${P(0.1) - sw}%`; $('g-sweet').style.width = `${sw * 2}%`;
    const need = needPower();
    $('g-need').style.left = `${100 - P(need)}%`;
    $('g-need').style.opacity = meter.mode === 'idle' || meter.mode === 'up' ? 1 : 0.25;
    root.dataset.step = meter.mode;
    $('g-prompt').textContent = { idle: '点一下开始', up: '再点一下', down: '回到白色再点！', done: '' }[meter.mode];
    const zh = { idle: '击球', up: '力量', down: '击球点', done: '…' }[meter.mode], en = { idle: 'SHOT', up: 'POWER', down: 'IMPACT', done: '' }[meter.mode];
    $('g-swingZh').textContent = zh; $('g-swingEn').textContent = en;
  }
  function updateOptsUI() {
    const putt = !!clubs[clubIdx]?.putter;
    $('g-spin').style.display = $('g-power').style.display = putt ? 'none' : '';
    for (const b of root.querySelectorAll('#g-spin button')) b.classList.toggle('on', +b.dataset.spin === spinMode);
    $('g-spinName').textContent = spinMode > 0 ? '上旋' : spinMode < 0 ? '后旋' : '普通';
    $('g-power').classList.toggle('on', powerShot);
    $('g-power').disabled = powerLeft <= 0;
    $('g-powerLeft').textContent = powerShot ? `ON · ${powerLeft}` : `× ${powerLeft}`;
  }
  const tutorSeen = () => { try { return localStorage.getItem('golf_tutor_v1') === '1'; } catch { return true; } };
  function showTutor() { tutorOpen = true; $('g-tutor').hidden = false; }
  function hideTutor() { tutorOpen = false; $('g-tutor').hidden = true; try { localStorage.setItem('golf_tutor_v1', '1'); } catch {} }
  function pressSwing() {
    if (phase !== 'aim' || tutorOpen || P.ai) return;
    sfx.unlock();
    if (meter.mode === 'idle') { meter.mode = 'up'; meter.pos = 0; sfx.tick(); }
    else if (meter.mode === 'up') { meter.power = clamp(meter.pos, 0.06, 1); meter.mode = 'down'; sfx.meterSet(); }
    else if (meter.mode === 'down') finishMeter(meter.pos);
    updateMeterUI();
  }
  function finishMeter(pos) { commitShot(clamp((pos - 0.1) / sweetHalf(), -1.6, 1.6)); }
  function commitShot(e) { // e：偏離擊球點的程度（0 為正中）
    meter.mode = 'done';
    const c = clubs[clubIdx];
    const shot = { club: c, power: meter.power, err: e, spin: Math.abs(e) < 0.6 ? spinMode : 0, quality: Math.abs(e) < 0.18 ? 'perfect' : Math.abs(e) < 0.6 ? 'nice' : 'miss' };
    if (c.putter) {
      const maxErr = (11 - stats.putting) * 0.4;
      shot.yaw = yaw + (e * maxErr * Math.PI) / 180;
      shot.speed = puttSpeedFor(puttMax() * meter.power);
    } else {
      const maxErr = ((11 - stats.accuracy) * 0.7 + 1) * (LIE[lie]?.err ?? 1);
      shot.yaw = yaw + (e * maxErr * Math.PI) / 180;
      shot.speed = solveSpeed(Math.max(4, clubMax(c) * meter.power), c.loft);
      shot.spinS = e * 0.9;
    }
    swing.t = 0; swing.shot = shot; swing.launched = false; whooshed = false;
    phase = 'swing'; root.dataset.phase = 'swing';
    aimLine.visible = aimRing.visible = false;
    if (!P.ai) {
      if (Math.abs(e) < 0.18) { say('call_perfect', '完美击球', 'PERFECT!', 1.4); award(P, 30, '完美击球', 'PERFECT'); }
      else if (Math.abs(e) < 0.6) { say('call_nice', '好球', 'NICE SHOT', 1.3); award(P, 10, '好球', 'NICE'); }
      else say(null, e > 0 ? '偏左' : '偏右', e > 0 ? 'PULL' : 'PUSH', 1.3, 'bad');
    }
  }

  function launch() {
    const s = swing.shot;
    swing.launched = true;
    P.strokes++;
    lastPos.copy(ball.pos);
    P.shotLie = lie;
    $('g-stroke').textContent = P.strokes;
    const dir = new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw));
    const quality = s.quality;
    if (s.club.putter) { ball.putt(dir, s.speed); sfx.putt(); }
    else {
      ball.launch(dir, s.speed, s.club.loft, s.spinS, stats.spin, s.spin);
      if (powerShot) { powerLeft--; powerShot = false; }
      fx.impact(ballMesh.position, dir, quality, lie);
      sfx.hit(quality === 'perfect'); if (lie === 'bunker') sfx.sand();
      slowT = quality === 'perfect' ? 0.16 : 0.07; // 擊球瞬間的短暫慢動作
    }
    fx.resetTrail();
    phase = 'flight'; root.dataset.phase = 'flight';
    $('g-hint').textContent = '';
  }

  function onBallEvent(ev, shot) {
    const shotDist = Math.hypot(ball.pos.x - lastPos.x, ball.pos.z - lastPos.z);
    const other = players.find((x) => x !== P);
    const cheerOther = () => { other.golfer.setEmote('cheer'); bubble(other, '👏'); sfx.cheer(); after2(2.2, () => { if (other !== P) other.golfer.setEmote('idle'); }); };
    if (ev === 'holed') {
      ballMesh.visible = ballDot.visible = false;
      fx.cupIn(hole.pin); sfx.cup();
      const diff = P.strokes - hole.spec.par;
      const nm = P.strokes === 1 ? { zh: '一杆进洞', en: 'HOLE IN ONE' } : SCORE_NAMES[clamp(diff, -3, 3)];
      const cid = P.strokes === 1 ? 'call_hio' : { '-3': 'call_albatross', '-2': 'call_eagle', '-1': 'call_birdie', 0: 'call_par', 1: 'call_bogey', 2: 'call_dbogey', 3: 'call_tbogey' }[clamp(diff, -3, 3)];
      say(cid, nm.zh, nm.en, 3, 'big');
      if (shot && !shot.club.putter) award(P, 100, '切球进洞', 'CHIP IN');
      else if (shotDist > 8) award(P, 50, '长推进洞', 'LONG PUTT');
      award(P, P.strokes === 1 ? 500 : diff <= -2 ? 200 : diff === -1 ? 80 : diff === 0 ? 30 : 0, nm.zh, nm.en);
      if (diff <= 0) { const g = golfer; after2(0.5, () => { fx.confetti(g.root.position); }); cheerOther(); } else bubble(P, '😮‍💨');
      finishHole(P.strokes, diff <= 0 ? 'cheer' : 'stand');
      return;
    }
    if (ev === 'water' || ev === 'ob') {
      P.strokes++;
      const lavaHit = ev === 'water' && course.feature === 'lava';
      if (ev === 'water') { fx.splash(ballMesh.position, lavaHit); sfx.splash(); } else sfx.bad();
      if (lavaHit) say(null, '熔岩', 'LAVA +1', 2.2, 'bad');
      else if (ev === 'water') say('call_water', '落水', 'WATER HAZARD +1', 2.2, 'bad'); else say('call_ob', '出界', 'OUT OF BOUNDS +1', 2.2, 'bad');
      bubble(P, '😅');
      ball.place(lastPos);
    } else {
      const l = hole.surfaceAt(ball.pos.x, ball.pos.z), dp = distToPin();
      say(null, `${dp < 30 ? dp.toFixed(1) : Math.round(dp)} m`, `距旗杆 TO PIN · ${LIE[l]?.zh ?? ''}`, 1.6);
      if (P.shotLie === 'tee' && hole.spec.par > 3 && l === 'fairway') award(P, 15, '球道命中', 'FAIRWAY HIT');
      if (shotDist >= 200 && l === 'fairway') award(P, 20, '长打', 'LONG DRIVE');
      if (dp <= 3 && shotDist > 30) { award(P, 40, '近洞', 'NEAR PIN'); cheerOther(); }
    }
    if (P.strokes >= hole.spec.par + 5) { // 桿數上限，直接收球
      say('call_pickup', '放弃本洞', 'PICK UP', 2.4, 'bad');
      finishHole(hole.spec.par + 5, 'sad');
      return;
    }
    phase = 'settle';
    updatePlayerUI();
    after(1.5, nextTurn);
  }

  function finishHole(score, emote) {
    P.scores[holeIdx] = score;
    P.done = true;
    phase = 'holed'; phaseT = 0; root.dataset.phase = 'holed';
    updatePlayerUI();
    const toPin = new THREE.Vector3(hole.pin.x - golfer.root.position.x, 0, hole.pin.z - golfer.root.position.z).normalize();
    golfer.face(golfer.root.position, toPin);
    golfer.setEmote(emote);
    const allDone = players.every((x) => x.done);
    after(allDone ? 3.2 : 2.6, allDone ? showCard : nextTurn);
  }

  // —— 計分卡（超過 9 洞分成前九、後九兩段）——
  function cardTable() {
    const n = course.holes.length, done = Math.min(me.scores.length, rival.scores.length);
    const cell = (v, par) => (v == null ? '<td>-</td>' : `<td class="${v < par ? 'under' : v > par ? 'over' : ''}"><span>${v}</span></td>`);
    const sum = (a) => a.reduce((x, v) => x + v, 0);
    let html = '';
    for (let from = 0; from < n; from += 9) {
      const idx = course.holes.map((_, i) => i).slice(from, from + 9), lastSeg = from + 9 >= n;
      const label = n > 9 ? (from === 0 ? '前九 OUT' : '后九 IN') : '总 TOTAL';
      const seg = (pl) => sum(idx.map((i) => pl.scores[i] ?? 0));
      const row = (pl, cls) => `<tr class="${cls}"><th>${pl.ch.zh} ${pl.ch.en}</th>${idx.map((i) => cell(pl.scores[i], course.holes[i].par)).join('')}<td>${seg(pl)}${lastSeg ? ` <em>${fmtPar(diffOf(pl))}</em>` : ''}</td></tr>`;
      html += `<table class="g-table"><tr><th>洞 HOLE</th>${idx.map((i) => `<th>${i + 1}</th>`).join('')}<th>${label}</th></tr>
        <tr><th>标准杆 PAR</th>${idx.map((i) => `<td>${course.holes[i].par}</td>`).join('')}<td>${sum(idx.map((i) => course.holes[i].par))}</td></tr>${row(me, 'me')}${row(rival, '')}</table>`;
    }
    return `${html}<p class="g-cardNote">${done} / ${n} 洞 HOLES　·　技术分 SKILL　${me.ch.zh} ${me.points}　${rival.ch.zh} ${rival.points}</p>`;
  }
  function showCard() {
    const last = holeIdx === course.holes.length - 1;
    const el = $('g-card');
    el.hidden = false;
    el.innerHTML = `<div class="g-board u-card"><div class="g-boardHead"><b>计分卡</b><span>SCORECARD</span></div>${cardTable()}<button class="u-btn" id="g-next">${last ? '查看结果<small>RESULT</small>' : '下一洞<small>NEXT HOLE</small>'}</button></div>`;
    sfx.select();
    phase = 'card';
    el.querySelector('#g-next').onclick = () => { el.hidden = true; if (last) showResult(); else loadHole(holeIdx + 1); };
  }

  // —— 結算（輸贏）——
  function showResult(force) {
    const sum = (a) => a.reduce((x, v) => x + v, 0), mine = sum(me.scores), theirs = sum(rival.scores);
    const outcome = force || (mine < theirs ? 'win' : mine > theirs ? 'lose' : 'draw');
    const T = { win: ['胜利', 'VICTORY', 'cheer'], lose: ['惜败', 'DEFEAT', 'sad'], draw: ['平局', 'DRAW', 'stand'] }[outcome];
    setActive(me);
    phase = 'result'; phaseT = 0; root.dataset.phase = 'result'; root.dataset.ai = '';
    for (const pl of players) pl.mesh.visible = pl.dot.visible = false;
    aimLine.visible = aimRing.visible = false;
    $('g-card').hidden = true;
    // 兩人並肩站在果嶺上：你做出勝負的反應，對手相反
    const toCam = new THREE.Vector3(0, 0, -1);
    me.golfer.face(new THREE.Vector3(hole.pin.x - 1.1, hole.pin.y + 0.05, hole.pin.z - 2.5), toCam);
    rival.golfer.face(new THREE.Vector3(hole.pin.x + 1.3, hole.pin.y + 0.05, hole.pin.z - 2.2), toCam);
    me.golfer.setEmote(T[2]);
    rival.golfer.setEmote(outcome === 'win' ? 'sad' : outcome === 'lose' ? 'cheer' : 'stand');
    if (outcome === 'win') { sfx.win(); for (const d of [0.2, 1.4, 2.8]) after2(d, () => fx.confetti(me.golfer.root.position)); } else if (outcome === 'lose') sfx.lose();
    const el = $('g-result');
    el.hidden = false;
    el.className = `g-overlay g-res-${outcome}`;
    const EN = { win: 'VICTORY', lose: 'DEFEAT', draw: 'DRAW' }[outcome];
    el.innerHTML = `<div class="g-resTitle"><div class="u-word t-${outcome === 'win' ? 'great' : outcome === 'lose' ? 'cool' : 'good'}">${letters(EN)}</div><span class="g-sub">${T[0]}</span></div>
      <div class="g-board u-card">
        <div class="g-boardHead"><b>${course.zh}</b><span>${course.en} · FINAL</span></div>
        <div class="g-vs">
          <div class="${outcome === 'win' ? 'win' : ''}"><small>${me.ch.zh} ${me.ch.en}</small><b>${mine}</b><em>${fmtPar(diffOf(me))}</em><u>技术分 ${me.points}</u></div>
          <i>VS</i>
          <div class="${outcome === 'lose' ? 'win' : ''}"><small>${rival.ch.zh} ${rival.ch.en}</small><b>${theirs}</b><em>${fmtPar(diffOf(rival))}</em><u>技术分 ${rival.points}</u></div>
        </div>
        ${cardTable()}
        <div class="g-btns"><button class="u-btn" id="g-again">再来一局<small>PLAY AGAIN</small></button><button class="u-btn ghost" id="g-home">返回主页<small>HOME</small></button></div>
      </div>`;
    el.querySelector('#g-again').onclick = () => { el.hidden = true; for (const pl of players) { pl.scores.length = 0; pl.points = 0; } powerLeft = Math.max(2, Math.round(course.holes.length / 2)); loadHole(0); };
    el.querySelector('#g-home').onclick = () => exit();
  }

  // —— 小地圖 ——
  function drawMap() {
    const cv = $('g-map'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    let minX = Infinity, maxX = -Infinity;
    for (const p of hole.path) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); }
    minX -= 34; maxX += 34;
    const minZ = -22, maxZ = hole.len + 26, k = Math.min((W - 16) / (maxX - minX), (H - 16) / (maxZ - minZ));
    const ox = W / 2 + ((minX + maxX) / 2) * k, oy = H - 8 + minZ * k;
    const X = (x) => ox - x * k, Y = (z) => oy - z * k; // 往上是擊球方向，左右與畫面一致
    const pathLine = (w, col, from = 0) => { g.beginPath(); hole.path.forEach((p, i) => { if (i / (hole.path.length - 1) < from) return; g.lineTo(X(p.x), Y(p.z)); }); g.lineWidth = w * k; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col; g.stroke(); };
    pathLine(96, 'rgba(60, 120, 70, .55)');
    if (hole.spec.width > 0) pathLine(hole.spec.width, th.fairwayA, 0.1); else pathLine(18, th.fairwayA, 0.78);
    const dot = (x, z, r, col) => { g.beginPath(); g.arc(X(x), Y(z), Math.max(1.5, r * k), 0, 6.3); g.fillStyle = col; g.fill(); };
    for (const w of hole.waters) dot(w.x, w.z, w.r, th.water);
    dot(hole.pin.x, hole.pin.z, hole.greenR + 3, th.fringe); dot(hole.pin.x, hole.pin.z, hole.greenR, th.green);
    for (const b of hole.bunkers) dot(b.x, b.z, b.r, th.sand);
    g.fillStyle = '#fff'; g.fillRect(X(0) - 4, Y(0) - 2, 8, 4);
    // 旗桿
    g.strokeStyle = '#26343c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(hole.pin.x), Y(hole.pin.z)); g.lineTo(X(hole.pin.x), Y(hole.pin.z) - 11); g.stroke();
    g.fillStyle = '#c8463c'; g.beginPath(); g.moveTo(X(hole.pin.x), Y(hole.pin.z) - 11); g.lineTo(X(hole.pin.x) + 8, Y(hole.pin.z) - 8); g.lineTo(X(hole.pin.x), Y(hole.pin.z) - 5); g.fill();
    // 瞄準線與落點
    if (phase === 'aim' && landing) {
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(X(ball.pos.x), Y(ball.pos.z)); g.lineTo(X(landing.x), Y(landing.z)); g.stroke(); g.setLineDash([]);
      g.strokeStyle = '#d8b55f'; g.lineWidth = 2; g.beginPath(); g.arc(X(landing.x), Y(landing.z), 4, 0, 6.3); g.stroke();
    }
    g.beginPath(); g.arc(X(ball.pos.x), Y(ball.pos.z), 3.4, 0, 6.3); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#26343c'; g.stroke();
  }
  // 把世界座標的點投影成畫面上的標記位置
  const projV = new THREE.Vector3();
  function placeMark(el, world, yOff) {
    projV.copy(world); projV.y += yOff; projV.project(camera);
    const vis = projV.z < 1 && Math.abs(projV.x) < 1.05 && Math.abs(projV.y) < 1.05;
    el.style.visibility = vis ? 'visible' : 'hidden';
    if (vis) el.style.transform = `translate(${((projV.x + 1) / 2) * root.clientWidth}px, ${((1 - projV.y) / 2) * root.clientHeight}px) translate(-50%, -100%)`;
  }
  let mapT = 0;

  // —— 輸入 ——
  const keys = {};
  function onKey(e) {
    if (e.type === 'keydown') {
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) pressSwing(); }
      if (phase === 'aim' && meter.mode === 'idle') {
        if (e.code === 'ArrowUp') changeClub(-1);
        if (e.code === 'ArrowDown') changeClub(1);
      }
      if (e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey) toggleDev();
      if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey) toggleMute();
    }
    keys[e.code] = e.type === 'keydown';
  }
  function changeClub(d) {
    if (phase !== 'aim' || meter.mode !== 'idle' || clubs.length < 2) return;
    clubIdx = (clubIdx + d + clubs.length) % clubs.length; sfx.tick();
    updateClubUI();
  }
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { if (phase === 'aim' && meter.mode === 'idle') { drag = e.clientX; canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove', (e) => {
    if (drag == null) return;
    yaw -= (e.clientX - drag) * 0.0028 * (clubs[clubIdx]?.putter ? 0.4 : 1);
    drag = e.clientX; previewDirty = true;
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  $('g-swing').addEventListener('pointerdown', (e) => { e.preventDefault(); pressSwing(); });
  $('g-meter').addEventListener('pointerdown', (e) => { e.preventDefault(); pressSwing(); });
  $('g-clubPrev').onclick = () => changeClub(-1);
  $('g-clubNext').onclick = () => changeClub(1);
  const applyMute = () => { $('g-mute').classList.toggle('off', isMuted()); setSfxMuted(isMuted()); };
  const toggleMute = () => { setBgmMuted(!isMuted()); applyMute(); };
  $('g-mute').onclick = toggleMute;
  applyMute();
  $('g-fast').onclick = () => { aiFast = !aiFast; $('g-fast').classList.toggle('on', aiFast); };
  $('g-help').onclick = showTutor;
  $('g-tutorOk').onclick = hideTutor;
  for (const b of root.querySelectorAll('#g-spin button')) b.onclick = () => { if (phase === 'aim' && meter.mode === 'idle') { spinMode = +b.dataset.spin; sfx.tick(); updateOptsUI(); } };
  $('g-power').onclick = () => { if (phase !== 'aim' || meter.mode !== 'idle' || powerLeft <= 0) return; powerShot = !powerShot; sfx.select(); updateClubUI(); };
  $('g-quit').onclick = () => { if (phase === 'result' || window.confirm('确定退出本局？ QUIT THIS ROUND?')) exit(); };

  function resize() {
    const w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    layoutKey = pickLayoutKey();
    camera.fov = GAME[layoutKey].fov;
    // 把畫面往上推，讓球員不被底部 HUD 擋住
    camera.setViewOffset(w, h, 0, GAME[layoutKey].viewShift * h, w, h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // —— DEV 工具（D 鍵）——
  let gui = null;
  function toggleDev() {
    if (gui) { gui._hidden ? gui.show() : gui.hide(); return; }
    gui = new GUI({ title: 'DEV 游戏微调 (D)', width: 290 });
    gui.domElement.style.zIndex = 60;
    const L = () => GAME[layoutKey];
    const fc = gui.addFolder(`镜头 Camera · ${layoutKey}`);
    for (const [k, a, b, s] of [['viewShift', -0.3, 0.4, 0.005], ['fov', 25, 90, 0.5], ['back', 2, 20, 0.1], ['up', 0.5, 10, 0.05], ['side', -5, 5, 0.05], ['look', 5, 80, 1], ['puttBack', 2, 14, 0.1], ['puttUp', 0.5, 8, 0.05], ['flyBack', 3, 25, 0.1], ['flyUp', 1, 12, 0.1]]) fc.add(L(), k, a, b, s).onChange(resize);
    const fs = gui.addFolder('挥杆 Swing');
    const scrub = { s: 0, on: false };
    fs.add(scrub, 'on').name('手动预览姿势').onChange((v) => { devScrub = v ? scrub.s : -1; if (!v) golfer.setSwing(0); });
    fs.add(scrub, 's', 0, 3, 0.01).name('进度 0→3').onChange((v) => { if (scrub.on) devScrub = v; });
    for (const k of Object.keys(SWING)) fs.add(SWING, k, 0.05, 2.5, 0.01);
    const fp = gui.addFolder('物理 Physics');
    fp.add(PHYS, 'drag', 0.001, 0.008, 0.0001); fp.add(PHYS, 'lift', 0, 0.003, 0.00005); fp.add(PHYS, 'side', 0, 0.001, 0.00001); fp.add(PHYS, 'capR', 0.05, 0.5, 0.01); fp.add(PHYS, 'capV', 1, 8, 0.1);
    fp.close();
    const ft = gui.addFolder('状态 State');
    const act = {
      holeIn: () => { if (phase === 'aim' || phase === 'flight') { P.strokes = Math.max(1, P.strokes); ball.place(hole.pin.clone().setY(hole.pin.y + BALL_R)); onBallEvent('holed'); } },
      nextHole: () => { for (const pl of players) pl.scores[holeIdx] = pl.scores[holeIdx] ?? hole.spec.par; $('g-card').hidden = true; if (holeIdx < course.holes.length - 1) loadHole(holeIdx + 1); else showResult(); },
      win: () => { fillScores(); showResult('win'); }, lose: () => { fillScores(); showResult('lose'); }, draw: () => { fillScores(); showResult('draw'); },
      card: () => { for (const pl of players) pl.scores[holeIdx] = pl.scores[holeIdx] ?? hole.spec.par; showCard(); },
      exportJson: () => { const json = JSON.stringify({ GAME, SWING, PHYS }, null, 2); navigator.clipboard?.writeText(json).catch(() => {}); window.prompt('已复制，贴给 Claude 即可锁定', json); },
    };
    const fillScores = () => { for (const pl of players) for (let i = 0; i < course.holes.length; i++) pl.scores[i] = pl.scores[i] ?? course.holes[i].par; };
    ft.add(act, 'holeIn').name('直接进洞 Hole In');
    ft.add(act, 'card').name('计分卡 Scorecard');
    ft.add(act, 'nextHole').name('下一洞 Next Hole');
    ft.add(act, 'win').name('结算：胜利 Win');
    ft.add(act, 'lose').name('结算：惜败 Lose');
    ft.add(act, 'draw').name('结算：平局 Draw');
    gui.add(act, 'exportJson').name('💾 导出 / 锁定 Export');
  }

  // —— 主迴圈 ——
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3(), right = new THREE.Vector3();
  function frame() {
    if (disposed) return;
    let dt = Math.min(clock.getDelta(), 0.05);
    if (slowT > 0) { slowT -= dt; dt *= 0.18; }
    if (P.ai && (phase === 'ai' || phase === 'swing' || phase === 'flight' || phase === 'settle')) dt *= aiFast ? 4 : 1.35; // 對手回合稍快，可按快進
    phaseT += dt;
    for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
    if (afterTimer > 0) { afterTimer -= dt; if (afterTimer <= 0 && afterFn) { const f = afterFn; afterFn = null; f(); } }
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('g-toast').classList.remove('show'); }
    const L = GAME[layoutKey];
    let k = 4; // 鏡頭跟隨速度

    if (phase === 'intro') {
      const t = ease(clamp(phaseT / 2.6, 0, 1));
      camPosT.set(0, hole.tee.y + L.up + 3, -L.back - 4).lerp(tmp.set(hole.pin.x + 18, hole.pin.y + 26, hole.pin.z + 34), 1 - t);
      camLookT.copy(hole.pin).lerp(tmp.set(0, hole.tee.y + 1, 30), t * 0.5);
      k = 6;
      if (phaseT > 2.8) nextTurn();
    } else if (phase === 'aim' || phase === 'ai') {
      if (P.ai) { /* 對手自己瞄準 */ } else if (meter.mode === 'idle') {
        const sp = clubs[clubIdx].putter ? 0.25 : 0.9;
        if (keys.ArrowLeft) { yaw += sp * dt; previewDirty = true; }
        if (keys.ArrowRight) { yaw -= sp * dt; previewDirty = true; }
      } else if (meter.mode === 'up') {
        meter.pos += dt / SWING.meterUp;
        if (meter.pos >= 1) { meter.pos = 1; meter.power = 1; meter.mode = 'down'; }
        updateMeterUI();
      } else if (meter.mode === 'down') {
        meter.pos -= (dt / SWING.meterDown) * (1.5 - stats.accuracy * 0.045);
        if (meter.pos <= -0.1) finishMeter(-0.1);
        updateMeterUI();
      }
      if (previewDirty) updatePreview();
      aimLine.visible = aimRing.visible = meter.mode !== 'done' && !P.ai;
      const putt = clubs[clubIdx].putter;
      right.set(-aimDir.z, 0, aimDir.x);
      // 推桿鏡頭依距離拉遠，讓球員、球與洞口都在畫面裡
      const pd = distToPin(), pk = clamp(pd * 0.55 + 3.6, 4.6, 10) / 5.2;
      const back = putt ? L.puttBack * pk : L.back, up = putt ? L.puttUp * pk : L.up;
      camPosT.copy(ball.pos).addScaledVector(aimDir, -back).addScaledVector(right, putt ? 0.5 : L.side);
      camPosT.y = Math.max(hole.heightAt(camPosT.x, camPosT.z) + 1.2, ball.pos.y + up);
      camLookT.copy(ball.pos).addScaledVector(aimDir, putt ? Math.min(pd * 0.5, 6) : L.look);
      camLookT.y = hole.heightAt(camLookT.x, camLookT.z) + (putt ? 0.5 : 1.5);
      if (devScrub >= 0) golfer.setSwing(devScrub);
      // 風向箭頭（相對於瞄準方向）
      $('g-windArrow').style.transform = `rotate(${(Math.atan2(wind.dot(right), wind.dot(aimDir)) * 180) / Math.PI}deg)`;
    } else if (phase === 'swing' || (phase === 'flight' && swing.shot)) {
      const p = swing.shot.club.putter;
      const tb = p ? SWING.puttBack : SWING.back, thd = p ? 0.05 : SWING.hold, td = p ? SWING.puttDown : SWING.down, tf = p ? SWING.puttFollow : SWING.follow;
      swing.t += dt;
      const t = swing.t;
      let s;
      if (t < tb) s = ease(t / tb);
      else if (t < tb + thd) s = 1;
      else if (t < tb + thd + td) { const u = (t - tb - thd) / td; s = 1 + u * u; }
      else s = 2 + (1 - Math.pow(1 - clamp((t - tb - thd - td) / tf, 0, 1), 2));
      if (p) s = t < tb ? ease(t / tb) * (0.35 + 0.65 * swing.shot.power) : s; // 推桿上桿幅度隨力道
      golfer.setSwing(s);
      if (!whooshed && !p && t >= tb + thd) { whooshed = true; sfx.whoosh(); }
      if (!swing.launched && t >= tb + thd + td) launch();
      if (t > tb + thd + td + tf + 0.2 && phase !== 'swing') swing.shot = swing.launched ? swing.shot : null;
    }

    if (phase === 'flight') {
      const ev = ball.update(dt, hole, wind);
      fx.pushTrail(ballMesh.position);
      $('g-flyNum').textContent = Math.hypot(ball.pos.x - lastPos.x, ball.pos.z - lastPos.z).toFixed(1);
      root.dataset.putt = swing.shot?.club.putter ? '1' : '';
      const putt = swing.shot?.club.putter;
      const hgt = ball.pos.y - hole.heightAt(ball.pos.x, ball.pos.z);
      tmp.set(ball.vel.x, 0, ball.vel.z);
      if (tmp.lengthSq() > 0.25) tmp.normalize(); else tmp.copy(aimDir);
      camPosT.copy(ball.pos).addScaledVector(tmp, -(putt ? L.puttBack : L.flyBack + hgt * 0.5));
      camPosT.y = Math.max(hole.heightAt(camPosT.x, camPosT.z) + 1.5, ball.pos.y + (putt ? L.puttUp : L.flyUp + hgt * 0.15));
      camLookT.copy(ball.pos);
      k = putt ? 3 : 5;
      $('g-dist').textContent = `${distToPin().toFixed(distToPin() < 30 ? 1 : 0)} m`;
      if (ev) { const sh = swing.shot; swing.shot = null; onBallEvent(ev, sh); }
    } else if (phase === 'holed') {
      const g = golfer.root.position;
      tmp.set(hole.pin.x - g.x, 0, hole.pin.z - g.z).normalize();
      camPosT.copy(g).addScaledVector(tmp, 5.2).add(right.set(-tmp.z, 0, tmp.x).multiplyScalar(1.6));
      camPosT.y = Math.max(hole.heightAt(camPosT.x, camPosT.z) + 1, g.y + 1.5);
      camLookT.set(g.x, g.y + golfer.height * 0.6, g.z);
      k = 2.5;
    } else if (phase === 'result') {
      const g = golfer.root.position, a = phaseT * 0.25;
      const f = tmp.set(Math.sin(golfer.root.rotation.y), 0, Math.cos(golfer.root.rotation.y));
      camPosT.copy(g).addScaledVector(f, 4.6 * Math.cos(Math.sin(a) * 0.4)).add(right.set(-f.z, 0, f.x).multiplyScalar(4.6 * Math.sin(Math.sin(a) * 0.4)));
      camPosT.y = Math.max(hole.heightAt(camPosT.x, camPosT.z) + 0.8, g.y + (layoutKey === 'PC' ? 1.3 : 2.1));
      camLookT.set(g.x, g.y + golfer.height * (layoutKey === 'PC' ? 0.62 : 0.2), g.z);
      if (layoutKey === 'PC') camLookT.add(right.subVectors(camLookT, camPosT).cross(camera.up).normalize().multiplyScalar(1.7)); // 鏡頭往右看，讓球員落在畫面左側
      k = 2.5;
    }

    for (const pl of players) pl.golfer.update(dt);
    const a = 1 - Math.exp(-k * dt);
    camPos.lerp(camPosT, a); camLook.lerp(camLookT, a);
    camera.position.copy(camPos);
    if (fx.shake > 0) camera.position.add(tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(fx.shake));
    camera.lookAt(camLook);
    for (const pl of players) {
      pl.mesh.position.copy(pl.ball.pos);
      pl.mesh.position.y += 0.07; // 果嶺面比地形高，球要抬到面上才不會陷進去
      pl.mesh.scale.setScalar(clamp(camPos.distanceTo(pl.ball.pos) / 14, 1, 7)); // 遠距離放大，避免看不到球
      pl.dot.position.copy(pl.mesh.position);
    }
    // 表情泡泡跟著球員的頭
    if (bubbles.length) {
      const bb = bubbles[0]; bb.t -= dt;
      if (bb.t <= 0) { bubbles.length = 0; $('g-bubble').classList.remove('show'); }
      else placeMark($('g-bubble'), bb.pl.golfer.root.position, bb.pl.golfer.height + 0.25);
    }
    if (hole?.landmarks?.userData.spin) hole.landmarks.userData.spin.rotation.y += dt * 0.5; // 燈塔光束
    if (course.feature === 'lava' && Math.random() < dt * 14) { // 飄在空中的火星
      tmp.set(camPos.x + (Math.random() - 0.5) * 40, 0, camPos.z + (Math.random() - 0.5) * 40); tmp.y = hole.heightAt(tmp.x, tmp.z) + Math.random() * 2;
      fx.emit(tmp, { count: 1, speed: 0.4, up: 1.6, gravity: -0.6, drag: 0.2, life: 3.2, size: 0.07, colors: ['#ff8a3c', '#ffd23a', '#ff5a1a'] });
    }
    sky.position.copy(camPos); clouds.position.set(camPos.x, 0, camPos.z);
    const focus = phase === 'flight' ? ball.pos : golfer.root.position;
    sun.target.position.copy(focus); sun.position.copy(focus).add(SUN_OFF);
    if (hole) {
      // 擋在鏡頭與球（或球員）之間的樹先隱藏
      tmp.copy(phase === 'aim' || phase === 'swing' ? ball.pos : focus).addScaledVector(aimDir, phase === 'aim' ? 6 : 0);
      hole.cullTrees(camPos, tmp);
    }
    if (hole) { const c = hole.flag.userData.cloth; c.rotation.y = Math.atan2(-wind.z, wind.x) + Math.sin(clock.elapsedTime * 4) * 0.18; }
    // 更新路徑圓點
    aimDots.visible = aimHalo.visible = aimLine.visible && aimPts.length > 1;
    if (aimDots.visible) {
      const total = aimLen[aimLen.length - 1], flow = (clock.elapsedTime * 0.35) % 1, mm = new THREE.Matrix4(), pp = new THREE.Vector3();
      let seg = 0;
      for (let i = 0; i < DOTS; i++) {
        const u = ((i + flow) / DOTS) * total;
        if (i === 0) seg = 0;
        while (seg < aimLen.length - 2 && aimLen[seg + 1] < u) seg++;
        const span = aimLen[seg + 1] - aimLen[seg] || 1;
        pp.lerpVectors(aimPts[seg], aimPts[seg + 1], (u - aimLen[seg]) / span);
        const fade = Math.min(1, ((i + flow) / DOTS) * 6) * Math.min(1, (1 - (i + flow) / DOTS) * 8); // 兩端收小
        const r = Math.max(0.035, camPos.distanceTo(pp) * 0.0048) * (0.35 + 0.65 * fade);
        mm.makeScale(r, r, r).setPosition(pp); aimDots.setMatrixAt(i, mm);
        mm.makeScale(r * 1.28, r * 1.28, r * 1.28).setPosition(pp); aimHalo.setMatrixAt(i, mm);
      }
      aimDots.instanceMatrix.needsUpdate = aimHalo.instanceMatrix.needsUpdate = true;
      const pulse = 1 + Math.sin(clock.elapsedTime * 4) * 0.08;
      aimRing.scale.setScalar((clubs[clubIdx]?.putter ? 0.25 : 1) * pulse * Math.max(1, camPos.distanceTo(aimRing.position) / 70));
    }
    waterNormal().offset.set(clock.elapsedTime * 0.012, clock.elapsedTime * 0.008); // 水波流動
    backdrop?.userData.update(clock.elapsedTime);
    fx.update(dt, camera, root.clientHeight);
    // 場景中的標記：旗桿（距離與高低差）、落點
    if (hole) {
      const dPin = distToPin(), dh = hole.pin.y - ball.pos.y;
      $('g-pinTag').innerHTML = `<em>${dh >= 0 ? '▲' : '▼'}</em>${Math.abs(dh) < 1 ? `${Math.round(Math.abs(dh) * 100)} cm` : `${Math.abs(dh).toFixed(1)} m`}`;
      placeMark($('g-pinMark'), hole.pin, 3.0);
      if (landing && phase === 'aim') placeMark($('g-tgtMark'), landing, 0.6);
      mapT += dt; if (phase === 'flight' && mapT > 0.12) { mapT = 0; drawMap(); }
    }
    renderer.render(scene, camera);
  }

  function exit() {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    gui?.destroy();
    hole?.dispose(); golfer.dispose();
    scene.traverse((o) => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) m.dispose(); });
    pmrem.dispose(); renderer.dispose();
    root.remove();
    onExit?.();
  }

  // —— 啟動 ——
  resize();
  await Promise.all(players.map((pl) => pl.golfer.load(pl.ch)));
  if (disposed) return;
  $('g-loading').hidden = true;
  playBgm('course');
  loadHole(0);
  renderer.setAnimationLoop(frame);
  return { exit, debug: { get phase() { return phase; }, get strokes() { return P.strokes; }, get ball() { return ball; }, get player() { return P; }, players, nextTurn, pressSwing, get hole() { return hole; }, get meter() { return meter; }, golfer, GAME, resize, teleport: (x, z) => { ball.place(new THREE.Vector3(x, hole.heightAt(x, z) + BALL_R, z)); ballMesh.visible = ballDot.visible = true; beginAim(); }, scrub: (v) => { devScrub = v; }, act: (n) => { if (!gui) toggleDev(); gui.hide(); return gui.folders.find((f) => f._title.startsWith('状态')).controllers.find((c) => c.property === n).object[n](); } } };
}
