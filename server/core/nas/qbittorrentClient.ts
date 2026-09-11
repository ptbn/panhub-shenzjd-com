// server/core/nas/qbittorrentClient.ts
// qBittorrent 官方 WebAPI 驱动客户端 (纯 JS/TS，兼容 CF Workers)

import { validateNasTargetUrl } from "./ssrfGuard";

export interface QBittorrentTestResult {
  success: boolean;
  message: string;
  version?: string;
}

export interface QBittorrentPushResult {
  success: boolean;
  message: string;
}

const DEFAULT_TIMEOUT_MS = 8000;

export async function testQBittorrentConnection(
  url: string,
  username?: string,
  password?: string,
  allowPrivateIp = false
): Promise<QBittorrentTestResult> {
  const check = validateNasTargetUrl(url, allowPrivateIp);
  if (!check.valid) {
    return { success: false, message: check.error! };
  }

  const cleanUrl = url.replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    let cookieHeader = "";
    if (username && password) {
      const loginParams = new URLSearchParams();
      loginParams.append("username", username);
      loginParams.append("password", password);

      const loginRes = await fetch(`${cleanUrl}/api/v2/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: loginParams.toString(),
        signal: controller.signal,
      });

      if (!loginRes.ok) {
        clearTimeout(timer);
        return { success: false, message: `qBittorrent 认证失败 (${loginRes.status})` };
      }
      cookieHeader = loginRes.headers.get("set-cookie") || "";
    }

    const headers: Record<string, string> = {};
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
    }

    const versionRes = await fetch(`${cleanUrl}/api/v2/app/version`, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (versionRes.ok) {
      const version = await versionRes.text();
      return {
        success: true,
        message: "qBittorrent WebUI 连通正常",
        version: version.trim(),
      };
    } else {
      return {
        success: false,
        message: `qBittorrent 获取版本失败 (${versionRes.status})`,
      };
    }
  } catch (e: any) {
    clearTimeout(timer);
    return {
      success: false,
      message: e.name === "AbortError" ? "qBittorrent 连接超时" : `qBittorrent 异常: ${e.message}`,
    };
  }
}

export async function addQBittorrentTorrent(
  url: string,
  username: string | undefined,
  password: string | undefined,
  urls: string[],
  savepath?: string,
  category?: string,
  allowPrivateIp = false
): Promise<QBittorrentPushResult> {
  const check = validateNasTargetUrl(url, allowPrivateIp);
  if (!check.valid) {
    return { success: false, message: check.error! };
  }

  const cleanUrl = url.replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    let cookieHeader = "";
    if (username && password) {
      const loginParams = new URLSearchParams();
      loginParams.append("username", username);
      loginParams.append("password", password);

      const loginRes = await fetch(`${cleanUrl}/api/v2/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: loginParams.toString(),
        signal: controller.signal,
      });
      cookieHeader = loginRes.headers.get("set-cookie") || "";
    }

    const params = new URLSearchParams();
    params.append("urls", urls.join("\n"));
    if (savepath) params.append("savepath", savepath);
    if (category) params.append("category", category);

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (cookieHeader) headers["Cookie"] = cookieHeader;

    const res = await fetch(`${cleanUrl}/api/v2/torrents/add`, {
      method: "POST",
      headers,
      body: params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      return { success: true, message: "下载任务已成功送达 qBittorrent 队列" };
    } else {
      return { success: false, message: `qBittorrent 添加任务失败 (${res.status})` };
    }
  } catch (e: any) {
    clearTimeout(timer);
    return {
      success: false,
      message: e.name === "AbortError" ? "qBittorrent 推送超时" : `qBittorrent 异常: ${e.message}`,
    };
  }
}
