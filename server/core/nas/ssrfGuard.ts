// server/core/nas/ssrfGuard.ts
// SSRF (服务器端请求伪造) 终极物理防御门禁

export interface SsrfValidationResult {
  valid: boolean;
  error?: string;
  parsedUrl?: URL;
}

/** 是否为私有或保留 IP 地址 */
function isPrivateIp(hostname: string): boolean {
  // IPv4 本地环回与保留
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1") {
    return true;
  }

  // 检查是否匹配常见的私有 IPv4 段
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    // 10.0.0.0 - 10.255.255.255
    if (a === 10) return true;
    // 172.16.0.0 - 172.31.255.255
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0 - 192.168.255.255
    if (a === 192 && b === 168) return true;
    // 127.0.0.0 - 127.255.255.255
    if (a === 127) return true;
    // 169.254.0.0 - 169.254.255.255 (云服务链路本地/元数据)
    if (a === 169 && b === 254) return true;
    // 0.0.0.0
    if (a === 0) return true;
  }

  // IPv6 简易检查
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    const inner = hostname.slice(1, -1).toLowerCase();
    if (inner === "::1" || inner.startsWith("fe80:") || inner.startsWith("fc00:") || inner.startsWith("fd00:")) {
      return true;
    }
  }

  return false;
}

/**
 * 校验目标 NAS 地址的安全性
 * @param urlString 用户输入的 URL
 * @param allowPrivateIp 是否允许局域网私有 IP（开发与离线测试模式）
 */
export function validateNasTargetUrl(
  urlString: string,
  allowPrivateIp = false
): SsrfValidationResult {
  if (!urlString || typeof urlString !== "string") {
    return { valid: false, error: "URL 地址不能为空" };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch (e) {
    return { valid: false, error: "URL 格式不合法，请输入标准完整路径 (如 https://...)" };
  }

  // 1. 协议白名单校验
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: `不支持的协议: ${parsed.protocol}，仅允许使用 http 或 https`,
    };
  }

  // 2. 私有与环回 IP 过滤
  const hostname = parsed.hostname.toLowerCase();
  if (!allowPrivateIp && isPrivateIp(hostname)) {
    return {
      valid: false,
      error: `SSRF 防御拦截: 禁止直接向私有/环回网络 (${hostname}) 发送跨网请求，请使用 Cloudflare Tunnel 或公网域名穿透访问`,
    };
  }

  return {
    valid: true,
    parsedUrl: parsed,
  };
}
