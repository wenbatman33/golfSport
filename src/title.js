// 封面（主畫面）：public/ui/title.webp（橫）、title_m.webp（直）、logo.webp
import './title.css';

const BASE = import.meta.env.BASE_URL;

export function createTitle({ onStart, isDragMode, onDragLogo }) {
  const el = document.createElement('div');
  el.id = 'title-screen';
  el.innerHTML = `
    <img class="tt-art" alt="">
    <i class="tt-flare"></i><i class="tt-dust"></i><i class="tt-shade"></i>
    <div class="tt-logo">
      <img class="tt-mark" src="${BASE}ui/logo.webp" alt="一杆进洞 HOLE IN ONE GOLF" draggable="false">
      <span class="tt-year">2026 巡回赛 · TOUR SEASON</span>
    </div>
    <button class="tt-start" type="button">开始游戏<small>TEE OFF</small></button>`;

  const art = el.querySelector('.tt-art');
  const logo = el.querySelector('.tt-logo');
  const mark = el.querySelector('.tt-mark');
  mark.onerror = () => { // 標誌圖還沒好時改用文字版
    const h = document.createElement('h1');
    h.className = 'tt-mark-text';
    h.innerHTML = '一杆进洞<small>HOLE IN ONE GOLF</small>';
    mark.replaceWith(h);
  };

  // 每次進封面隨機挑一位角色的主視覺（title_<id>.webp／title_m_<id>.webp）
  const HEROES = ['ace', 'skye', 'tank', 'mia', 'joe', 'kai'];
  let hero = HEROES[Math.floor(Math.random() * HEROES.length)];
  let lastLayout = 'PC';
  const artUrl = (id, layoutKey) => `${BASE}ui/${layoutKey === 'MOBILE' ? 'title_m' : 'title'}_${id}.webp`;
  function setArt(layoutKey) {
    lastLayout = layoutKey;
    art.style.display = '';
    art.onerror = () => { // 該角色的圖還沒生成時退回林锐
      if (hero !== 'ace') { hero = 'ace'; art.src = artUrl('ace', lastLayout); } else art.style.display = 'none';
    };
    art.src = artUrl(hero, layoutKey);
  }
  let artKey = '';
  function applyLayout(T, layoutKey) {
    const s = el.style;
    s.setProperty('--art-x', `${T.artX}%`);
    s.setProperty('--art-y', `${T.artY}%`);
    s.setProperty('--logo-x', `${T.logoX}vw`);
    s.setProperty('--logo-y', `${T.logoY}vh`);
    s.setProperty('--logo-w', `${T.logoW}vw`);
    s.setProperty('--start-y', `${T.startY}vh`);
    if (layoutKey !== artKey) { // 橫直版各用一張主視覺
      artKey = layoutKey;
      setArt(layoutKey);
    }
  }

  // DEV 拖曳模式：直接拖標誌改位置；平常點任何地方開始
  let drag = null;
  let dragged = false;
  logo.addEventListener('pointerdown', (e) => {
    if (!isDragMode()) return;
    drag = { x: e.clientX, y: e.clientY };
    dragged = true;
    logo.setPointerCapture(e.pointerId);
  });
  logo.addEventListener('pointermove', (e) => {
    if (!drag) return;
    onDragLogo(((drag.x - e.clientX) / window.innerWidth) * 100, ((drag.y - e.clientY) / window.innerHeight) * 100);
    drag = { x: e.clientX, y: e.clientY };
  });
  const end = () => { drag = null; };
  logo.addEventListener('pointerup', end);
  logo.addEventListener('pointercancel', end);

  el.addEventListener('click', () => {
    if (dragged || isDragMode()) { dragged = false; return; }
    hide();
    onStart();
  });

  function show() {
    if (!el.isConnected && artKey) { // 再次回到封面時換一位角色
      const others = HEROES.filter((h) => h !== hero);
      hero = others[Math.floor(Math.random() * others.length)];
      setArt(artKey);
    }
    el.classList.remove('out');
    if (!el.isConnected) document.body.appendChild(el);
  }
  function hide() {
    el.classList.add('out');
    setTimeout(() => { if (el.classList.contains('out')) el.remove(); }, 450);
  }

  return { show, hide, applyLayout, isOpen: () => el.isConnected && !el.classList.contains('out') };
}
