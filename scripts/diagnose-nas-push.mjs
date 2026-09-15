#!/usr/bin/env node
/**
 * PanHub × AList × qBittorrent 离线下载链路 · 现场取证诊断脚本
 * =============================================================================
 * 用途：
 *   定位「PanHub 显示配置成功，但 NAS 没有真正落盘文件」的真实断点。
 *
 * 原理（基于 AList 官方源码 internal/offline_download/）：
 *   1. POST /api/fs/add_offline_download 只要**入队成功**就返回 HTTP 200 + code 200，
 *      与任务最终成败无关 → 所以 PanHub 报「成功」不代表落盘成功。
 *   2. 真正的落盘由 AList 后台异步完成，需查询任务列表才能看到真实状态：
 *        POST /api/task/offline_download/undone   （未完成）
 *        POST /api/task/offline_download/done     （已完成）
 *      任务对象含 state / progress / error 字段，error 里就是失败根因。
 *   3. AList 会把磁力下载到「临时目录」再 transfer 到你的挂载路径：
 *        tempDir = <AList TempDir>/qBittorrent/<uid>
 *      qBittorrent 容器必须能访问这个路径，否则必然失败。
 *
 * 用法（在 panhub-shenzjd-com-main 目录下执行）：
 *   node scripts/diagnose-nas-push.mjs --url https://alist.xxx.cloud --token <AList Token>
 *
 * 也可用环境变量：
 *   ALIST_URL / ALIST_TOKEN
 *
 * 只读诊断：本脚本不会创建、删除或修改任何任务与配置。
 */

const args = process.argv.slice(2);
function argOf(name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
}

const ALIST_URL = (argOf("url") || process.env.ALIST_URL || "").replace(/\/+$/, "");
const ALIST_TOKEN = argOf("token") || process.env.ALIST_TOKEN || "";

if (!ALIST_URL) {
  console.error("❌ 缺少 AList 地址。用法：node scripts/diagnose-nas-push.mjs --url https://alist.xxx.cloud --token <token>");
  process.exit(1);
}

const TIMEOUT_MS = 15000;

async function api(path, { method = "GET", body, raw = false } = {}) {
  const headers = { Accept: "application/json", "User-Agent": "PanHub-NAS-Diagnose/1.0" };
  if (ALIST_TOKEN) headers["Authorization"] = ALIST_TOKEN;
  if (body) headers["Content-Type"] = "application/json";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ALIST_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (raw) return { status: res.status, text };
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* 非 JSON 响应 */
    }
    return { status: res.status, json, text };
  } catch (e) {
    return { status: 0, error: e.name === "AbortError" ? "请求超时" : e.message };
  } finally {
    clearTimeout(timer);
  }
}

function hr(title) {
  console.log(`\n${"─".repeat(72)}\n${title}\n${"─".repeat(72)}`);
}

const findings = [];
function note(level, msg) {
  findings.push({ level, msg });
  const icon = level === "FAIL" ? "❌" : level === "WARN" ? "⚠️ " : level === "OK" ? "✅" : "ℹ️ ";
  console.log(`${icon} ${msg}`);
}

async function main() {
  console.log(`\n🔎 PanHub NAS 推送链路诊断  →  ${ALIST_URL}`);
  console.log(`   Token: ${ALIST_TOKEN ? "已提供" : "未提供（仅能访问公开接口）"}`);

  // ── 步骤 1：连通性与身份 ──────────────────────────────────────────────
  hr("步骤 1 / 6 · AList 连通性与 Token 身份");
  const me = await api("/api/me");
  if (me.error) {
    note("FAIL", `无法连接 AList：${me.error}`);
    return summary();
  }
  if (me.json?.code !== 200) {
    note("FAIL", `AList /api/me 返回异常：code=${me.json?.code} message=${me.json?.message}`);
    note("INFO", "请确认 Token 是否为 AList 后台「设置 → 其他 → 令牌」生成的有效 Token（非密码）。");
    return summary();
  }
  const meData = me.json.data || {};
  note("OK", `连接成功，当前身份：${meData.username || "unknown"}（角色 ${meData.role ?? "?"}，2=管理员 0=普通用户）`);
  if (meData.role !== undefined && meData.role < 2) {
    note("WARN", "当前 Token 不是管理员。AList 的离线下载与存储管理属于管理员域接口，非管理员 Token 会被拒绝。");
  }

  // ── 步骤 2：存储挂载点 ────────────────────────────────────────────────
  hr("步骤 2 / 6 · AList 存储挂载点（决定 path 参数是否合法）");
  const stor = await api("/api/admin/storage/list");
  if (stor.json?.code !== 200) {
    note("FAIL", `无法读取存储列表：code=${stor.json?.code} message=${stor.json?.message}`);
    note("INFO", "这通常意味着 Token 权限不足，或 AList 版本过新导致接口路径变化。");
  } else {
    const list = stor.json.data?.content || [];
    note("OK", `共检测到 ${list.length} 个挂载点：`);
    for (const s of list) {
      const broken = String(s.status || "").toLowerCase() !== "work";
      console.log(
        `     ${broken ? "❌" : "✅"} id=${String(s.id).padEnd(4)} ${String(s.mount_path).padEnd(28)} ` +
          `driver=${String(s.driver).padEnd(22)} status=${s.status}`
      );
      if (broken) note("WARN", `挂载点 [${s.mount_path}] 状态为 ${s.status}，不可用。`);
    }
    const localMounts = list.filter((s) => /local/i.test(String(s.driver)));
    if (localMounts.length === 0) {
      note(
        "FAIL",
        "没有找到任何 Local 驱动挂载点。离线下载的落盘目标必须是 AList 中一个 Local 驱动的挂载路径，否则路径无处可落。"
      );
    } else {
      note("OK", `Local 驱动挂载点：${localMounts.map((s) => s.mount_path).join("、")}`);
      note("INFO", "👉 PanHub 的「AList 默认路径 / 目标目录」必须落在上述 Local 挂载点之下。");
    }
  }

  // ── 步骤 3：离线下载工具就绪状态（关键） ──────────────────────────────
  hr("步骤 3 / 6 · 离线下载工具注册表（qBittorrent 是否真的就绪）");
  const tools = await api("/api/admin/task/offline_download/tools");
  if (tools.json?.code !== 200) {
    note("WARN", `无法读取工具注册表：code=${tools.json?.code} message=${tools.json?.message}`);
  } else {
    const arr = tools.json.data || [];
    const names = arr.map((t) => t.name);
    note("OK", `已注册工具：${names.join("、") || "（空）"}`);
    for (const t of arr) {
      const ready = t.state === "work" || t.state === "ready" || t.state === true;
      console.log(`     tool=${String(t.name).padEnd(14)} state=${t.state}`);
      if (String(t.name).toLowerCase() === "qbittorrent" && !ready) {
        note("FAIL", `qBittorrent 工具未就绪（state=${t.state}）→ AList 根本无法下发任务。`);
      }
    }
    if (!names.some((n) => String(n).toLowerCase() === "qbittorrent")) {
      note("FAIL", "工具列表中没有 qBittorrent。PanHub 以 tool=qBittorrent 下发时，AList 会直接拒绝。");
    }
  }

  // ── 步骤 4：qBittorrent 关键设置（savepath 根因区） ───────────────────
  hr("步骤 4 / 6 · qBittorrent 相关设置项（临时目录与做种策略）");
  const settings = await api("/api/admin/setting/list?group=4");
  if (settings.json?.code !== 200) {
    note("WARN", `无法读取设置项：code=${settings.json?.code} message=${settings.json?.message}（不同 AList 版本分组号可能不同，可忽略）`);
  } else {
    const items = settings.json.data || [];
    const wanted = items.filter((s) =>
      /qbit|temp_dir|temp/i.test(String(s.key))
    );
    if (wanted.length === 0) {
      note("WARN", "未匹配到 qBittorrent / TempDir 相关设置项，请手动在 AList 后台【设置 → 其他】核对。");
    }
    for (const s of wanted) {
      const isSecret = /url/i.test(s.key) && String(s.value || "").includes("@");
      const shown = isSecret ? String(s.value).replace(/\/\/[^@]*@/, "//***:***@") : s.value;
      console.log(`     ${String(s.key).padEnd(28)} = ${shown}`);
    }
    const t = wanted.find((s) => /temp_dir/i.test(String(s.key)));
    if (t && !t.value) {
      note("FAIL", "TempDir 为空！AList ≥ 3.42.0 必须配置临时文件夹，否则离线下载不可用（前端只会显示 SimpleHttp）。");
    }
  }

  // ── 步骤 5：真实任务状态（命中就是根因） ──────────────────────────────
  hr("步骤 5 / 6 · 离线下载任务真实状态  ★核心证据★");
  let sawFail = false;
  let totalTasksSeen = 0;
  for (const [label, path] of [
    ["未完成/失败任务", "/api/task/offline_download/undone"],
    ["已完成任务", "/api/task/offline_download/done"],
  ]) {
    const r = await api(path, { method: "POST" });
    if (r.json?.code !== 200) {
      note("WARN", `读取 ${label} 失败：code=${r.json?.code} message=${r.json?.message}`);
      continue;
    }
    const tasks = r.json.data || [];
    totalTasksSeen += tasks.length;
    console.log(`\n   【${label}】共 ${tasks.length} 条`);
    if (tasks.length === 0) console.log("     （空）");
    for (const t of tasks.slice(0, 20)) {
      const err = t.error || "";
      if (err) sawFail = true;
      console.log(
        `     id=${String(t.id).padEnd(24)} state=${String(t.state).padEnd(12)} ` +
          `progress=${String(t.progress ?? "-").padEnd(6)} err=${err || "-"}`
      );
      if (err) {
        note("FAIL", `任务失败：${err}`);
        note("INFO", `  任务名：${t.name || "-"}`);
        note("INFO", `  任务 URL：${(t.url || "").slice(0, 90)}`);
      }
    }
  }
  if (sawFail) {
    note("INFO", "↑ 以上 error 文本即 AList 侧的失败根因，常见两类：");
    note("INFO", "  · 「failed to add qBittorrent task」→ qBittorrent 拒绝了 savepath，两个容器的临时目录未共享同一宿主机目录。");
    note("INFO", "  · 「failed to transfer file」/「failed get storage」→ AList 无法把临时文件搬到目标挂载路径。");
  } else if (totalTasksSeen === 0) {
    note("WARN", "任务列表为空 → AList 侧根本没有收到离线下载任务，问题在 PanHub 的下发环节（地址/Token/工具名）。");
  }

  summary();
}

function summary() {
  hr("诊断结论汇总");
  const fails = findings.filter((f) => f.level === "FAIL");
  const warns = findings.filter((f) => f.level === "WARN");
  if (fails.length === 0 && warns.length === 0) {
    console.log("未发现明确故障信号。请把上方【步骤 5】的任务列表原文提供给开发者。");
  }
  for (const f of findings) {
    if (f.level === "FAIL" || f.level === "WARN") {
      const icon = f.level === "FAIL" ? "❌" : "⚠️ ";
      console.log(`${icon} ${f.msg}`);
    }
  }
  console.log(
    `\n共 ${fails.length} 项阻断、${warns.length} 项警示。\n` +
      `\n📌 请把本脚本的完整输出（Token 不会被打印）回传，即可精确定位断点。\n`
  );
}

main().catch((e) => {
  console.error("\n💥 诊断脚本异常：", e);
  process.exit(1);
});
