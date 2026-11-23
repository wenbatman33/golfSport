// DEV 開發者微調工具：D 鍵或右下角齒輪開關，預設關閉
import GUI from 'three/addons/libs/lil-gui.module.min.js';

export function createDevTool(ctx) {
  // ctx: { LAYOUT, SCENE, CHAR_TUNE, canvas, controls, getLayoutKey, setLayoutKey,
  //        getCharId, applyLayout, applyScene, applyTune, getClips, playClip }
  const gui = new GUI({ title: 'DEV 微调工具 (D)', width: 300 });
  gui.domElement.style.zIndex = 50;
  gui.hide();
  let open = false;
  const state = { layout: ctx.getLayoutKey(), drag: false, clip: '' };

  const refresh = () => gui.controllersRecursive().forEach((c) => c.updateDisplay());

  // —— 版面切換 ——
  gui.add(state, 'layout', ['PC', 'MOBILE']).name('版面 Layout').onChange((k) => { ctx.setLayoutKey(k); rebuildLayout(); });
  gui.add(state, 'drag').name('拖曳人物 Drag').onChange((v) => { ctx.controls.enabled = !v; });

  // —— 依版面的鏡頭參數 ——
  let fLayout, fTitle;
  function rebuildLayout() {
    if (fLayout) fLayout.destroy();
    const L = ctx.LAYOUT[ctx.getLayoutKey()];
    fLayout = gui.addFolder(`镜头 Camera · ${ctx.getLayoutKey()}`);
    fLayout.add(L, 'camFov', 15, 70, 0.5).onChange(ctx.applyLayout);
    fLayout.add(L, 'camDist', 2, 14, 0.05).onChange(ctx.applyLayout);
    fLayout.add(L, 'camHeight', 0, 4, 0.01).onChange(ctx.applyLayout);
    fLayout.add(L, 'targetY', 0, 2, 0.01).onChange(ctx.applyLayout);
    fLayout.add(L, 'viewShiftX', -0.5, 0.5, 0.005).onChange(ctx.applyLayout);
    fLayout.add(L, 'viewShiftY', -0.5, 0.5, 0.005).onChange(ctx.applyLayout);
    // 封面版面（同樣依 PC／MOBILE 分開）
    if (fTitle) fTitle.destroy();
    const T = L.title;
    fTitle = gui.addFolder(`封面 Title · ${ctx.getLayoutKey()}`);
    fTitle.add({ show: ctx.showTitle }, 'show').name('▶ 显示封面 Show Title');
    fTitle.add(T, 'artX', 0, 100, 0.5).onChange(ctx.applyTitle);
    fTitle.add(T, 'artY', 0, 100, 0.5).onChange(ctx.applyTitle);
    fTitle.add(T, 'logoX', -20, 100, 0.25).onChange(ctx.applyTitle);
    fTitle.add(T, 'logoY', -10, 100, 0.25).onChange(ctx.applyTitle);
    fTitle.add(T, 'logoW', 10, 120, 0.5).onChange(ctx.applyTitle);
    fTitle.add(T, 'startY', 0, 60, 0.25).onChange(ctx.applyTitle);
  }
  rebuildLayout();

  // —— 當前角色的模型校正 ——
  let fTune;
  function rebuildTune() {
    if (fTune) fTune.destroy();
    const id = ctx.getCharId();
    const t = ctx.CHAR_TUNE[id];
    fTune = gui.addFolder(`角色 Model · ${id}`);
    fTune.add(t, 'scale', 0.3, 2.5, 0.01).onChange(ctx.applyTune);
    fTune.add(t, 'y', -1, 1, 0.005).onChange(ctx.applyTune);
    fTune.add(t, 'rotY', -180, 180, 1).onChange(ctx.applyTune);
    const clips = ctx.getClips();
    if (clips.length) {
      state.clip = clips[0];
      fTune.add(state, 'clip', clips).name('动画 Clip').onChange(ctx.playClip);
    }
  }
  rebuildTune();

  // —— 場景外觀 ——
  const S = ctx.SCENE;
  const fScene = gui.addFolder('场景 Scene');
  fScene.add(S, 'exposure', 0.2, 2.5, 0.01).onChange(ctx.applyScene);
  fScene.add(S, 'envIntensity', 0, 2, 0.01).onChange(ctx.applyScene);
  fScene.add(S, 'hemiIntensity', 0, 3, 0.01).onChange(ctx.applyScene);
  fScene.add(S, 'keyIntensity', 0, 6, 0.01).onChange(ctx.applyScene);
  fScene.addColor(S, 'keyColor').onChange(ctx.applyScene);
  fScene.add(S, 'rimIntensity', 0, 6, 0.01).onChange(ctx.applyScene);
  fScene.addColor(S, 'rimColor').onChange(ctx.applyScene);
  fScene.addColor(S, 'bgTop').onChange(ctx.applyScene);
  fScene.addColor(S, 'bgBottom').onChange(ctx.applyScene);
  fScene.addColor(S, 'stageColor').onChange(ctx.applyScene);
  fScene.add(S, 'autoRotate').onChange(ctx.applyScene);
  fScene.add(S, 'autoRotateSpeed', -6, 6, 0.1).onChange(ctx.applyScene);
  fScene.close();

  // —— 匯出 ——
  gui.add({ exportJson }, 'exportJson').name('💾 导出 / 锁定 Export');

  function exportJson() {
    const json = JSON.stringify({ LAYOUT: ctx.LAYOUT, SCENE: ctx.SCENE, CHAR_TUNE: ctx.CHAR_TUNE }, null, 2);
    navigator.clipboard?.writeText(json).catch(() => {});
    let box = document.getElementById('devExport');
    if (!box) {
      box = document.createElement('div');
      box.id = 'devExport';
      box.innerHTML = '<div class="dev-export-head"><span>已复制到剪贴板 · 贴给 Claude 即可锁定</span><button>✕</button></div><textarea readonly></textarea>';
      document.body.appendChild(box);
      box.querySelector('button').onclick = () => box.remove();
    }
    box.querySelector('textarea').value = json;
  }

  // —— 直接拖曳人物（改 viewShift）——
  let dragging = null;
  ctx.canvas.addEventListener('pointerdown', (e) => {
    if (!open || !state.drag) return;
    dragging = { x: e.clientX, y: e.clientY };
    ctx.canvas.setPointerCapture(e.pointerId);
  });
  ctx.canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const L = ctx.LAYOUT[ctx.getLayoutKey()];
    const r = ctx.canvas.getBoundingClientRect();
    const clamp = (v) => Math.max(-0.5, Math.min(0.5, v));
    L.viewShiftX = clamp(L.viewShiftX + (e.clientX - dragging.x) / r.width);
    L.viewShiftY = clamp(L.viewShiftY + (e.clientY - dragging.y) / r.height);
    dragging = { x: e.clientX, y: e.clientY };
    ctx.applyLayout();
    refresh();
  });
  const endDrag = () => { dragging = null; };
  ctx.canvas.addEventListener('pointerup', endDrag);
  ctx.canvas.addEventListener('pointercancel', endDrag);

  function toggle() {
    open = !open;
    if (open) gui.show(); else { gui.hide(); state.drag = false; ctx.controls.enabled = true; refresh(); }
  }
  window.addEventListener('keydown', (e) => {
    if (document.body.dataset.mode !== 'game' && e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') toggle();
  });

  return {
    toggle,
    refresh,
    isDragMode: () => open && state.drag,
    onCharChanged: rebuildTune,
    onLayoutChanged: () => { state.layout = ctx.getLayoutKey(); rebuildLayout(); refresh(); },
  };
}
