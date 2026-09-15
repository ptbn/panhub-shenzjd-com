// server/core/nas/dispatcher.ts
// NAS 多协议下载分发引擎 (网盘转存 AList + 磁力/种子 Aria2/qBittorrent)

import type { DatabaseAdapter, NasProfileRecord } from "../db/types";
import type { PushTask, PushResult } from "./types";
import { decryptCredential } from "../db/crypto";
import { addAListOfflineDownload } from "./alistClient";
import { addAria2Uri } from "./aria2Client";
import { addQBittorrentTorrent } from "./qbittorrentClient";

/** 判断是否为各大常见网盘分享链接 */
export function isCloudDriveUrl(url: string): boolean {
  if (!url) return false;
  return /quark\.cn|aliyundrive\.com|alipan\.com|pan\.baidu\.com|123pan\.com|115\.com|pan\.xunlei\.com|drive\.uc\.cn|cloud\.189\.cn/i.test(
    url
  );
}

/** 判断是否为磁力链接 */
export function isMagnetUrl(url: string): boolean {
  return typeof url === "string" && url.toLowerCase().startsWith("magnet:?xt=urn:btih:");
}

/** 智能推断绿联 DX4600 / UGOS 影视目录分类 */
export function inferCategorySubdir(category?: string): string {
  if (category === "tv") return "TV";
  if (category === "anime") return "Anime";
  return "Movies";
}

/** 智能推导目标目录，若用户默认目录已包含同类目录，自动重定向到对齐的分类子目录 */
export function resolveSmartSubdir(basePath: string, category?: string): string {
  if (!basePath) return "/Media/Movies";
  let cleanBase = basePath.replace(/\/+$/, "");

  // 1. 若基础路径末尾已是某种特定分类目录，先剥离它以获得媒体根目录
  const tailRegex = /\/(movies|movie|tv|anime|电影|电视剧|剧集|动漫|动画)$/i;
  if (tailRegex.test(cleanBase)) {
    cleanBase = cleanBase.replace(tailRegex, "");
  }

  // 2. 根据用户基础目录语言习惯（中文 vs 英文）推导对应分类子目录
  const isChinesePath = /[\u4e00-\u9fa5]/.test(basePath);

  let sub = "Movies";
  if (category === "tv") {
    sub = isChinesePath ? "电视剧" : "TV";
  } else if (category === "anime") {
    sub = isChinesePath ? "动漫" : "Anime";
  } else if (category === "other") {
    sub = isChinesePath ? "其他" : "Downloads";
  } else {
    sub = isChinesePath ? "电影" : "Movies";
  }

  return cleanBase ? `${cleanBase}/${sub}` : `/${sub}`;
}

/**
 * 核心调度入口：根据资源类型与用户 NAS 配置分发至对应下载引擎
 */
export async function dispatchPushTask(
  profile: NasProfileRecord,
  task: PushTask,
  masterSecret: string,
  db?: DatabaseAdapter,
  username = "用户",
  allowPrivateIp = false
): Promise<PushResult> {
  const isCloud = isCloudDriveUrl(task.url);
  const preferred = task.preferredClient || "auto";

  let clientType: "alist" | "aria2" | "qbittorrent" = "alist";
  if (preferred === "auto") {
    if (isCloud && profile.cloudDriveEnabled) {
      clientType = "alist";
    } else {
      clientType = profile.torrentClientType || "aria2";
    }
  } else {
    clientType = preferred;
  }

  let finalResult: PushResult;

  if (clientType === "alist") {
    if (!profile.alistUrl) {
      throw new Error("尚未配置 AList 下载器地址，请先在【我的 NAS】中进行配置");
    }

    let token = "";
    if (profile.alistTokenEncrypted) {
      try {
        token = await decryptCredential(profile.alistTokenEncrypted, masterSecret);
      } catch (e) {
        console.warn("[Dispatcher] AList token 解密警告，尝试以空 Token 访问");
      }
    }

    // 智能合成路径：若用户未指定或前端传入旧 /Media 路径，平滑映射为真实存在的挂载点
    let targetPath = task.targetDir;
    if (!targetPath || targetPath.startsWith("/Media")) {
      targetPath = profile.alistDefaultPath
        ? resolveSmartSubdir(profile.alistDefaultPath, task.category)
        : "/NAS本地盘/电影";
    }

    // 动态选择 AList 离线下载驱动：如果任务显式偏好 qBittorrent，或 profile 设置了 qbittorrent，传递 "qBittorrent"
    const alistOfflineTool =
      task.preferredClient === "qbittorrent" || (!isCloud && profile.torrentClientType === "qbittorrent")
        ? "qBittorrent"
        : "aria2";

    const res = await addAListOfflineDownload(
      profile.alistUrl,
      token,
      task.url,
      targetPath,
      alistOfflineTool,
      allowPrivateIp
    );

    finalResult = {
      success: res.success,
      protocol: "alist",
      taskId: res.taskId,
      message: res.message,
      targetPath,
      targetDevice: profile.name || "家庭 NAS",
    };
  } else if (clientType === "aria2") {
    if (!profile.torrentClientUrl) {
      throw new Error("尚未配置 Aria2 RPC 地址，请先在【我的 NAS】中进行配置");
    }

    let secret = "";
    if (profile.torrentClientSecretEncrypted) {
      try {
        secret = await decryptCredential(profile.torrentClientSecretEncrypted, masterSecret);
      } catch (e) {
        console.warn("[Dispatcher] Aria2 secret 解密警告");
      }
    }

    let targetDir = task.targetDir || (profile.torrentDefaultDir ? resolveSmartSubdir(profile.torrentDefaultDir, task.category) : "/Media/Movies");

    const res = await addAria2Uri(
      profile.torrentClientUrl,
      secret || undefined,
      [task.url],
      targetDir,
      allowPrivateIp
    );

    finalResult = {
      success: res.success,
      protocol: "aria2",
      taskId: res.gid,
      message: res.message,
      targetPath: targetDir,
      targetDevice: profile.name || "家庭 NAS",
    };
  } else {
    // qbittorrent
    // 方案 A 优先闭环：若用户未配置 qB 独立的公网 RPC 地址，但已配置 AList，则自动降级通过 AList 离线接口以 qBittorrent 驱动下发！
    if (!profile.torrentClientUrl && profile.alistUrl) {
      let token = "";
      if (profile.alistTokenEncrypted) {
        try {
          token = await decryptCredential(profile.alistTokenEncrypted, masterSecret);
        } catch (e) {
          console.warn("[Dispatcher] AList token 解密警告，尝试以空 Token 访问");
        }
      }

      let targetPath = task.targetDir;
      if (!targetPath || targetPath.startsWith("/Media")) {
        targetPath = profile.alistDefaultPath
          ? resolveSmartSubdir(profile.alistDefaultPath, task.category)
          : "/NAS本地盘/电影";
      }

      const res = await addAListOfflineDownload(
        profile.alistUrl,
        token,
        task.url,
        targetPath,
        "qBittorrent",
        allowPrivateIp
      );

      finalResult = {
        success: res.success,
        protocol: "qbittorrent",
        taskId: res.taskId,
        message: res.message || "磁力任务已成功提交至 AList -> qBittorrent 离线下载队列",
        targetPath,
        targetDevice: profile.name || "家庭 NAS",
      };
    } else {
      if (!profile.torrentClientUrl) {
        throw new Error("尚未配置 qBittorrent 地址或 AList 节点，请先在【我的 NAS】中进行配置");
      }

      let secret = "";
      if (profile.torrentClientSecretEncrypted) {
        try {
          secret = await decryptCredential(profile.torrentClientSecretEncrypted, masterSecret);
        } catch (e) {
          console.warn("[Dispatcher] qBittorrent 密码解密警告");
        }
      }

      let targetDir = task.targetDir || profile.torrentDefaultDir || "/Media/Movies";
      const sub = inferCategorySubdir(task.category);

      const res = await addQBittorrentTorrent(
        profile.torrentClientUrl,
        "admin",
        secret || undefined,
        [task.url],
        targetDir,
        sub,
        allowPrivateIp
      );

      finalResult = {
        success: res.success,
        protocol: "qbittorrent",
        message: res.message,
        targetPath: targetDir,
        targetDevice: profile.name || "家庭 NAS",
      };
    }
  }

  // 记录审计日志
  if (db) {
    db.createPushLog({
      userId: profile.userId,
      username,
      title: task.title,
      url: task.url,
      protocol: finalResult.protocol,
      targetDevice: finalResult.targetDevice,
      targetPath: finalResult.targetPath,
      status: finalResult.success ? "success" : "failed",
      message: finalResult.message,
    }).catch((err) => console.error("[Dispatcher] 写入推送审计日志失败:", err));
  }

  return finalResult;
}
