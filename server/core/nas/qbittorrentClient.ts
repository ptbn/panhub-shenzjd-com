// server/core/nas/qbittorrentClient.ts
// qBittorrent 官方 WebAPI 驱动客户端 (纯 JS/TS，兼容 CF Workers)

import { validateNasTargetUrl } from "./ssrfGuard";
import { enhanceMagnetUrlWithTrackers } from "./trackerInjector";

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
    const enhancedUrls = urls.map((u) => enhanceMagnetUrlWithTrackers(u));
    params.append("urls", enhancedUrls.join("\n"));
    if (savepath) params.append("savepath", savepath);
    if (category) params.append("category", category);

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: cleanUrl,
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

/** qBittorrent 官方 Torrent 信息对象 */
export interface QBittorrentTorrentItem {
  hash: string;
  name: string;
  size: number;
  progress: number; // 0.0 ~ 1.0
  dlspeed: number;  // bytes/s
  upspeed: number;  // bytes/s
  eta: number;      // seconds (8640000 = infinite)
  state: string;    // downloading, stalledDL, pausedDL, uploading, stalledUP, metaDL, allocating, etc.
  num_seeds: number;
  num_leechs: number;
  num_complete?: number;
  num_incomplete?: number;
  ratio: number;
  save_path: string;
  added_on: number;
  total_size?: number;
  downloaded?: number;
}

/**
 * 获取 qBittorrent 全部或过滤种子列表（高精度单一事实来源）
 */
export async function getQBittorrentTorrents(
  url: string,
  username?: string,
  password?: string,
  filter?: string,
  allowPrivateIp = false
): Promise<{ success: boolean; torrents: QBittorrentTorrentItem[]; message?: string }> {
  const check = validateNasTargetUrl(url, allowPrivateIp);
  if (!check.valid) {
    return { success: false, torrents: [], message: check.error! };
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

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: cleanUrl,
    };
    if (cookieHeader) headers["Cookie"] = cookieHeader;

    const query = filter ? `?filter=${encodeURIComponent(filter)}` : "";
    const res = await fetch(`${cleanUrl}/api/v2/torrents/info${query}`, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        torrents: [],
        message: `qBittorrent 响应错误 (${res.status} ${res.statusText})`,
      };
    }

    const data = (await res.json()) as QBittorrentTorrentItem[];
    return {
      success: true,
      torrents: Array.isArray(data) ? data : [],
    };
  } catch (e: any) {
    clearTimeout(timer);
    return {
      success: false,
      torrents: [],
      message: e.name === "AbortError" ? "qBittorrent 获取任务超时" : `qBittorrent 异常: ${e.message}`,
    };
  }
}

/**
 * 控制 qBittorrent 种子：暂停/继续/删除
 */
export async function controlQBittorrentTorrents(
  url: string,
  action: "pause" | "resume" | "delete",
  hashes: string[],
  deleteFiles = false,
  username?: string,
  password?: string,
  allowPrivateIp = false
): Promise<{ success: boolean; message: string }> {
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

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: cleanUrl,
    };
    if (cookieHeader) headers["Cookie"] = cookieHeader;

    const params = new URLSearchParams();
    params.append("hashes", hashes.join("|"));
    if (action === "delete") {
      params.append("deleteFiles", deleteFiles ? "true" : "false");
    }

    const res = await fetch(`${cleanUrl}/api/v2/torrents/${action}`, {
      method: "POST",
      headers,
      body: params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      return { success: true, message: `操作 [${action}] 执行成功` };
    } else {
      return { success: false, message: `qBittorrent 操作失败 (${res.status})` };
    }
  } catch (e: any) {
    clearTimeout(timer);
    return {
      success: false,
      message: e.name === "AbortError" ? "qBittorrent 操作超时" : `qBittorrent 异常: ${e.message}`,
    };
  }
}

