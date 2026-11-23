#!/usr/bin/env node
/**
 * 背景音樂：把下面的樂譜寫成 MIDI，用 fluidsynth + 音色庫算成真實樂器的音檔，再用 ffmpeg 轉成 m4a。
 * 需要：brew install fluidsynth ffmpeg，以及 GeneralUser-GS.sf2 音色庫
 *       （依序找：SF2 環境變數、tools/soundfont/、隔壁棒球專案裡的那份）
 * 用法：node tools/gen_bgm.mjs [menu course]
 * 產出：public/audio/bgm_<名稱>.m4a（尾端多留一點殘響）與 public/audio/bgm.json（每首的循環長度）
 * 風格：輕爵士沙發音樂——電鋼琴九和弦切分伴奏、鋼琴／爵士吉他留白旋律、無琴格貝斯、合成墊與弦樂鋪底、鼓刷
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
// 和弦：[根音, 電鋼琴用的四個音（多半不含根音的九和弦／十三和弦排列）]
const CH = {
  Dmaj9: ["D2", ["F#3", "A3", "C#4", "E4"]], Bm9: ["B1", ["D3", "F#3", "A3", "C#4"]], Em9: ["E2", ["D3", "F#3", "G3", "B3"]], A13: ["A1", ["G3", "B3", "C#4", "F#4"]],
  A7sus: ["A1", ["G3", "B3", "D4", "E4"]], A7b9: ["A1", ["G3", "Bb3", "C#4", "E4"]], Gmaj9: ["G1", ["F#3", "A3", "B3", "D4"]], "F#m7": ["F#2", ["E3", "A3", "B3", "C#4"]],
  Gm9: ["G1", ["F3", "A3", "Bb3", "D4"]],
};
// 每小節 [前半和弦, 後半和弦, 主旋律 8 個八分音符（- 延音、. 休止）]。旋律刻意留白，落在九音、六音這些有顏色的音上
const A = [
  ["Dmaj9", "Dmaj9", ". . F#5 - E5 - A4 -"], ["Bm9", "Bm9", "C#5 - - - . D5 C#5 A4"], ["Em9", "Em9", "B4 - - F#5 - - G5 -"], ["A13", "A13", "F#5 - E5 - C#5 - . ."],
  ["Dmaj9", "Dmaj9", ". . A5 - F#5 - E5 -"], ["Bm9", "Bm9", "D5 - - C#5 - A4 - -"], ["Em9", "Em9", ". B4 D5 F#5 - - E5 -"], ["A7sus", "A7b9", "D5 - - - C#5 - Bb4 -"],
];
const B = [
  ["Gmaj9", "Gmaj9", ". . B5 - A5 - F#5 -"], ["F#m7", "F#m7", "E5 - - C#5 - - A4 -"], ["Em9", "Em9", ". G5 - F#5 - D5 B4 -"], ["A13", "A13", "C#5 - - - . . E5 F#5"],
  ["Gmaj9", "Gmaj9", "A5 - - B5 - A5 F#5 -"], ["Gm9", "Gm9", "A5 - - Bb5 - A5 F5 -"], ["Dmaj9", "Bm9", "F#5 - - - E5 - D5 -"], ["Em9", "A7sus", "B4 - D5 - E5 - - -"],
];
// 第二段旋律（球場用）：同一組和聲，句子更短、更靠後拍
const A2 = [
  ["Dmaj9", "Dmaj9", ". . . A5 - F#5 E5 -"], ["Bm9", "Bm9", ". C#5 - D5 - - F#5 -"], ["Em9", "Em9", ". . G5 - F#5 - D5 -"], ["A13", "A13", "E5 - - - . F#5 E5 C#5"],
  ["Dmaj9", "Dmaj9", ". . . F#5 - A5 B5 -"], ["Bm9", "Bm9", "A5 - - F#5 - - D5 -"], ["Em9", "Em9", ". E5 - G5 - B5 - A5"], ["A7sus", "A7b9", "- - - . E5 - C#5 -"],
];
const SONGS = {
  // 主畫面、選角：慢板沙發爵士，鋼琴旋律
  menu: { bpm: 84, shift: 0, bars: [...A, ...A2, ...B, ...A], lead: 0 /* 鋼琴 */, lead2: 26 /* 爵士吉他，B 段低八度疊上 */, swing: 0.16 },
  // 球場上：稍快，移到 F 大調，爵士吉他旋律
  course: { bpm: 98, shift: 3, bars: [...A2, ...B, ...A, ...B], lead: 26 /* 爵士吉他 */, lead2: 0 /* 鋼琴 */, swing: 0.13 },
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
  // 每軌：音色、音量、左右位置、殘響量、合唱量
  const mk = (ch, prog, vol, pan, rev = 60, cho = 0) => { const ev = [{ t: 0, o: 0, d: [0xc0 | ch, prog] }, { t: 0, o: 0, d: [0xb0 | ch, 7, vol] }, { t: 0, o: 0, d: [0xb0 | ch, 10, pan] }, { t: 0, o: 0, d: [0xb0 | ch, 91, rev] }, { t: 0, o: 0, d: [0xb0 | ch, 93, cho] }]; tracks.push(ev); return ev; };
  let seed = 12345; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // 固定亂數：每次算出來都一樣
  const note = (ev, ch, p, t, dur, vel) => { const tt = Math.max(0, t + (rnd() - 0.5) * 14), v = Math.max(1, Math.min(127, Math.round(vel + (rnd() - 0.5) * 10))); ev.push({ t: tt, o: 1, d: [0x90 | ch, p, v] }, { t: tt + dur - 8, o: 0, d: [0x80 | ch, p, 0] }); }; // 時間與力度都帶一點人味
  const lead = mk(0, song.lead, 100, 64, 72), lead2 = mk(1, song.lead2, 62, 86, 70), ep = mk(2, 4 /* 電鋼琴 */, 82, 44, 58, 50), bass = mk(3, 35 /* 無琴格貝斯 */, 98, 64, 20), pad = mk(4, 89 /* 暖色合成墊 */, 40, 64, 80), str = mk(5, 48 /* 弦樂 */, 34, 76, 86);
  const drums = [{ t: 0, o: 0, d: [0xc9, 40] /* 鼓刷套鼓 */ }, { t: 0, o: 0, d: [0xb9, 7, 92] }, { t: 0, o: 0, d: [0xb9, 91, 40] }]; tracks.push(drums);
  const hit = (p, t, v) => drums.push({ t, o: 1, d: [0x99, p, Math.max(1, Math.round(v + (rnd() - 0.5) * 8))] }, { t: t + 60, o: 0, d: [0x89, p, 0] });
  const sw = (i) => (i % 2 ? song.swing * E : 0); // 反拍延後：搖擺感
  const N = song.bars.length;
  song.bars.forEach(([c1, c2, mel], bi) => {
    const t0 = bi * 8 * E, sect = Math.floor(bi / 8), next = song.bars[(bi + 1) % N][0];
    // 主旋律
    const toks = mel.split(" ");
    for (let i = 0; i < 8; i++) {
      if (toks[i] === "-" || toks[i] === ".") continue;
      let len = 1; while (i + len < 8 && toks[i + len] === "-") len++;
      const p = pitch(toks[i]) + song.shift, t = t0 + i * E + sw(i);
      note(lead, 0, p, t, len * E * 0.97, 84 + (i % 4 === 0 ? 8 : 0));
      if (sect % 2 === 1) note(lead2, 1, p - 12, t + 6, len * E * 0.97, 60); // 奇數段低八度疊第二樂器
    }
    // 電鋼琴：第一拍長和弦、切分的短和弦，小節最後半拍搶先彈下一小節的和弦
    const stab = (c, at, len, vel) => CH[c][1].forEach((n, k) => note(ep, 2, pitch(n) + song.shift, t0 + at * E + sw(at) + k * 11, E * len, vel - k * 2));
    if (c1 === c2) { stab(c1, 0, 2.7, 60); stab(c1, 3, 1.1, 50); stab(c1, 5, 1.4, 52); }
    else { stab(c1, 0, 2.2, 60); stab(c1, 3, 0.9, 50); stab(c2, 4, 1.8, 58); stab(c2, 6, 0.9, 50); }
    stab(next, 7, 0.95, 54);
    // 貝斯：根音、五度，最後半拍用半音靠向下一個根音
    const root = (c) => { const r = pitch(CH[c][0]) + song.shift; return r < 28 ? r + 12 : r > 43 ? r - 12 : r; };
    const r1 = root(c1), r2 = root(c2), rn = root(next);
    note(bass, 3, r1, t0, E * 2.8, 96);
    note(bass, 3, r1 + 7, t0 + 3 * E + sw(3), E * 0.9, 80);
    note(bass, 3, r2, t0 + 4 * E, E * 2.3, 90);
    note(bass, 3, rn + (rn >= r2 ? -1 : 1), t0 + 7 * E + sw(7), E * 0.85, 82);
    // 鋪底：合成墊整小節長音；弦樂只在偶數段出現，托住最高的兩個音
    CH[c1][1].slice(0, 3).forEach((n) => note(pad, 4, pitch(n) + song.shift, t0, 8 * E, 44));
    if (sect % 2 === 1) CH[c1][1].slice(2).forEach((n) => note(str, 5, pitch(n) + song.shift + 12, t0, 8 * E, 46));
    // 鼓刷：八分音符的腳踏鈸（反拍稍重）、第二四拍的鼓邊、大鼓在第一拍與第三拍前半拍
    for (let i = 0; i < 8; i++) {
      const t = t0 + i * E + sw(i);
      hit(42, t, i % 2 ? 46 : 32);
      if (i === 2 || i === 6) hit(37, t, 58);
      if (i === 0 || i === 5) hit(36, t, sect === 0 ? 48 : 60);
      if (sect > 0 && i % 2 === 0) hit(51, t, 30); // 第二段起加上輕輕的疊音鈸
    }
    if (bi % 8 === 7) { hit(38, t0 + 6 * E, 40); hit(38, t0 + 7 * E + sw(7), 48); hit(49, t0 + 8 * E, 44); } // 每段結尾一個小過門
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
    execFileSync("fluidsynth", ["-ni", "-q", "-g", "0.75", "-r", "44100", "-o", "synth.reverb.room-size=0.6", "-o", "synth.reverb.level=0.55", "-F", wav, SF, mid], { stdio: "ignore", timeout: 120000 });
    // 保留循環長度後 2.5 秒的殘響，播放端在循環點疊上下一輪
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-t", String(loop + 2.5), "-af", "afade=t=out:st=" + (loop + 1.5).toFixed(3) + ":d=1", "-c:a", "aac", "-b:a", "128k", dest], { stdio: "inherit", timeout: 120000 });
    meta[name] = { file: `bgm_${name}.m4a`, loop: +loop.toFixed(4) };
    console.log(`✓ ${name} → public/audio/bgm_${name}.m4a（循環 ${loop.toFixed(1)} 秒）`);
  } finally { for (const f of [mid, wav]) if (existsSync(f)) rmSync(f); }
}
writeFileSync(metaFile, JSON.stringify(meta, null, 2));
