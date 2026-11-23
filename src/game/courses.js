// 球場資料：三座球場洞數各不相同（3 / 6 / 9 洞）
// 每洞：par 標準桿、len 長度(m)、dog 狗腿彎曲量、pinX 旗桿橫向偏移、width 球道寬
//       bunkers / water：[t 沿球道位置 0~1, off 距球道中心線的橫向距離(m), r 半徑(m)]
//       wind：[風速 m/s, 風向角度（0 = 順著發球方向吹）]

export const COURSES = [
  {
    id: 'palm', zh: '椰林湾', en: 'PALM BAY', levelZh: '新手', levelEn: 'BEGINNER', stars: 1,
    desc: '阳伞与帆船点缀的海湾球场，球道宽阔，适合热身。',
    seed: 11, amp: 1.5, tree: 'palm', feature: 'beach', extra: 3, tier: { width: 32, wind: [1, 3], water: 0.25, bunkers: [1, 2] },
    theme: {
      skyTop: '#2e8fe0', skyBottom: '#bfe6ff', fog: '#cfeaff', sea: '#1fa3c9', sun: '#fff3d6',
      fairwayA: '#63c04a', fairwayB: '#55b140', rough: '#3d8f36', green: '#8fe06a', fringe: '#72cc52',
      sand: '#f1dfa6', beach: '#ecd9a0', water: '#3aa0e0', trunk: '#8a6a45', leaf: '#2f9a4a',
    },
    holes: [
      { par: 3, len: 140, dog: 0, pinX: 5, width: 0, greenR: 12, bunkers: [[0.9, -17, 6]], water: [], wind: [2, 30] },
      { par: 4, len: 315, dog: 16, pinX: -10, width: 32, greenR: 12, bunkers: [[0.62, 21, 8], [0.95, 17, 6]], water: [], wind: [3, 120] },
      { par: 3, len: 165, dog: 0, pinX: -8, width: 0, greenR: 13, bunkers: [[0.93, 18, 5]], water: [[0.5, 0, 22]], wind: [2, 250] },
    ],
  },
  {
    id: 'coral', zh: '珊瑚海岸', en: 'CORAL COAST', levelZh: '进阶', levelEn: 'ADVANCED', stars: 2,
    desc: '夕阳与灯塔下的海岸球场，水障碍环伺，海风渐强。',
    seed: 23, amp: 2.2, tree: 'palm', feature: 'lighthouse', extra: 3, tier: { width: 29, wind: [3, 6], water: 0.55, bunkers: [2, 3] },
    theme: {
      skyTop: '#f08a4b', skyBottom: '#ffe0b0', fog: '#ffd9b3', sea: '#3d7fb8', sun: '#ffd7a0',
      fairwayA: '#7cbf45', fairwayB: '#6eb03c', rough: '#4f8f34', green: '#a2e068', fringe: '#86cc52',
      sand: '#f5d9a0', beach: '#f0cf98', water: '#4f9fd8', trunk: '#7d5a3a', leaf: '#3a8f40',
    },
    holes: [
      { par: 4, len: 330, dog: -18, pinX: 8, width: 30, greenR: 12, bunkers: [[0.6, -20, 8], [0.94, -17, 6]], water: [[0.35, 30, 14]], wind: [4, 60] },
      { par: 3, len: 150, dog: 0, pinX: 0, width: 0, greenR: 11, bunkers: [[0.9, 16, 5], [0.9, -16, 5]], water: [], wind: [4, 300] },
      { par: 5, len: 455, dog: 22, pinX: -12, width: 30, greenR: 13, bunkers: [[0.45, 20, 9], [0.75, -21, 8], [0.96, 18, 6]], water: [], wind: [3, 180] },
      { par: 4, len: 345, dog: 12, pinX: 14, width: 28, greenR: 11, bunkers: [[0.95, -16, 6]], water: [[0.66, -4, 20]], wind: [5, 90] },
      { par: 3, len: 175, dog: 0, pinX: 10, width: 0, greenR: 12, bunkers: [[0.92, -18, 6]], water: [[0.55, 4, 26]], wind: [4, 210] },
      { par: 4, len: 360, dog: -20, pinX: -6, width: 28, greenR: 12, bunkers: [[0.55, 19, 8], [0.7, -20, 8], [0.95, 17, 5]], water: [], wind: [5, 0] },
    ],
  },
  {
    id: 'volcano', zh: '火山岭', en: 'VOLCANO RIDGE', levelZh: '大师', levelEn: 'MASTER', stars: 3,
    desc: '熔岩池与玄武岩之间的锦标赛球场，球道狭窄、强风不断。',
    seed: 37, amp: 3.0, tree: 'pine', feature: 'lava', extra: 9, tier: { width: 24, wind: [4, 8], water: 0.5, bunkers: [2, 4] },
    theme: {
      skyTop: '#5b6fa8', skyBottom: '#f3c6a0', fog: '#d9c2b8', sea: '#35557a', sun: '#ffe2c0',
      fairwayA: '#6aae4a', fairwayB: '#5c9f40', rough: '#5a6b3a', green: '#93d867', fringe: '#79c153',
      sand: '#d8c8a8', beach: '#5a4a44', water: '#ff5a1a', trunk: '#5a4636', leaf: '#2f6f48',
    },
    holes: [
      { par: 4, len: 340, dog: 14, pinX: -8, width: 25, greenR: 11, bunkers: [[0.6, 18, 7], [0.95, -16, 5]], water: [], wind: [5, 45] },
      { par: 5, len: 470, dog: -24, pinX: 10, width: 25, greenR: 12, bunkers: [[0.4, -19, 8], [0.72, 18, 8], [0.96, -17, 6]], water: [[0.85, 22, 12]], wind: [6, 270] },
      { par: 3, len: 160, dog: 0, pinX: -6, width: 0, greenR: 10, bunkers: [[0.9, 15, 5], [0.93, -15, 5]], water: [[0.5, 0, 24]], wind: [6, 120] },
      { par: 4, len: 370, dog: 20, pinX: 12, width: 24, greenR: 11, bunkers: [[0.58, -18, 8], [0.95, 16, 6]], water: [[0.3, 28, 13]], wind: [5, 200] },
      { par: 4, len: 325, dog: -16, pinX: -12, width: 24, greenR: 10, bunkers: [[0.65, 18, 7], [0.94, 15, 5], [0.94, -15, 5]], water: [], wind: [7, 330] },
      { par: 3, len: 185, dog: 0, pinX: 8, width: 0, greenR: 11, bunkers: [[0.9, -16, 6]], water: [[0.55, -6, 26]], wind: [6, 80] },
      { par: 5, len: 485, dog: 26, pinX: -14, width: 25, greenR: 12, bunkers: [[0.42, 19, 9], [0.7, -19, 8], [0.96, 17, 6]], water: [[0.58, 6, 16]], wind: [5, 160] },
      { par: 4, len: 355, dog: -10, pinX: 6, width: 23, greenR: 10, bunkers: [[0.6, -17, 7], [0.95, -15, 5]], water: [[0.78, 20, 13]], wind: [7, 240] },
      { par: 4, len: 380, dog: 18, pinX: 0, width: 24, greenR: 11, bunkers: [[0.55, 18, 8], [0.75, -18, 7], [0.95, 16, 5], [0.95, -16, 5]], water: [], wind: [8, 20] },
    ],
  },
];

// 依球場難度自動產生額外的球洞（固定亂數種子，每次都一樣）
function rng(a) { return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function genHole(r, c, lastPar) {
  const T = c.tier, R = (a, b) => a + r() * (b - a), I = (a, b) => Math.round(R(a, b)), S = () => (r() < 0.5 ? -1 : 1);
  let par = r() < 0.27 ? 3 : r() < 0.72 ? 4 : 5;
  if (par === lastPar && par !== 4) par = 4; // 避免連續兩個短洞或長洞
  const len = par === 3 ? I(125, 190) : par === 4 ? I(300, 385) : I(440, 510);
  const width = par === 3 ? 0 : T.width + I(-2, 2), half = width / 2 || 10;
  const h = { par, len, dog: par === 3 ? 0 : S() * I(8, 26), pinX: S() * I(0, 14), width, greenR: I(10, 13), bunkers: [], water: [], wind: [I(T.wind[0], T.wind[1]), I(0, 359)] };
  h.bunkers.push([R(0.9, 0.95), S() * I(15, 18), I(5, 6)]); // 果嶺邊沙坑
  for (let i = 1, n = I(T.bunkers[0], T.bunkers[1]); i < n && par > 3; i++) h.bunkers.push([R(0.38, 0.78), S() * (half + I(4, 8)), I(7, 9)]);
  if (r() < T.water) h.water.push(par === 3 ? [R(0.45, 0.58), S() * I(0, 6), I(20, 26)] : [R(0.3, 0.8), S() * (half + I(10, 14)), I(12, 16)]);
  return h;
}
for (const c of COURSES) {
  const r = rng(c.seed * 977 + 5);
  for (let i = 0; i < c.extra; i++) c.holes.push(genHole(r, c, c.holes[c.holes.length - 1].par));
}

export const coursePar = (c) => c.holes.reduce((s, h) => s + h.par, 0);

// 球桿：carry 為滿力落點距離(m，力量值 6 的基準)，loft 為起飛角
export const CLUBS = [
  { id: '1W', zh: '一号木', en: 'DRIVER', carry: 225, loft: 13, teeOnly: true },
  { id: '3W', zh: '三号木', en: '3 WOOD', carry: 200, loft: 15 },
  { id: '5I', zh: '五号铁', en: '5 IRON', carry: 168, loft: 19 },
  { id: '7I', zh: '七号铁', en: '7 IRON', carry: 143, loft: 23 },
  { id: '9I', zh: '九号铁', en: '9 IRON', carry: 118, loft: 28 },
  { id: 'PW', zh: '劈起杆', en: 'P WEDGE', carry: 92, loft: 35 },
  { id: 'SW', zh: '沙坑杆', en: 'S WEDGE', carry: 62, loft: 44 },
  { id: 'PT', zh: '推杆', en: 'PUTTER', carry: 0, loft: 0, putter: true },
];

export const LIE = {
  tee: { zh: '发球台', en: 'TEE', dist: 1, err: 1 },
  fairway: { zh: '球道', en: 'FAIRWAY', dist: 1, err: 1 },
  fringe: { zh: '果岭环', en: 'FRINGE', dist: 1, err: 1 },
  green: { zh: '果岭', en: 'GREEN', dist: 1, err: 1 },
  rough: { zh: '长草', en: 'ROUGH', dist: 0.85, err: 1.45 },
  bunker: { zh: '沙坑', en: 'BUNKER', dist: 0.68, err: 1.7 },
};

export const SCORE_NAMES = {
  '-3': { zh: '信天翁', en: 'ALBATROSS' }, '-2': { zh: '老鹰球', en: 'EAGLE' }, '-1': { zh: '小鸟球', en: 'BIRDIE' },
  0: { zh: '标准杆', en: 'PAR' }, 1: { zh: '柏忌', en: 'BOGEY' }, 2: { zh: '双柏忌', en: 'DOUBLE BOGEY' }, 3: { zh: '三柏忌', en: 'TRIPLE BOGEY' },
};
