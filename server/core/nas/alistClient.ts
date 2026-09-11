// server/core/nas/alistClient.ts
// AList 官方 REST API 驱动客户端 (纯 JS/TS，兼容 CF Workers)

import { validateNasTargetUrl } from "./ssrfGuard";

export interface AListTestResult {
  success: boolean;
  message: string;
  username?: string;
}

export interface AListPushResult {
  success: boolean;
  taskId?: string;
  message: string;
}

const DEFAULT_TIMEOUT_MS = 8000;

export async function testAListConnection(
  url: string,
  token: string,
  allowPrivateIp = false
): Promise<AListTestResult> {
  const check = validateNasTargetUrl(url, allowPrivateIp);
  if (!check.valid) {
    return { success: false, message: check.error! };
  }

  const cleanUrl = url.replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (token) {
      headers["Authorization"] = token;
    }

    const res = await fetch(`${cleanUrl}/api/me`, {
      method: "GET",
      headers,
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
    if (json.code === 200) {
      return {
        success: true,
        message: "AList 连接成功，凭据有效",
        username: json.data?.username || "admin",
      };
    } else {
      return {
        success: false,
        message: json.message || `AList 接口返回错误码 ${json.code}`,
      };
    }
  } catch (e: any) {
    clearTimeout(timer);
    return {
      success: false,
      message: e.name === "AbortError" ? "连接超时 (超过 8 秒未响应)" : `请求失败: ${e.message}`,
    };
  }
}

export async function addAListOfflineDownload(
  url: string,
  token: string,
  downloadUrl: string,
  targetPath: string,
  tool = "aria2",
  allowPrivateIp = false
): Promise<AListPushResult> {
  const check = validateNasTargetUrl(url, allowPrivateIp);
  if (!check.valid) {
    return { success: false, message: check.error! };
  }

  const cleanUrl = url.replace(/\/+$/, "");
  const cleanPath = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (token) {
      headers["Authorization"] = token;
    }

    const res = await fetch(`${cleanUrl}/api/fs/add_offline_download`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        path: cleanPath,
        urls: [downloadUrl],
        tool,
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
    if (json.code === 200) {
      const task = json.data?.tasks?.[0];
      return {
        success: true,
        taskId: task?.id ? String(task.id) : undefined,
        message: "离线转存任务已成功提交至 AList 队列",
      };
    } else {
      return {
        success: false,
        message: json.message || `AList 离线下载添加失败 (code: ${json.code})`,
      };
    }
  } catch (e: any) {
    clearTimeout(timer);
    return {
      success: false,
      message: e.name === "AbortError" ? "离线推送超时" : `AList 推送失败: ${e.message}`,
    };
  }
}
