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

