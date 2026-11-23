#!/usr/bin/env node
/**
 * 介面美術與場景圖批次生成（codex exec 內建 image_gen）。清單：tools/ui_manifest.json
 *   kind "key"：綠幕去背 → public/ui/<id>.webp（透明）
 *   kind "art"：一般插畫 → public/ui/<id>.webp
 * 原始大圖留在 assets/ui_master/<id>.png
 * 用法：node tools/gen_ui.mjs [id ...] [--force] [--workers 2]　已存在的跳過
 * 任何結束路徑都會殺掉 codex 子程序群組；同時最多 2 個。
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/ui"), MASTER = path.join(ROOT, "assets/ui_master"), LOG = path.join(ROOT, "tools/gen_ui.log");
const MODEL = process.env.CODEX_MODEL || "gpt-6.1-sol";
const TIMEOUT_MS = 8 * 60 * 1000;
for (const d of [OUT, MASTER]) mkdirSync(d, { recursive: true });
const manifest = JSON.parse(readFileSync(path.join(ROOT, "tools/ui_manifest.json"), "utf-8"));

const argv = process.argv.slice(2);
const force = argv.includes("--force");
let workers = 2;
const wi = argv.indexOf("--workers");
if (wi >= 0) workers = Math.max(1, Math.min(2, parseInt(argv[wi + 1], 10) || 2));
const names = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--workers");
const pending = manifest.items.filter((it) => (!names.length || names.includes(it.id)) && (force || !existsSync(path.join(OUT, `${it.id}.webp`))));
const log = (m) => { const line = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(line); appendFileSync(LOG, line + "\n"); };

const running = new Set();
function killAll() { for (const cp of running) { try { process.kill(-cp.pid, "SIGKILL"); } catch {} } running.clear(); }
process.on("exit", killAll);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => { killAll(); process.exit(1); });
process.on("uncaughtException", (e) => { log(`例外：${e.message}`); killAll(); process.exit(1); });
process.on("unhandledRejection", (e) => { log(`未處理 rejection：${e}`); killAll(); process.exit(1); });

const PY_ART = `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
im.save(sys.argv[3])
w = int(sys.argv[4])
if im.width > w:
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
im.save(sys.argv[2], 'WEBP', quality=86, method=6)
print(im.size)
`;
const PY_KEY = `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
px = im.load()
W, H = im.size
out = Image.new('RGBA', (W, H))
op = out.load()
for y in range(H):
    for x in range(W):
        r, g, b = px[x, y]
        key = g - max(r, b)
        if key <= 40: a = 255
        elif key >= 110: a = 0
        else: a = int(255 * (1 - (key - 40) / 70))
        if key > 0: g = max(r, b) + (0 if key > 40 else int(key * (1 - key / 40)))
        op[x, y] = (r, g, b, a)
box = out.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
if box: out = out.crop(box)
out.save(sys.argv[3])
w = int(sys.argv[4])
out.thumbnail((w, w), Image.LANCZOS)
out.save(sys.argv[2], 'WEBP', quality=90, method=6)
print(out.size)
`;

function runOne(it) {
  return new Promise((resolve) => {
    const isKey = it.kind === "key";
    const prompt = `请用内置 image_gen 工具产一张（宽高比 ${it.ratio}）的图，只要生图、不需要处理文件。${isKey ? manifest.keyStyle + "主题：" : ""}${it.prompt}生成后回报 OK 即可。`;
    const args = ["exec", "--skip-git-repo-check", "-m", MODEL];
    if (it.image && existsSync(path.join(ROOT, it.image))) args.push("--image", path.join(ROOT, it.image));
    args.push("--", prompt);
    const cp = spawn("codex", args, { detached: true, stdio: ["ignore", "pipe", "pipe"] });
    running.add(cp);
    let out = "";
    cp.stdout.on("data", (d) => { out += d; });
    cp.stderr.on("data", (d) => { out += d; });
    const timer = setTimeout(() => { log(`⏱  ${it.id} 逾時`); try { process.kill(-cp.pid, "SIGKILL"); } catch {} }, TIMEOUT_MS);
    const done = () => {
      clearTimeout(timer); running.delete(cp);
      const id = (/session id:\s*([0-9a-f-]+)/.exec(out) || [])[1];
      const dir = id && path.join(homedir(), ".codex", "generated_images", id);
      const png = dir && existsSync(dir) && readdirSync(dir).filter((f) => f.endsWith(".png")).sort().pop();
      if (!png) return resolve(false);
      try {
        execFileSync("python3", ["-c", isKey ? PY_KEY : PY_ART, path.join(dir, png), path.join(OUT, `${it.id}.webp`), path.join(MASTER, `${it.id}.png`), String(it.maxW)], { stdio: "ignore" });
        resolve(true);
      } catch { resolve(false); }
    };
    cp.on("exit", done);
    cp.on("error", () => { clearTimeout(timer); running.delete(cp); resolve(false); });
  });
}

let ok = 0, fail = 0;
const total = pending.length;
log(`=== 開始 ${total} 張，workers=${workers} ===`);
async function worker() {
  for (;;) {
    const it = pending.shift();
    if (!it) return;
    const t0 = Date.now();
    const good = await runOne(it);
    good ? ok++ : fail++;
    log(`${good ? "✓" : "✗"} ${it.id} ${((Date.now() - t0) / 1000).toFixed(0)}s [${ok + fail}/${total}]`);
  }
}
await Promise.all(Array.from({ length: workers }, worker));
log(`=== 完成 ok=${ok} fail=${fail} ===`);
process.exit(fail ? 1 : 0);
