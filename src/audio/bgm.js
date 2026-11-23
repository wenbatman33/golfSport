// 背景音樂：播放 tools/gen_bgm.mjs 產生的音檔，在循環點疊上下一輪（保留殘響、沒有接縫）
const BASE = import.meta.env.BASE_URL;
let ac = null, gain = null, meta = null, current = null, wanted = null, timer = 0, muted = false;
const buffers = {};
const live = new Set();
const VOL = 0.3;

try { muted = localStorage.getItem('golf_mute') === '1'; } catch {}

function ctx() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    gain = ac.createGain(); gain.gain.value = muted ? 0 : VOL; gain.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

async function load(name) {
  if (buffers[name]) return buffers[name];
  if (!meta) meta = await fetch(`${BASE}audio/bgm.json`).then((r) => r.json());
  if (!meta[name]) throw new Error(`沒有這首音樂：${name}`);
  const data = await fetch(`${BASE}audio/${meta[name].file}`).then((r) => r.arrayBuffer());
  return (buffers[name] = await ctx().decodeAudioData(data));
}

function stopAll(fade = 0.6) {
  clearTimeout(timer);
  for (const n of live) {
    try { n.g.gain.setTargetAtTime(0, ac.currentTime, fade / 3); n.src.stop(ac.currentTime + fade + 0.1); } catch {}
  }
  live.clear();
}

function schedule(name, when) {
  if (current !== name) return;
  const src = ac.createBufferSource(), g = ac.createGain();
  src.buffer = buffers[name];
  src.connect(g).connect(gain);
  src.start(when);
  const node = { src, g };
  live.add(node);
  src.onended = () => live.delete(node);
  const next = when + meta[name].loop;
  timer = setTimeout(() => schedule(name, next), Math.max(0, (next - ac.currentTime - 1.2) * 1000)); // 提前 1.2 秒排好下一輪
}

// 播放指定音樂（需在使用者點擊之後呼叫，瀏覽器才允許出聲）
export async function playBgm(name) {
  wanted = name;
  if (!ctx()) return;
  try {
    await load(name);
    if (wanted !== name || current === name) return;
    stopAll();
    current = name;
    schedule(name, ac.currentTime + 0.15);
  } catch (e) { console.warn('背景音樂載入失敗', e); }
}

export function stopBgm() { wanted = null; current = null; if (ac) stopAll(); }
export const isMuted = () => muted;
export function setBgmMuted(v) {
  muted = v;
  try { localStorage.setItem('golf_mute', v ? '1' : '0'); } catch {}
  if (gain) gain.gain.setTargetAtTime(v ? 0 : VOL, ac.currentTime, 0.1);
}
