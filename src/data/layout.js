// 版面與場景參數：DEV 工具（D 鍵）調好後按「导出」，再把 JSON 貼回這裡鎖定

// 依裝置分開的版面
export const LAYOUT = {
  PC: {
    camFov: 30, camDist: 5.3, camHeight: 1.35, targetY: 0.95,
    viewShiftX: -0.12, viewShiftY: -0.02, // 人物在畫面上的位移（佔畫面比例）
    // 封面：主視覺對焦點（%）、標誌距右／距下（vw／vh）與寬度（vw）、開始鈕距下（vh）
    title: { artX: 30, artY: 6, logoX: 3, logoY: 16, logoW: 46, startY: 5.5 },
  },
  MOBILE: {
    camFov: 34, camDist: 8.0, camHeight: 1.4, targetY: 0.95,
    viewShiftX: 0, viewShiftY: -0.165,
    title: { artX: 50, artY: 10, logoX: 3, logoY: 15, logoW: 94, startY: 5 },
  },
};

// 共用的場景外觀
export const SCENE = {
  exposure: 1.0,
  envIntensity: 0.6,
  hemiIntensity: 0.9,
  keyIntensity: 2.2, keyColor: '#fff4e0',
  rimIntensity: 1.5, rimColor: '#bfe3ff',
  bgTop: '#2f8fd6', bgBottom: '#bfe8a8',
  stageColor: '#f4f7f2',
  autoRotate: false, autoRotateSpeed: 1.2,
};

// 每位角色的模型校正（AI 生成的 GLB 尺寸與朝向常不一致）
export const CHAR_TUNE = {
  ace: { scale: 1, y: 0, rotY: 0 },
  skye: { scale: 1, y: 0, rotY: 0 },
  tank: { scale: 1, y: 0, rotY: 0 },
  mia: { scale: 1, y: 0, rotY: 0 },
  joe: { scale: 1, y: 0, rotY: 0 },
  kai: { scale: 1, y: 0, rotY: 0 },
};

export function pickLayoutKey() {
  return window.innerWidth < 768 || window.innerHeight > window.innerWidth ? 'MOBILE' : 'PC';
}

// 遊戲中的鏡頭（依裝置分開）：DEV 工具（D 鍵）可調
export const GAME = {
  PC: { viewShift: 0.12, fov: 48, back: 7.5, up: 2.7, side: 1.5, look: 34, puttBack: 5.2, puttUp: 2.3, flyBack: 9, flyUp: 3.4 },
  MOBILE: { viewShift: 0.2, fov: 64, back: 9.5, up: 3.6, side: 0.5, look: 34, puttBack: 7, puttUp: 3, flyBack: 11, flyUp: 4.2 },
};
// 揮桿節奏（秒）
export const SWING = { back: 0.7, hold: 0.12, down: 0.2, follow: 0.45, puttBack: 0.5, puttDown: 0.28, puttFollow: 0.35, meterUp: 1.05, meterDown: 1.2 };
