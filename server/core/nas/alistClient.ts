// server/core/nas/alistClient.ts
// AList 官方 REST API 驱动客户端 (纯 JS/TS，兼容 CF Workers)

import { validateNasTargetUrl } from "./ssrfGuard";
import type { ShareMountResult, MountedMediaFile } from "./types";

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

export interface AListStorageItem {
  id: number;
  mountPath: string;
  driver: string;
  status: string;
  remark?: string;
  webdavPolicy?: string;
}

export interface AListStoragesResult {
  success: boolean;
  message: string;
  storages?: AListStorageItem[];
}

export interface AListRefreshResult {
  success: boolean;
  message: string;
  total?: number;
}

/**
 * 获取当前 AList 中已挂载的全部云存储驱动及其健康状态
 */
export async function getAListStorages(
  url: string,
  token: string,
  allowPrivateIp = false
): Promise<AListStoragesResult> {
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

    const res = await fetch(`${cleanUrl}/api/admin/storage/list`, {
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
      const content = json.data?.content || [];
      const storages: AListStorageItem[] = content.map((s: any) => ({
        id: s.id,
        mountPath: s.mount_path,
        driver: s.driver,
        status: s.status,
        remark: s.remark || "",
        webdavPolicy: s.webdav_policy || "",
      }));
      return {
        success: true,
        message: "获取 AList 存储列表成功",
        storages,
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
      message: e.name === "AbortError" ? "请求 AList 存储列表超时" : `获取 AList 存储列表失败: ${e.message}`,
    };
  }
}

/**
 * 主动穿透刷新 AList 指定目录的缓存 (refresh: true)
 */
export async function refreshAListPath(
  url: string,
  token: string,
  targetPath: string,
  allowPrivateIp = false
): Promise<AListRefreshResult> {
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

    const res = await fetch(`${cleanUrl}/api/fs/list`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        path: cleanPath,
        refresh: true,
        page: 1,
        per_page: 1,
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
      return {
        success: true,
        message: `目录 [${cleanPath}] 缓存已成功穿透刷新`,
        total: json.data?.total || 0,
      };
    } else {
      return {
        success: false,
        message: json.message || `刷新失败 (code: ${json.code})`,
      };
    }
  } catch (e: any) {
    clearTimeout(timer);
    return {
      success: false,
      message: e.name === "AbortError" ? "刷新 AList 目录超时" : `刷新 AList 目录失败: ${e.message}`,
    };
  }
}

export interface ParsedShareInfo {
  supported: boolean;
  driverName: string;
  shareCode: string;
  receiveCode: string;
  addition: Record<string, any>;
  reason?: string;
}

export function parseShareInfo(url: string, password = ""): ParsedShareInfo {
  const u = (url || "").trim();

  // 115
  const m115 = u.match(/115\.com\/s\/([a-zA-Z0-9]+)/i);
  if (m115) {
    const code = m115[1];
    let pwd = password;
    const pwdMatch = u.match(/[?&]password=([a-zA-Z0-9]+)/i);
    if (pwdMatch) pwd = pwdMatch[1];
    return {
      supported: true,
      driverName: "115 Share",
      shareCode: code,
      receiveCode: pwd,
      addition: {
        share_code: code,
        receive_code: pwd,
        cookie: "",
        root_folder_id: "0",
      },
    };
  }

  // Baidu
  const mBaidu = u.match(/pan\.baidu\.com\/s\/(?:1)?([a-zA-Z0-9_-]+)/i);
  if (mBaidu) {
    const raw = u.match(/pan\.baidu\.com\/s\/([a-zA-Z0-9_-]+)/i)?.[1] || "";
    const code = raw.startsWith("1") && raw.length > 5 ? raw.slice(1) : raw;
    let pwd = password;
    const pwdMatch = u.match(/[?&]pwd=([a-zA-Z0-9]+)/i);
    if (pwdMatch) pwd = pwdMatch[1];
    return {
      supported: true,
      driverName: "BaiduShare",
      shareCode: raw,
      receiveCode: pwd,
      addition: {
        surl: code,
        pwd: pwd,
        root_folder_path: "/",
      },
    };
  }

  // Alipan
  const mAli = u.match(/(?:alipan\.com|aliyundrive\.com)\/s\/([a-zA-Z0-9_-]+)/i);
  if (mAli) {
    const code = mAli[1];
    let pwd = password;
    const pwdMatch = u.match(/[?&]pwd=([a-zA-Z0-9]+)/i);
    if (pwdMatch) pwd = pwdMatch[1];
    return {
      supported: true,
      driverName: "AliyundriveShare",
      shareCode: code,
      receiveCode: pwd,
      addition: {
        share_id: code,
        share_pwd: pwd,
        refresh_token: "",
        root_folder_id: "root",
      },
    };
  }

  // 123Pan
  const m123 = u.match(/123pan\.com\/s\/([a-zA-Z0-9_-]+)/i);
  if (m123) {
    const code = m123[1];
    let pwd = password;
    const pwdMatch = u.match(/[?&]pwd=([a-zA-Z0-9]+)/i);
    if (pwdMatch) pwd = pwdMatch[1];
    return {
      supported: true,
      driverName: "123PanShare",
      shareCode: code,
      receiveCode: pwd,
      addition: {
        sharekey: code,
        sharepassword: pwd,
        root_folder_id: "0",
      },
    };
  }

  // Quark
  if (u.includes("quark.cn")) {
    return {
      supported: false,
      driverName: "Quark",
      shareCode: "",
      receiveCode: password,
      addition: {},
      reason: "夸克网盘官方接口未开放免密只读挂载驱动，需转存至个人网盘",
    };
  }

  return {
    supported: false,
    driverName: "Unknown",
    shareCode: "",
    receiveCode: password,
    addition: {},
    reason: "暂不支持该网盘的免密自动挂载驱动",
  };
}

/**
 * 在用户 AList 中动态创建或更新分享挂载点
 */
export async function mountAListShare(
  url: string,
  token: string,
  shareUrl: string,
  password: string,
  targetMountPath: string,
  allowPrivateIp = false
): Promise<ShareMountResult> {
  const check = validateNasTargetUrl(url, allowPrivateIp);
  if (!check.valid) {
    return { success: false, message: check.error! };
  }

  const parsed = parseShareInfo(shareUrl, password);
  if (!parsed.supported) {
    return {
      success: false,
      message: parsed.reason || "暂不支持该网盘的免转存挂载",
      driver: parsed.driverName,
    };
  }

  const cleanUrl = url.replace(/\/+$/, "");
  const cleanPath = targetMountPath.startsWith("/") ? targetMountPath : `/${targetMountPath}`;

  // 检查是否已存在相同路径的挂载
  const storagesRes = await getAListStorages(url, token, allowPrivateIp);
  let existingId: number | undefined;
  if (storagesRes.success && storagesRes.storages) {
    const found = storagesRes.storages.find((s) => s.mountPath === cleanPath);
    if (found) {
      existingId = found.id;
    }
  }

  const endpoint = existingId
    ? `${cleanUrl}/api/admin/storage/update`
    : `${cleanUrl}/api/admin/storage/create`;

  const payload: Record<string, any> = {
    mount_path: cleanPath,
    order: 0,
    remark: `PanHub 动态挂载: ${new Date().toISOString().slice(0, 10)}`,
    cache_expiration: 30,
    web_proxy: false,
    webdav_policy: "302_redirect",
    down_proxy_url: "",
    down_proxy_sign: true,
    driver: parsed.driverName,
    addition: JSON.stringify(parsed.addition),
  };
  if (existingId) {
    payload.id = existingId;
  }

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

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        message: `AList 接口异常 (${res.status} ${res.statusText})`,
      };
    }

    const json = (await res.json()) as any;
    if (json.code !== 200) {
      return {
        success: false,
        message: json.message || `挂载失败 (错误码: ${json.code})`,
      };
    }

    // 穿透刷新该目录
    await refreshAListPath(url, token, cleanPath, allowPrivateIp).catch(() => {});

    // 列出挂载目录下的媒体文件
    let files: MountedMediaFile[] = [];
    try {
      const listHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (token) {
        listHeaders["Authorization"] = token;
      }
      const listRes = await fetch(`${cleanUrl}/api/fs/list`, {
        method: "POST",
        headers: listHeaders,
        body: JSON.stringify({
          path: cleanPath,
          page: 1,
          per_page: 50,
        }),
      });
      if (listRes.ok) {
        const listJson = (await listRes.json()) as any;
        if (listJson.code === 200 && listJson.data?.content) {
          files = listJson.data.content.map((f: any) => ({
            name: f.name,
            size: f.size || 0,
            isDir: Boolean(f.is_dir),
          }));
        }
      }
    } catch (err) {
      // 忽略文件列表获取错误
    }

    return {
      success: true,
      message: "成功动态挂载至 AList 专属影视目录",
      driver: parsed.driverName,
      mountPath: cleanPath,
      webdavUrl: `${cleanUrl}/dav${cleanPath}`,
      alistPlayUrl: `${cleanUrl}${cleanPath}`,
      files,
    };
  } catch (e: any) {
    clearTimeout(timer);
    return {
      success: false,
      message: e.name === "AbortError" ? "AList 挂载操作超时" : `挂载请求失败: ${e.message}`,
    };
  }
}

