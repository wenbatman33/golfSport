// 角色名單（遊戲內文字：簡體中文 + 英文專業用語）
// 模型檔放在 public/models/characters/<id>.glb，概念圖在 assets/concepts/<id>.png

export const STAT_LABELS = [
  { key: 'power', zh: '力量', en: 'POWER' },
  { key: 'accuracy', zh: '精准', en: 'ACCURACY' },
  { key: 'putting', zh: '推杆', en: 'PUTTING' },
  { key: 'spin', zh: '旋球', en: 'SPIN' },
];

export const CHARACTERS = [
  {
    id: 'ace', zh: '林锐', en: 'ACE', typeZh: '全能型', typeEn: 'ALL-ROUNDER',
    desc: '各项能力均衡，适合任何球场。',
    color: '#e5484d', height: 1.76,
    stats: { power: 7, accuracy: 7, putting: 7, spin: 7 },
  },
  {
    id: 'skye', zh: '苏晴', en: 'SKYE', typeZh: '精准型', typeEn: 'PRECISION',
    desc: '铁杆落点极稳，擅长攻果岭。',
    color: '#3b9eff', height: 1.7,
    stats: { power: 5, accuracy: 10, putting: 8, spin: 6 },
  },
  {
    id: 'tank', zh: '铁山', en: 'TANK', typeZh: '力量型', typeEn: 'POWER HITTER',
    desc: '开球距离全场最远，但容易偏出球道。',
    color: '#2f9e62', height: 1.92,
    stats: { power: 10, accuracy: 5, putting: 5, spin: 6 },
  },
  {
    id: 'mia', zh: '米娅', en: 'MIA', typeZh: '推杆型', typeEn: 'PUTTING SPECIALIST',
    desc: '果岭读线一流，长推也能进洞。',
    color: '#f472b6', height: 1.58,
    stats: { power: 4, accuracy: 8, putting: 10, spin: 6 },
  },
  {
    id: 'joe', zh: '老乔', en: 'JOE', typeZh: '老将型', typeEn: 'VETERAN',
    desc: '经验老到，短杆与推杆稳如磐石。',
    color: '#c9a227', height: 1.74,
    stats: { power: 6, accuracy: 9, putting: 9, spin: 5 },
  },
  {
    id: 'kai', zh: '凯', en: 'KAI', typeZh: '旋球型', typeEn: 'SPIN MASTER',
    desc: '擅长 Draw / Fade 与 Backspin，球路变化多端。',
    color: '#ff8a1f', height: 1.78,
    stats: { power: 7, accuracy: 6, putting: 6, spin: 10 },
  },
];
