// server/core/nas/trackerInjector.ts
// 磁力链接高可用 Tracker 活水注入与寻道加速模块

/** 全球高存活率精选公共 Tracker 矩阵 (包含 HTTP / UDP / HTTPS 多协议备份) */
export const HIGH_AVAILABILITY_TRACKERS: readonly string[] = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://explodie.org:6969/announce",
  "udp://torrent.tracker.durukanbal.com:6969/announce",
  "https://tracker.onetracker.net:443/announce",
  "http://nyaa.tracker.wf:7777/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.dler.com:6969/announce",
  "https://t.213891.xyz:443/announce",
  "http://tracker.renfei.net:8080/announce",
  "udp://p4p.arenabg.com:1337/announce",
  "udp://tracker.skyts.net:6969/announce",
  "udp://tracker.breizh.pm:6969/announce",
  "http://1337.abcvg.info:80/announce",
  "http://bt1.archive.org:6969/announce",
  "http://bt2.archive.org:6969/announce",
  "udp://tracker.teambelgium.net:6969/announce",
  "udp://open.demonii.com:1337/announce",
  "udp://tracker.moeking.me:6969/announce",
];

/**
 * 提取磁力链接中已包含的 Tracker 集合
 */
export function extractTrackersFromMagnet(magnetUrl: string): Set<string> {
  const existing = new Set<string>();
  if (!magnetUrl || !magnetUrl.startsWith("magnet:?")) {
    return existing;
  }

  const queryPart = magnetUrl.slice("magnet:?".length);
  const pairs = queryPart.split("&");
  for (const pair of pairs) {
    if (!pair) continue;
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).toLowerCase();
    const val = pair.slice(eqIdx + 1);
    if (key === "tr") {
      try {
        const decoded = decodeURIComponent(val.replace(/\+/g, "%20")).trim();
        if (decoded) existing.add(decoded.toLowerCase());
      } catch {
        existing.add(val.trim().toLowerCase());
      }
    }
  }
  return existing;
}

/**
 * 为磁力链接注入高可用活水 Tracker，自动查重追加，保障全球节点秒级寻轨
 * @param magnetUrl 原始磁力链接
 * @param extraTrackers 可选的额外 Tracker 列表
 * @returns 注入后的完整磁力链接
 */
export function enhanceMagnetUrlWithTrackers(
  magnetUrl: string,
  extraTrackers: readonly string[] = HIGH_AVAILABILITY_TRACKERS
): string {
  if (typeof magnetUrl !== "string" || !magnetUrl.toLowerCase().startsWith("magnet:?")) {
    return magnetUrl;
  }

  const existingTrackers = extractTrackersFromMagnet(magnetUrl);
  const toAppend: string[] = [];

  for (const tr of extraTrackers) {
    const trimmed = tr.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!existingTrackers.has(lower)) {
      existingTrackers.add(lower);
      toAppend.push(encodeURIComponent(trimmed));
    }
  }

  if (toAppend.length === 0) {
    return magnetUrl;
  }

  const separator = magnetUrl.endsWith("&") ? "" : "&";
  return `${magnetUrl}${separator}tr=${toAppend.join("&tr=")}`;
}
