import { defineEventHandler, createError } from "h3";
import { requireAuthUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";
import { decryptCredential } from "../../core/db/crypto";
import { getQBittorrentTorrents, type QBittorrentTorrentItem } from "../../core/nas/qbittorrentClient";

function formatBytes(bytes: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i >= 2 ? 2 : 1)} ${units[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "0 KB/s";
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(seconds: number): string {
  if (!seconds || seconds >= 8640000 || seconds < 0) return "∞";
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}小时${m}分`;
}

function mapStateText(state: string): { text: string; badgeType: "primary" | "warning" | "success" | "neutral" | "danger" } {
  switch (state) {
    case "downloading":
      return { text: "高速下载中", badgeType: "primary" };
    case "stalledDL":
      return { text: "连接节点中", badgeType: "warning" };
    case "metaDL":
      return { text: "获取元数据", badgeType: "warning" };
    case "allocating":
      return { text: "分配磁盘中", badgeType: "warning" };
    case "checkingDL":
    case "checkingUP":
      return { text: "数据校验中", badgeType: "warning" };
    case "pausedDL":
    case "stoppedDL":
      return { text: "已暂停", badgeType: "neutral" };
    case "uploading":
      return { text: "已落盘·做种中", badgeType: "success" };
    case "stalledUP":
    case "pausedUP":
    case "stoppedUP":
      return { text: "已完成落盘", badgeType: "success" };
    case "error":
    case "missingFiles":
      return { text: "存储异常", badgeType: "danger" };
    default:
      return { text: state, badgeType: "neutral" };
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const db = await getDatabase(event);
  const profile = await db.getNasProfile(user.id);

  if (!profile) {
    throw createError({
      statusCode: 400,
      message: "您尚未配置 NAS 节点，请在右上角头像前往【我的 NAS】进行配置",
    });
  }

  const masterSecret =
    process.env.APP_ENCRYPTION_SECRET ||
    (event.context?.cloudflare?.env as any)?.APP_ENCRYPTION_SECRET ||
    "panhub-taoge-nas-secret-key-2026";

  let qbUrl = profile.torrentClientUrl;
  let qbPassword = "";

  if (profile.torrentClientSecretEncrypted) {
    try {
      qbPassword = await decryptCredential(profile.torrentClientSecretEncrypted, masterSecret);
    } catch {
      // ignore
    }
  }

  // 智能推导：若用户未显式填 qB 独立公网地址，但配了 alist.taogehome.cloud，自动尝试 qb.taogehome.cloud 或内网 8080
  if (!qbUrl) {
    if (profile.alistUrl && profile.alistUrl.includes("taogehome.cloud")) {
      qbUrl = "https://qb.taogehome.cloud";
    } else {
      qbUrl = "http://192.168.1.110:8080";
    }
  }

  const res = await getQBittorrentTorrents(
    qbUrl,
    "admin",
    qbPassword || undefined,
    undefined,
    true // 允许局域网私有 IP (如 192.168.x.x)
  );

  // 若默认推导的 qbUrl 超时或失败，且为公网域名，尝试回退内网地址探活
  let torrents: QBittorrentTorrentItem[] = res.torrents;
  if (!res.success && qbUrl !== "http://192.168.1.110:8080") {
    const fallbackRes = await getQBittorrentTorrents(
      "http://192.168.1.110:8080",
      "admin",
      qbPassword || undefined,
      undefined,
      true
    );
    if (fallbackRes.success) {
      torrents = fallbackRes.torrents;
      qbUrl = "http://192.168.1.110:8080";
    }
  }

  if (!res.success && torrents.length === 0) {
    return {
      code: 0,
      success: false,
      message: res.message || "未能连接到 qBittorrent 节点，请确认 qBittorrent 运行状态或在【我的 NAS】中配置正确地址",
      data: {
        tasks: [],
        total: 0,
        qbUrl,
      },
    };
  }

  // 按添加时间倒序排列
  torrents.sort((a, b) => b.added_on - a.added_on);

  const formattedTasks = torrents.map((t) => {
    const isCompleted = t.progress >= 1 || t.state === "uploading" || t.state === "stalledUP";
    const stateMeta = mapStateText(t.state);
    const size = t.total_size || t.size || 0;
    const downloaded = t.downloaded || (size * t.progress);

    return {
      id: t.hash,
      hash: t.hash,
      name: t.name,
      state: t.state,
      stateText: stateMeta.text,
      badgeType: stateMeta.badgeType,
      isCompleted,
      progress: Math.round(t.progress * 1000) / 10,
      speedText: formatSpeed(t.dlspeed),
      upSpeedText: formatSpeed(t.upspeed),
      sizeText: formatBytes(size),
      downloadedText: formatBytes(downloaded),
      etaText: formatEta(t.eta),
      seedsText: `${t.num_seeds} (${t.num_complete ?? t.num_seeds})`,
      leechsText: `${t.num_leechs} (${t.num_incomplete ?? t.num_leechs})`,
      savePath: t.save_path,
      addedAt: new Date(t.added_on * 1000).toLocaleString("zh-CN"),
    };
  });

  return {
    code: 0,
    success: true,
    data: {
      tasks: formattedTasks,
      total: formattedTasks.length,
      downloadingCount: formattedTasks.filter((t) => !t.isCompleted).length,
      completedCount: formattedTasks.filter((t) => t.isCompleted).length,
      qbUrl,
    },
  };
});
