#!/usr/bin/env node
/**
 * 封面素材：主視覺插畫（橫式、直式）與去背的標題標誌，透過 codex exec 內建 image_gen。
 * 用法：node tools/gen_title.mjs [title title_m logo]   不帶參數＝全做；已存在的跳過，加 --force 重產
 * 產出：public/ui/title.webp、public/ui/title_m.webp、public/ui/logo.webp（原始大圖留在 assets/ui_master/）
 * 依序執行（一次只跑一個 codex），spawnSync 逾時會自動終止子程序。
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/ui");
const MASTER = path.join(ROOT, "assets/ui_master");
const MODEL = process.env.CODEX_MODEL || "gpt-6.1-sol";
const HERO = path.join(ROOT, "assets/concepts/ace.png");
for (const d of [OUT, MASTER]) mkdirSync(d, { recursive: true });

const ART_STYLE = "风格：高品质的 3D 卡通动画电影主视觉（key art），优雅、宁静、高级感，柔和的清晨金色阳光与淡淡的薄雾，色彩清新不过度饱和，构图留白从容。主角必须是附图中的那位高尔夫球手（同一张脸、同样的发型、同样的帽子或头饰、同样的服装款式与配色、同样的鞋袜与手套），神情从容自信、带着淡淡的微笑（嘴巴闭合，不要咬牙、不要怒吼）。画面中不要出现任何文字、标志、水印或边框，不要火焰、不要爆炸、不要速度线、不要飞溅的泥土。必须是原创画面，不可模仿任何现有游戏。";

const JOBS = {
  title: {
    kind: "art", maxW: 1920,
    prompt: `请用内置 image_gen 工具产一张横式（宽高比 16:9）的图，只要生图、不需要处理文件。主题：一款优雅的高尔夫游戏的封面主视觉。主角在画面左侧，刚完成一记漂亮挥杆后的标准收杆姿势（finish）：身体舒展地转向目标、球杆优雅地绕到身后、目光平静地目送远去的球，姿态挺拔而放松。背景是清晨的海岛高尔夫球场：修剪整齐、带着刈草条纹的翠绿球道，圆润的白色沙坑，远处果岭上一支红色旗杆，几棵棕榈树，平静的海面与远山，天空是柔和的淡蓝到暖金色渐层，有轻盈的云。一颗白色小球在远方的天空中留下一道纤细优美的弧线。画面右下方保留干净的草地与天空区域（之后要叠上游戏标题）。${ART_STYLE}生成后回报 OK 即可。`,
  },
  title_m: {
    kind: "art", maxW: 1080,
    prompt: `请用内置 image_gen 工具产一张直式（宽高比 2:3）的图，只要生图、不需要处理文件。主题：一款优雅的高尔夫游戏的手机版封面主视觉。主角位于画面上半部到中央，刚完成一记漂亮挥杆后的标准收杆姿势（finish）：身体舒展地转向目标、球杆优雅地绕到身后、目光平静地目送远去的球，姿态挺拔而放松。背景是清晨的海岛高尔夫球场：带着刈草条纹的翠绿球道、白色沙坑、远处果岭上的红色旗杆、棕榈树、平静的海面，天空是柔和的淡蓝到暖金色渐层。一颗白色小球在天空中留下一道纤细优美的弧线。画面最下方约三分之一是干净的近景草地（之后要叠上游戏标题与按钮），主角的脸不要被放在最下方。${ART_STYLE}生成后回报 OK 即可。`,
  },
  logo: {
    kind: "logo", maxW: 1000,
    prompt: "请用内置 image_gen 工具产一张横式（宽高比 3:2）的图，只要生图、不需要处理文件。主题：一款高级高尔夫游戏的标题标志（game title logo），主机游戏封面等级的专业标志设计：优雅、华丽、有设计感与记忆点，绝对不能只是把字排成一行。标志的主体是四个简体中文大字（中国大陆规范汉字，不要写成繁体字）「一杆进洞」，四个字必须完全正确、清楚可读、由左到右排列：第一个字「一」（一横）、第二个字「杆」（木字旁加干）、第三个字「进」（走之底加井，不可写成繁体的進）、第四个字「洞」（三点水加同）。字体是专门设计的美术字：笔画有粗细对比与优雅的弧线收笔，字与字之间高低错落、略有大小变化、彼此衔接成一个整体造型；字面是有立体斜角的抛光金属质感——深祖母绿色的珐琅字面，镶着明亮的金色金属斜边与高光，底下有一层深绿色的立体厚度。设计巧思：第一个字「一」的那一横被画成一支优雅的高尔夫球杆（杆头在一端）；一颗带凹点的白色高尔夫球从左下方沿着一道细长的金色弧线飞越整排字的上方，最后落向最右边「洞」字右上角的一支小红旗；四个字的后方衬着一枚精致的盾形徽章，徽章是深绿色底、金色细边，下缘有一条金色缎带，缎带上是间距均匀的衬线英文大写「HOLE IN ONE GOLF」，拼写必须完全正确。整体配色：祖母绿、金色、白色、少量酒红色点缀，质感像高级锦标赛奖杯与俱乐部徽章。不要火焰、不要爆炸星芒、不要卡通厚涂的粗黑外框、不要洋红色或紫色。标志置中、四周留一点空间，背景是完全均匀的纯洋红色 #FF00FF（去背用），背景不要有任何渐层、阴影或其他图案。生成后回报 OK 即可。",
  },
};

// 每位角色各一組封面（橫式 title_<id>、直式 title_m_<id>），參考圖用該角色的概念圖
const HEROES = ['ace', 'skye', 'tank', 'mia', 'joe', 'kai'];
for (const id of HEROES) {
  JOBS[`title_${id}`] = { ...JOBS.title, hero: id };
  JOBS[`title_m_${id}`] = { ...JOBS.title_m, hero: id };
}
delete JOBS.title; delete JOBS.title_m;

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
// 去掉洋紅色背景（含邊緣溢色），裁掉四周空白
const PY_LOGO = `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
out = []
for r, g, b in im.getdata():
    key = min(r, b) - g                      # 洋紅比綠多出多少
    if key <= 40:
        a = 255
    elif key >= 110:
        a = 0
    else:
        a = int(255 * (1 - (key - 40) / 70))
    if key > 0:                              # 邊緣的洋紅溢色壓回去
        m = g + (0 if key > 40 else int(key * (1 - key / 40)))
        r, b = min(r, m), min(b, m)
    out.append((r, g, b, a))
img = Image.new('RGBA', im.size)
img.putdata(out)
box = img.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
img = img.crop(box)
img.save(sys.argv[3])
w = int(sys.argv[4])
img.thumbnail((w, w), Image.LANCZOS)
img.save(sys.argv[2], 'WEBP', quality=90, method=6)
print(img.size)
`;

const argv = process.argv.slice(2);
const force = argv.includes("--force");
const names = argv.filter((a) => !a.startsWith("--"));
const todo = (names.length ? names : Object.keys(JOBS).filter((n) => n !== 'logo')).filter((n) => JOBS[n]);
let fail = 0;

for (const name of todo) {
  const job = JOBS[name];
  const dest = path.join(OUT, `${name}.webp`);
  if (existsSync(dest) && !force) { console.log(`⏭  ${name} 已存在，跳過`); continue; }
  console.log(`▶ ${name}`);
  const args = ["exec", "--skip-git-repo-check", "-m", MODEL];
  const heroImg = path.join(ROOT, `assets/concepts/${job.hero || 'ace'}.png`);
  if (job.kind === "art" && existsSync(heroImg)) args.push("--image", heroImg);
  args.push("--", job.prompt);
  // 這次 codex 工作階段的編號印在輸出裡，用它到專屬資料夾取圖，不會拿錯
  const run = spawnSync("codex", args, { encoding: "utf8", timeout: 8 * 60 * 1000, killSignal: "SIGKILL", stdio: ["ignore", "pipe", "pipe"] });
  const out = `${run.stdout || ""}${run.stderr || ""}`;
  const id = (/session id:\s*([0-9a-f-]+)/.exec(out) || [])[1];
  const dir = id && path.join(homedir(), ".codex", "generated_images", id);
  const png = dir && existsSync(dir) && readdirSync(dir).filter((f) => f.endsWith(".png")).sort().pop();
  if (!png) { console.log(`✗ ${name} 找不到生成的圖${run.error ? `（${run.error.message}）` : ""}`); fail++; continue; }
  try {
    execFileSync("python3", ["-c", job.kind === "logo" ? PY_LOGO : PY_ART, path.join(dir, png), dest, path.join(MASTER, `${name}.png`), String(job.maxW)], { stdio: "inherit" });
    console.log(`✓ ${name} → ${path.relative(ROOT, dest)}`);
  } catch (e) { console.log(`✗ ${name} 後處理失敗：${e.message}`); fail++; }
}
console.log(`=== 完成，失敗 ${fail} ===`);
process.exit(fail ? 1 : 0);
