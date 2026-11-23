#!/usr/bin/env node
/**
 * 背景音樂：把下面的樂譜寫成 MIDI，用 fluidsynth + 音色庫算成真實樂器的音檔，再用 ffmpeg 轉成 m4a。
 * 需要：brew install fluidsynth ffmpeg，以及 GeneralUser-GS.sf2 音色庫
 *       （依序找：SF2 環境變數、tools/soundfont/、隔壁棒球專案裡的那份）
 * 用法：node tools/gen_bgm.mjs [menu course]
 * 產出：public/audio/bgm_<名稱>.m4a（尾端多留一點殘響）與 public/audio/bgm.json（每首的循環長度）
 * 風格：輕快的 bossa 流行——尼龍吉他伴奏、木琴／顫音琴主旋律、木貝斯、沙鈴與鼓邊
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/audio");
const SF = [process.env.SF2, path.join(ROOT, "tools/soundfont/GeneralUser-GS.sf2"), path.join(ROOT, "../棒球遊戲/tools/soundfont/GeneralUser-GS.sf2")].find((p) => p && existsSync(p));
if (!SF) { console.error("找不到音色庫 GeneralUser-GS.sf2，請用 SF2=路徑 指定"); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const PPQ = 480, E = PPQ / 2; // 八分音符
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pitch = (n) => { const m = /^([A-G])(#|b)?(\d)$/.exec(n); return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0); };
// 和弦：[根音(低八度), 伴奏用的四個音]
const CH = {
  Cmaj7: ["C2", ["E3", "G3", "B3", "D4"]], Am7: ["A1", ["E3", "G3", "C4", "E4"]], Dm7: ["D2", ["F3", "A3", "C4", "E4"]], G7: ["G1", ["F3", "A3", "B3", "D4"]],
  Em7: ["E2", ["D3", "G3", "B3", "E4"]], A7: ["A1", ["E3", "G3", "C#4", "E4"]], Fmaj7: ["F1", ["E3", "A3", "C4", "E4"]],
};
// 16 小節：每小節 [前半和弦, 後半和弦, 主旋律 8 個八分音符（- 延音、. 休止）]
const A = [
  ["Cmaj7", "Cmaj7", "E5 - G5 E5 - D5 C5 -"], ["Am7", "Am7", "A4 - C5 E5 - D5 C5 A4"], ["Dm7", "Dm7", "D5 - F5 A5 - G5 F5 -"], ["G7", "G7", "G5 - F5 D5 B4 - . ."],
  ["Em7", "Em7", "E5 - G5 B5 - A5 G5 -"], ["A7", "A7", "A5 - G5 E5 C#5 - E5 -"], ["Dm7", "Dm7", "F5 - E5 D5 - F5 A5 -"], ["G7", "G7", "G5 - - - . D5 E5 G5"],
];
const B = [
  ["Fmaj7", "Fmaj7", "A5 - C6 A5 - G5 F5 -"], ["Em7", "Em7", "G5 - B5 G5 - E5 D5 -"], ["Dm7", "Dm7", "F5 - A5 F5 - E5 D5 -"], ["Cmaj7", "Cmaj7", "E5 - G5 E5 C5 - . ."],
  ["Fmaj7", "Fmaj7", "A5 - C6 A5 - G5 F5 A5"], ["Em7", "A7", "G5 - E5 G5 A5 - C#5 E5"], ["Dm7", "G7", "D5 - F5 A5 G5 - F5 D5"], ["Cmaj7", "Cmaj7", "C5 - - E5 G5 - C6 -"],
];
// 第二段旋律（球場用）：同一組和聲上的另一條線，音域較高、切分較多
const A2 = [
  ["Cmaj7", "Cmaj7", ". G5 E5 G5 - C6 B5 -"], ["Am7", "Am7", ". E5 C5 E5 - A5 G5 E5"], ["Dm7", "Dm7", ". F5 D5 F5 - A5 C6 -"], ["G7", "G7", "B5 - A5 G5 - F5 D5 -"],
  ["Em7", "Em7", ". G5 E5 G5 - B5 D6 -"], ["A7", "A7", "C#6 - B5 A5 - G5 E5 -"], ["Dm7", "Dm7", ". A5 F5 A5 - D6 C6 A5"], ["G7", "G7", "B5 - - G5 - A5 B5 D6"],
];
const SONGS = {
  // 主畫面、選角：悠閒
  menu: { bpm: 104, shift: 0, bars: [...A, ...B], lead: 12 /* 木琴 */, lead2: 73 /* 長笛，B 段疊上 */, comp: 24 /* 尼龍吉他 */, swing: 0.1 },
  // 球場上：更輕快、移到 G 大調
  course: { bpm: 118, shift: -5, bars: [...A2, ...B, ...A2, ...A], lead: 11 /* 顫音琴 */, lead2: 78 /* 口哨 */, comp: 25 /* 鋼弦吉他 */, swing: 0.06 },
};

// —— MIDI 寫檔 ——
const vlq = (n) => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
function trackBytes(events) {
  events.sort((a, b) => a.t - b.t || a.o - b.o);
  const out = []; let last = 0;
  for (const e of events) { out.push(...vlq(Math.max(0, Math.round(e.t - last))), ...e.d); last = Math.round(e.t); }
  out.push(0, 0xff, 0x2f, 0);
  return Buffer.concat([Buffer.from("MTrk"), u32(out.length), Buffer.from(out)]);
}
const u32 = (n) => Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const u16 = (n) => Buffer.from([(n >>> 8) & 255, n & 255]);

function build(song) {
  const tracks = [];
  const tempo = Math.round(60000000 / song.bpm);
  tracks.push([{ t: 0, o: 0, d: [0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255] }]);
  const mk = (ch, prog, vol, pan) => { const ev = [{ t: 0, o: 0, d: [0xc0 | ch, prog] }, { t: 0, o: 0, d: [0xb0 | ch, 7, vol] }, { t: 0, o: 0, d: [0xb0 | ch, 10, pan] }, { t: 0, o: 0, d: [0xb0 | ch, 91, 46] }]; tracks.push(ev); return ev; };
  const note = (ev, ch, p, t, dur, vel) => { ev.push({ t, o: 1, d: [0x90 | ch, p, vel] }, { t: t + dur - 8, o: 0, d: [0x80 | ch, p, 0] }); };
  const lead = mk(0, song.lead, 104, 64), lead2 = mk(1, song.lead2, 78, 84), comp = mk(2, song.comp, 84, 40), bass = mk(3, 32, 96, 64), pad = mk(4, 88, 46, 64);
  const drums = []; tracks.push(drums);
  const sw = (i) => (i % 2 ? song.swing * E : 0); // 反拍稍微延後，帶一點搖擺
  song.bars.forEach(([c1, c2, mel], bi) => {
    const t0 = bi * 8 * E, sect = Math.floor(bi / 8);
    // 主旋律
    const toks = mel.split(" ");
    for (let i = 0; i < 8; i++) {
      if (toks[i] === "-" || toks[i] === ".") continue;
      let len = 1; while (i + len < 8 && toks[i + len] === "-") len++;
      const p = pitch(toks[i]) + song.shift, t = t0 + i * E + sw(i);
      note(lead, 0, p, t, len * E * 0.95, 92 + (i % 4 === 0 ? 10 : 0));
      if (sect % 2 === 1) note(lead2, 1, p + 12 > 96 ? p : p, t, len * E * 0.98, 70); // B 段疊第二樂器
    }
    // 吉他伴奏（bossa 節奏）與貝斯
    [[c1, 0], [c2, 4]].forEach(([c, off]) => {
      const [root, tones] = CH[c], hits = off === 0 ? [0, 3] : [0, 2, 3];
      for (const h of hits) tones.forEach((n, k) => note(comp, 2, pitch(n) + song.shift, t0 + (off + h) * E + sw(h) + k * 6, E * (h === 0 ? 1.6 : 0.8), 58 + (h === 0 ? 10 : 0)));
      const r = pitch(root) + song.shift + (pitch(root) + song.shift < 28 ? 12 : 0);
      note(bass, 3, r, t0 + off * E, E * 2.6, 96);
      note(bass, 3, r + 7, t0 + (off + 3) * E + sw(3), E * 0.9, 84);
    });
    // 長音鋪底
    CH[c1][1].slice(1).forEach((n) => note(pad, 4, pitch(n) + song.shift + 12, t0, 8 * E, 40));
    // 打擊：沙鈴、鼓邊、輕大鼓、每四小節一個三角鐵
    for (let i = 0; i < 8; i++) {
      const t = t0 + i * E + sw(i);
      drums.push({ t, o: 1, d: [0x99, 70, i % 2 ? 62 : 44] }, { t: t + 60, o: 0, d: [0x89, 70, 0] });
      if (i === 2 || i === 6) drums.push({ t, o: 1, d: [0x99, 37, 66] }, { t: t + 60, o: 0, d: [0x89, 37, 0] });
      if (i === 0 || i === 4) drums.push({ t, o: 1, d: [0x99, 36, 58] }, { t: t + 60, o: 0, d: [0x89, 36, 0] });
      if (i === 3 && sect > 0) drums.push({ t, o: 1, d: [0x99, 54, 40] }, { t: t + 60, o: 0, d: [0x89, 54, 0] });
    }
    if (bi % 4 === 0) drums.push({ t: t0, o: 1, d: [0x99, 81, 54] }, { t: t0 + 200, o: 0, d: [0x89, 81, 0] });
  });
  const hdr = Buffer.concat([Buffer.from("MThd"), u32(6), u16(1), u16(tracks.length), u16(PPQ)]);
  return { midi: Buffer.concat([hdr, ...tracks.map(trackBytes)]), loop: (song.bars.length * 4 * 60) / song.bpm };
}

const want = process.argv.slice(2).filter((a) => SONGS[a]);
const names = want.length ? want : Object.keys(SONGS);
const metaFile = path.join(OUT, "bgm.json");
const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, "utf-8")) : {};
for (const name of names) {
  const { midi, loop } = build(SONGS[name]);
  const mid = path.join(tmpdir(), `golf_bgm_${name}_${process.pid}.mid`), wav = mid.replace(/\.mid$/, ".wav"), dest = path.join(OUT, `bgm_${name}.m4a`);
  try {
    writeFileSync(mid, midi);
    execFileSync("fluidsynth", ["-ni", "-q", "-g", "0.7", "-r", "44100", "-F", wav, SF, mid], { stdio: "ignore", timeout: 120000 });
    // 保留循環長度後 2.5 秒的殘響，播放端在循環點疊上下一輪
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-t", String(loop + 2.5), "-af", "afade=t=out:st=" + (loop + 1.5).toFixed(3) + ":d=1", "-c:a", "aac", "-b:a", "128k", dest], { stdio: "inherit", timeout: 120000 });
    meta[name] = { file: `bgm_${name}.m4a`, loop: +loop.toFixed(4) };
    console.log(`✓ ${name} → public/audio/bgm_${name}.m4a（循環 ${loop.toFixed(1)} 秒）`);
  } finally { for (const f of [mid, wav]) if (existsSync(f)) rmSync(f); }
}
writeFileSync(metaFile, JSON.stringify(meta, null, 2));
