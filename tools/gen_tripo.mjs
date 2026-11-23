#!/usr/bin/env node
/**
 * golfSport 角色 3D 模型批次生成（Tripo OpenAPI v3）
 * 流程：上傳概念圖 → image-to-model → rig-check → auto rig → retarget 動畫 → 下載 GLB
 *
 * 金鑰：在專案根目錄 .env 寫一行 TRIPO_API_KEY=...（或用環境變數）。金鑰不會被印出或寫進任何檔案。
 *
 * 用法：
 *   node tools/gen_tripo.mjs --dry-run            # 只列出會做什麼與預估點數，不呼叫 API
 *   node tools/gen_tripo.mjs --only ace           # 只跑指定角色（可多個），建議先跑一位看品質
 *   node tools/gen_tripo.mjs --until model        # 只做到指定階段：model | rig | anim（預設 anim）
 *   node tools/gen_tripo.mjs                      # 全部角色跑完整流程（已完成的跳過）
 *   node tools/gen_tripo.mjs --force --only ace   # 丟掉該角色的進度重新生成（會再扣點）
 *
 * 進度存在 tools/tripo_state.json，中斷後重跑會接續，不會重複扣點。
 * 產出：
 *   assets/models_raw/<id>_base.glb   原始模型（無骨架）
 *   assets/models_raw/<id>_rig.glb    綁好骨架的模型
 *   public/models/characters/<id>.glb 帶動畫的最終模型（遊戲載入這個）
 */
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, openAsBlob } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = "https://openapi.tripo3d.ai/v3";
const CONCEPTS = path.join(ROOT, "assets/concepts");
const RAW = path.join(ROOT, "assets/models_raw");
const FINAL = path.join(ROOT, "public/models/characters");
const STATE_FILE = path.join(ROOT, "tools/tripo_state.json");
const LOG = path.join(ROOT, "tools/tripo.log");

// —— 生成參數（依 2026-11 的官方文件 developers.tripo3d.ai）——
const CFG = {
  model: "v3.1-20260211",        // image-to-model 版本（文件標示為推薦、品質最佳）
  textureQuality: "detailed",    // fast | standard | detailed（HD，+10 點）| extreme
  faceLimit: 60000,              // 三角面上限，兼顧手機效能；設 0 表示交給 Tripo 自動決定
  rigModel: "v1.0-20240301",     // v1.0 骨架才有 golf 等 90+ 種預設動畫
  rigSpec: "tripo",
  // 一次最多 5 個；第一個會是展示頁預設播放的動畫
  animations: ["preset:biped:idle", "preset:biped:golf", "preset:biped:victory_celebration", "preset:biped:cheer", "preset:biped:defeat_02"],
};
const POLL_MS = 3000;
const TASK_TIMEOUT_MS = 25 * 60 * 1000;

// —— 參數 ——
const args = process.argv.slice(2);
const only = new Set();
let dryRun = false, force = false, until = "anim";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--only") { while (args[i + 1] && !args[i + 1].startsWith("--")) only.add(args[++i]); }
  else if (args[i] === "--dry-run") dryRun = true;
  else if (args[i] === "--force") force = true;
  else if (args[i] === "--until") until = args[++i];
}
if (!["model", "rig", "anim"].includes(until)) { console.error("--until 只能是 model | rig | anim"); process.exit(1); }

const manifest = JSON.parse(readFileSync(path.join(ROOT, "tools/asset_manifest.json"), "utf-8"));
const items = manifest.items.filter((it) => !only.size || only.has(it.id));
if (!items.length) { console.error("沒有符合的角色 id"); process.exit(1); }

const log = (m) => { const line = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(line); appendFileSync(LOG, line + "\n"); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// —— 預估點數 ——
const costModel = 30 + ({ detailed: 10, extreme: 20 }[CFG.textureQuality] || 0);
const costOf = { model: costModel, rig: costModel + 25, anim: costModel + 25 + 10 * CFG.animations.length }[until];

if (dryRun) {
  console.log(`階段：做到 ${until}；每位角色約 ${costOf} 點，共 ${items.length} 位 ≈ ${costOf * items.length} 點（1 點 ≈ US$0.01，失敗的任務不扣點）`);
  console.log(`模型版本 ${CFG.model}／貼圖 ${CFG.textureQuality}／面數上限 ${CFG.faceLimit || "自動"}／骨架 ${CFG.rigModel}`);
  console.log(`動畫：${CFG.animations.join(", ")}`);
  for (const it of items) console.log(`  ${it.id}: 概念圖 ${existsSync(path.join(CONCEPTS, `${it.id}.png`)) ? "✓" : "✗ 缺檔"}  最終模型 ${existsSync(path.join(FINAL, `${it.id}.glb`)) ? "已存在（會跳過）" : "待生成"}`);
  process.exit(0);
}

// —— 讀金鑰（不印出）——
function readKey() {
  if (process.env.TRIPO_API_KEY) return process.env.TRIPO_API_KEY.trim();
  const envFile = path.join(ROOT, ".env");
  if (!existsSync(envFile)) return "";
  const m = readFileSync(envFile, "utf-8").match(/^\s*TRIPO_API_KEY\s*=\s*["']?([^"'\r\n#]+)/m);
  return m ? m[1].trim() : "";
}
const KEY = readKey();
if (!KEY) {
  console.error("找不到 TRIPO_API_KEY。請在 " + path.join(ROOT, ".env") + " 寫一行：TRIPO_API_KEY=你的金鑰");
  process.exit(1);
}

for (const d of [RAW, FINAL]) mkdirSync(d, { recursive: true });
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf-8")) : {};
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

// —— API ——
async function api(method, p, body, isForm = false) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(BASE + p, {
      method,
      headers: { Authorization: `Bearer ${KEY}`, ...(body && !isForm ? { "Content-Type": "application/json" } : {}) },
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(120000),
    });
    if (res.status === 429) { // 速率或並行上限：依 Retry-After 等待後重試
      const wait = Math.min(60, Number(res.headers.get("retry-after")) || 5 * (attempt + 1));
      await sleep(wait * 1000);
      continue;
    }
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.code !== 0) {
      throw new Error(`${method} ${p} → HTTP ${res.status} code=${json?.code ?? "?"} ${json?.message || ""} ${json?.suggestion || ""}`.trim());
    }
    return json.data;
  }
  throw new Error(`${method} ${p} → 429 重試次數用盡`);
}

async function waitTask(taskId, label) {
  const t0 = Date.now();
  let lastPct = -1;
  for (;;) {
    const d = await api("GET", `/tasks/${taskId}`);
    if (d.status === "success") return d;
    if (["failed", "cancelled", "banned", "expired"].includes(d.status)) {
      throw new Error(`${label} 任務 ${d.status}：${d.error_code ?? ""} ${d.error_message ?? ""}`.trim());
    }
    const pct = Math.floor((d.progress || 0) / 25) * 25;
    if (pct !== lastPct) { lastPct = pct; log(`  … ${label} ${d.status} ${d.progress ?? 0}%`); }
    if (Date.now() - t0 > TASK_TIMEOUT_MS) throw new Error(`${label} 等待逾時（任務 ${taskId} 仍在 Tripo 端，重跑腳本會接續）`);
    await sleep(POLL_MS);
  }
}

// 下載連結 5 分鐘就過期，任務成功後要立刻下載
async function download(url, dest) {
  const res = await fetch(url, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`下載失敗 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error(`下載到的檔案異常地小（${buf.length} bytes）`);
  writeFileSync(dest, buf);
  return (buf.length / 1048576).toFixed(1);
}

// 執行一個階段：有舊任務就接續，失敗則清掉該任務 id 讓下次重建
async function stage(st, keyName, label, create, dest) {
  if (!st[keyName]) { st[keyName] = (await create()).task_id; saveState(); log(`  ▶ ${label} 任務 ${st[keyName]}`); }
  let d;
  try { d = await waitTask(st[keyName], label); }
  catch (e) { if (!/逾時/.test(e.message)) { delete st[keyName]; saveState(); } throw e; }
  const url = d.output?.model_url;
  if (!url) throw new Error(`${label} 成功但 output 沒有 model_url，實際欄位：${Object.keys(d.output || {}).join(", ")}`);
  const mb = await download(url, dest);
  log(`  ✓ ${label} → ${path.relative(ROOT, dest)}（${mb} MB，扣 ${d.credits_consumed ?? "?"} 點）`);
  return d;
}

async function runChar(it) {
  const finalPath = path.join(FINAL, `${it.id}.glb`);
  if (force) delete state[it.id];
  else if (until === "anim" && existsSync(finalPath)) { log(`⏭  ${it.id} 最終模型已存在，跳過`); return; }
  const st = (state[it.id] ||= {});
  const img = path.join(CONCEPTS, `${it.id}.png`);
  if (!existsSync(img)) throw new Error(`缺概念圖 ${img}`);
  log(`■ ${it.id}`);

  if (!st.modelTask && !st.fileToken) {
    const form = new FormData();
    form.append("file", await openAsBlob(img, { type: "image/png" }), `${it.id}.png`);
    st.fileToken = (await api("POST", "/files", form, true)).file_token;
    saveState();
    log("  ✓ 概念圖已上傳");
  }

  await stage(st, "modelTask", "image-to-model", () => api("POST", "/generation/image-to-model", {
    input: st.fileToken, model: CFG.model, texture: true, pbr: true,
    texture_quality: CFG.textureQuality, ...(CFG.faceLimit ? { face_limit: CFG.faceLimit } : {}),
  }), path.join(RAW, `${it.id}_base.glb`));
  if (until === "model") return;

  if (!st.rigTask && !st.rigChecked) {
    const chk = await waitTask((await api("POST", "/animations/rig-check", { input: st.modelTask })).task_id, "rig-check");
    if (!chk.output?.riggable) throw new Error(`rig-check 判定無法綁骨架（rig_type=${chk.output?.rig_type}）`);
    st.rigChecked = true; saveState();
  }
  await stage(st, "rigTask", "auto rig", () => api("POST", "/animations/rig", {
    input: st.modelTask, model: CFG.rigModel, rig_type: "biped", spec: CFG.rigSpec, out_format: "glb",
  }), path.join(RAW, `${it.id}_rig.glb`));
  if (until === "rig") return;

  await stage(st, "animTask", "retarget 動畫", () => api("POST", "/animations/retarget", {
    input: st.rigTask, animations: CFG.animations, out_format: "glb",
  }), finalPath);
}

process.on("unhandledRejection", (e) => { log(`未處理 rejection：${e?.message || e}`); process.exit(1); });

let ok = 0, fail = 0;
log(`=== Tripo 開始：${items.map((i) => i.id).join(", ")}（做到 ${until}，預估至多 ${costOf * items.length} 點）===`);
for (const it of items) { // 依序處理，避免同時佔用太多並行額度
  try { await runChar(it); ok++; }
  catch (e) {
    fail++;
    log(`✗ ${it.id}：${e.message}`);
    if (/code=(2|1002|2010)\b/.test(e.message)) { log("金鑰無效或點數不足，停止後續角色"); break; }
  }
}
log(`=== 完成 ok=${ok} fail=${fail} ===`);
process.exit(fail ? 1 : 0);
