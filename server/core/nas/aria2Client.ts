// server/core/nas/aria2Client.ts
// Aria2 标准 JSON-RPC 2.0 客户端 (纯 JS/TS，兼容 CF Workers)

import { validateNasTargetUrl } from "./ssrfGuard";

export interface Aria2TestResult {
  success: boolean;
  message: string;
  version?: string;
}

export interface Aria2PushResult {
  success: boolean;
  gid?: string;
  message: string;
}

const DEFAULT_TIMEOUT_MS = 8000;

export async function testAria2Connection(
  url: string,
  secret?: string,
  allowPrivateIp = false
): Promise<Aria2TestResult> {
  const check = validateNasTargetUrl(url, allowPrivateIp);
  if (!check.valid) {
    return { success: false, message: check.error! };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const params: any[] = [];
  if (secret) {
    params.push(`token:${secret}`);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "panhub_ping",
        method: "aria2.getVersion",
        params,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        message: `HTTP 响应异常 (${res.status} ${res.statusText})`,
      };
    }

    const json = (await res.json()) as any;
    if (json.error) {
      return {
        success: false,
        message: `Aria2 RPC 报错: ${json.error.message || json.error.code}`,
      };
    }

    return {
      success: true,
      message: "Aria2 RPC 连通正常",
      version: json.result?.version || "unknown",
    };
  } catch (e: any) {
    clearTimeout(timer);
    return {
      success: false,
      message: e.name === "AbortError" ? "Aria2 RPC 连接超时" : `Aria2 连接失败: ${e.message}`,
    };
  }
}

export async function addAria2Uri(
  url: string,
  secret: string | undefined,
  downloadUris: string[],
  dir?: string,
  allowPrivateIp = false
): Promise<Aria2PushResult> {
  const check = validateNasTargetUrl(url, allowPrivateIp);
  if (!check.valid) {
    return { success: false, message: check.error! };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const params: any[] = [];
  if (secret) {
    params.push(`token:${secret}`);
  }
  params.push(downloadUris);

  const options: Record<string, string> = {};
  if (dir) {
    options.dir = dir;
  }
  params.push(options);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `panhub_${Date.now()}`,
        method: "aria2.addUri",
        params,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        message: `HTTP 响应异常 (${res.status} ${res.statusText})`,
      };
    }

    const json = (await res.json()) as any;
    if (json.error) {
      return {
        success: false,
        message: `Aria2 添加任务失败: ${json.error.message || json.error.code}`,
      };
    }

    return {
      success: true,
      gid: json.result,
      message: "离线下载任务已成功送达 Aria2 队列",
    };
  } catch (e: any) {
    clearTimeout(timer);
    return {
      success: false,
      message: e.name === "AbortError" ? "Aria2 推送任务超时" : `Aria2 派发失败: ${e.message}`,
    };
  }
}
