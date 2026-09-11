// scripts/watchdog.mjs
// 涛哥数字生态 · 10分钟独立守护与断点续传拉起引擎 (纯 Node.js，零模型算力依赖)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const checkpointPath = path.join(projectRoot, '.task_checkpoint.json');
const logPath = path.join(projectRoot, 'logs', 'watchdog.log');
const pidPath = path.join(projectRoot, 'logs', 'watchdog.pid');

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 严格每 10 分钟拉起一次
const CDP_URL = 'http://127.0.0.1:13365';

function log(msg) {
  const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const line = `[${time}] ${msg}\n`;
  console.log(line.trim());
  try {
    fs.appendFileSync(logPath, line, 'utf-8');
  } catch (e) {
    console.error('Failed to write log:', e);
  }
}

function readCheckpoint() {
  try {
    if (!fs.existsSync(checkpointPath)) return null;
    const content = fs.readFileSync(checkpointPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    log(`读取检查点失败: ${e.message}`);
    return null;
  }
}

function updateCheckpointHeartbeat() {
  try {
    const cp = readCheckpoint();
    if (!cp) return;
    cp.lastWatchdogHeartbeat = new Date().toISOString();
    fs.writeFileSync(checkpointPath, JSON.stringify(cp, null, 2), 'utf-8');
  } catch (e) {
    log(`更新心跳失败: ${e.message}`);
  }
}

async function queryCdpTabs() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${CDP_URL}/json/list`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function interactWithAntigravity(wsUrl, action = 'check_or_resume') {
  return new Promise((resolve) => {
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      return resolve({ success: false, error: e.message });
    }

    const timeout = setTimeout(() => {
      try { ws.close(); } catch {}
      resolve({ success: false, error: 'CDP connection timeout' });
    }, 8000);

    ws.onopen = () => {
      // 探查页面状态：是否有重试按钮、报错横幅、停止按钮、发送按钮
      const evaluateScript = `(() => {
        const retryBtn = Array.from(document.querySelectorAll('button')).find(b =>
          /retry|重试|try again|重新生成/i.test(b.innerText || b.getAttribute('aria-label') || '')
        );

        const stopBtn = document.querySelector('button[aria-label*="Stop"], button[aria-label*="停止"]');
        const sendBtn = document.querySelector('button[aria-label="Send message"], button[aria-label="发送消息"]');
        const inputDiv = document.querySelector('[contenteditable="true"]');

        const errorNodes = Array.from(document.querySelectorAll('[class*="error"], [class*="quota"], [class*="limit"]'))
          .map(e => (e.innerText || '').trim())
          .filter(t => /quota|rate limit|额度|超限|429/i.test(t));

        let actionTaken = 'none';

        if (retryBtn && !retryBtn.disabled) {
          retryBtn.click();
          actionTaken = 'clicked_retry';
        } else if (!stopBtn && sendBtn && !sendBtn.disabled && inputDiv) {
          // 仅当用户未打断且空闲时，若需要唤醒，则填入内容
          actionTaken = 'ready_for_input';
        } else if (stopBtn) {
          actionTaken = 'generating';
        }

        return {
          actionTaken,
          hasRetryBtn: !!retryBtn,
          hasStopBtn: !!stopBtn,
          hasSendBtn: !!sendBtn,
          errors: errorNodes.slice(0, 3)
        };
      })()`;

      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: evaluateScript,
          returnByValue: true
        }
      }));
    };

    ws.onmessage = (event) => {
      clearTimeout(timeout);
      try {
        const data = JSON.parse(event.data);
        const result = data.result?.result?.value;
        ws.close();
        resolve({ success: true, data: result });
      } catch (e) {
        ws.close();
        resolve({ success: false, error: e.message });
      }
    };

    ws.onerror = (e) => {
      clearTimeout(timeout);
      resolve({ success: false, error: 'WS error' });
    };
  });
}

async function triggerResumePrompt(wsUrl, promptText) {
  return new Promise((resolve) => {
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      return resolve({ success: false, error: e.message });
    }

    const timeout = setTimeout(() => {
      try { ws.close(); } catch {}
      resolve({ success: false, error: 'CDP prompt timeout' });
    }, 8000);

    ws.onopen = () => {
      const injectScript = `(() => {
        const inputDiv = document.querySelector('[contenteditable="true"]');
        const sendBtn = document.querySelector('button[aria-label="Send message"], button[aria-label="发送消息"]');
        if (!inputDiv || !sendBtn) return { success: false, reason: 'elements not found' };

        inputDiv.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, ${JSON.stringify(promptText)});

        inputDiv.dispatchEvent(new Event('input', { bubbles: true }));
        inputDiv.dispatchEvent(new Event('change', { bubbles: true }));

        setTimeout(() => {
          sendBtn.click();
        }, 200);

        return { success: true };
      })()`;

      ws.send(JSON.stringify({
        id: 2,
        method: 'Runtime.evaluate',
        params: {
          expression: injectScript,
          returnByValue: true
        }
      }));
    };

    ws.onmessage = (event) => {
      clearTimeout(timeout);
      try {
        const data = JSON.parse(event.data);
        ws.close();
        resolve({ success: true, data: data.result?.result?.value });
      } catch (e) {
        ws.close();
        resolve({ success: false, error: e.message });
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      resolve({ success: false, error: 'WS error' });
    };
  });
}

async function runWatchdogCycle() {
  log('----------------------------------------------------');
  log('【守护心跳触发】开始执行本轮巡检 (10分钟周期)...');

  const cp = readCheckpoint();
  if (!cp) {
    log('未找到有效的 .task_checkpoint.json 文件，跳过本轮');
    return;
  }

  updateCheckpointHeartbeat();

  if (cp.status === 'COMPLETED') {
    log('>>> 项目已达成最终交付标准 (COMPLETED)！所有测试与构建均已通过并已执行 Commit。守护脚本功成身退，退出循环。');
    try {
      if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath);
    } catch {}
    process.exit(0);
  }

  log(`当前项目状态: [${cp.status}] 当前里程碑: [${cp.currentMilestone}]`);

  const tabs = await queryCdpTabs();
  if (tabs.length === 0) {
    log('[警告] 未探测到 Antigravity 调试端口 (13365)，可能客户端未启动或端口被占用。持续监控中...');
    return;
  }

  const activeTab = tabs.find(t => (t.url && t.url.includes('13367')) || (t.title && t.title.includes('Antigravity'))) || tabs[0];
  if (!activeTab || !activeTab.webSocketDebuggerUrl) {
    log('[警告] 未找到匹配的会话 Tab WebSocket');
    return;
  }

  const res = await interactWithAntigravity(activeTab.webSocketDebuggerUrl);
  if (!res.success) {
    log(`[CDP 通信失败] ${res.error}`);
    return;
  }

  const state = res.data;
  log(`页面探针响应: actionTaken=${state?.actionTaken}, retryBtn=${state?.hasRetryBtn}, stopBtn=${state?.hasStopBtn}, sendBtn=${state?.hasSendBtn}`);

  if (state?.errors?.length > 0) {
    log(`检测到页面错误/配额提示: ${JSON.stringify(state.errors)}`);
  }

  if (state?.actionTaken === 'clicked_retry') {
    log('>>> [成功恢复] 探知到 Retry/重试 按钮并已自动点击！模型额度重置后任务已被重新拉起！');
  } else if (state?.actionTaken === 'generating') {
    log('>>> 模型当前正在积极生成代码/执行工具，保持安静，不进行打扰。');
  } else if (state?.actionTaken === 'ready_for_input') {
    log(`>>> 会话当前空闲且任务尚未交付完成。自动注入里程碑拉起指令以推进 [${cp.currentMilestone}]...`);
    const prompt = `【独立守护自动拉起】系统检测到当前任务尚未完成交付，当前里程碑为：${cp.currentMilestone}。请读取 .task_checkpoint.json 与 REDLINES.md，继续推进开发与本地测试验证，直至全部测试通过并 commit。`;
    const sendRes = await triggerResumePrompt(activeTab.webSocketDebuggerUrl, prompt);
    log(`注入推进指令结果: ${JSON.stringify(sendRes)}`);
  }
}

// 记录 PID
try {
  fs.writeFileSync(pidPath, String(process.pid), 'utf-8');
} catch {}

log(`====================================================`);
log(`PanHub 10分钟任务自动恢复守护脚本已启动 (PID: ${process.pid})`);
log(`轮询频率: 严格每 10 分钟 (600,000 ms) 执行一次`);
log(`机制: 纯 Node.js 本地守护，零模型算力依赖；遇额度耗尽自动静默等待，5小时重置后立即重新拉起！`);
log(`====================================================`);

// 立即执行第一次
runWatchdogCycle().catch(e => log(`首轮异常: ${e.message}`));

// 定时循环（每10分钟）
setInterval(() => {
  runWatchdogCycle().catch(e => log(`轮次异常: ${e.message}`));
}, CHECK_INTERVAL_MS);
