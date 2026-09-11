/**
 * 网盘 URL 规范化与唯一资源键提取 (URL Canonicalization)
 * 借鉴 AList (40k+ Stars) 架构思想，从各类网盘分享链接中提炼核心资源 ID (Share ID)，
 * 消除渠道前缀 (b.quark.cn vs pan.quark.cn)、参数 (?pwd=xxx, #list) 等干扰，
 * 实现 100% 精准的底层物理去重。
 */

export interface CanonicalInfo {
  platform: string;
  shareId: string;
  canonicalKey: string;
  cleanUrl: string;
}

/**
 * 规范化提取码
 */
export function extractPassword(url: string, existingPwd?: string): string {
  if (existingPwd && existingPwd.trim()) {
    return existingPwd.trim();
  }
  try {
    const urlObj = new URL(url);
    const pwd =
      urlObj.searchParams.get("pwd") ||
      urlObj.searchParams.get("password") ||
      urlObj.searchParams.get("code") ||
      "";
    return pwd.trim();
  } catch {
    const m = /[?&](?:pwd|password|code)=([a-zA-Z0-9]+)/i.exec(url);
    return m ? m[1] : "";
  }
}

/**
 * 提取网盘链接的 Canonical 资源标识
 */
export function getCanonicalDriveInfo(rawUrl: string): CanonicalInfo {
  const url = (rawUrl || "").trim();
  if (!url) {
    return {
      platform: "unknown",
      shareId: "",
      canonicalKey: "",
      cleanUrl: "",
    };
  }

  // 1. 夸克网盘 (pan.quark.cn / b.quark.cn)
  // 例: https://pan.quark.cn/s/669fbb7c66cb, https://b.quark.cn/s/669fbb7c66cb
  const quarkMatch = /(?:pan|b)\.quark\.cn\/s\/([a-zA-Z0-9]+)/i.exec(url);
  if (quarkMatch) {
    const id = quarkMatch[1];
    return {
      platform: "quark",
      shareId: id,
      canonicalKey: `quark:${id}`,
      cleanUrl: `https://pan.quark.cn/s/${id}`,
    };
  }

  // 2. 阿里云盘 (alipan.com / aliyundrive.com)
  // 例: https://www.alipan.com/s/fJt8p..., https://www.aliyundrive.com/s/fJt8p...
  const aliyunMatch = /(?:alipan|aliyundrive)\.com\/s\/([a-zA-Z0-9]+)/i.exec(url);
  if (aliyunMatch) {
    const id = aliyunMatch[1];
    return {
      platform: "aliyun",
      shareId: id,
      canonicalKey: `aliyun:${id}`,
      cleanUrl: `https://www.alipan.com/s/${id}`,
    };
  }

  // 3. 百度网盘 (pan.baidu.com)
  // 例: https://pan.baidu.com/s/1abcdef123456, https://pan.baidu.com/share/init?surl=abcdef123456
  const baiduMatch = /pan\.baidu\.com\/s\/(?:1)?([a-zA-Z0-9_-]+)/i.exec(url);
  if (baiduMatch) {
    const id = baiduMatch[1];
    return {
      platform: "baidu",
      shareId: id,
      canonicalKey: `baidu:${id}`,
      cleanUrl: `https://pan.baidu.com/s/1${id}`,
    };
  }
  const baiduInitMatch = /pan\.baidu\.com\/share\/init\?[^#]*surl=([a-zA-Z0-9_-]+)/i.exec(url);
  if (baiduInitMatch) {
    const id = baiduInitMatch[1];
    return {
      platform: "baidu",
      shareId: id,
      canonicalKey: `baidu:${id}`,
      cleanUrl: `https://pan.baidu.com/s/1${id}`,
    };
  }

  // 4. 迅雷云盘 (pan.xunlei.com)
  // 例: https://pan.xunlei.com/s/VN_f...
  const xunleiMatch = /pan\.xunlei\.com\/s\/([a-zA-Z0-9_-]+)/i.exec(url);
  if (xunleiMatch) {
    const id = xunleiMatch[1];
    return {
      platform: "xunlei",
      shareId: id,
      canonicalKey: `xunlei:${id}`,
      cleanUrl: `https://pan.xunlei.com/s/${id}`,
    };
  }

  // 5. 123云盘 (123pan.com / 123684.com)
  // 例: https://www.123pan.com/s/xxx-yyy, https://www.123684.com/s/xxx-yyy
  const pan123Match = /(?:123pan|123684|123952)\.com\/s\/([a-zA-Z0-9_-]+)/i.exec(url);
  if (pan123Match) {
    const id = pan123Match[1];
    return {
      platform: "123pan",
      shareId: id,
      canonicalKey: `123pan:${id}`,
      cleanUrl: `https://www.123pan.com/s/${id}`,
    };
  }

  // 6. UC 网盘 (drive.uc.cn)
  // 例: https://drive.uc.cn/s/xxx
  const ucMatch = /drive\.uc\.cn\/s\/([a-zA-Z0-9]+)/i.exec(url);
  if (ucMatch) {
    const id = ucMatch[1];
    return {
      platform: "uc",
      shareId: id,
      canonicalKey: `uc:${id}`,
      cleanUrl: `https://drive.uc.cn/s/${id}`,
    };
  }

  // 7. 通用兜底：剥离 query 参数、hash 与尾部斜杠
  try {
    const parsed = new URL(url);
    const clean = `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, "");
    return {
      platform: "general",
      shareId: clean,
      canonicalKey: `general:${clean.toLowerCase()}`,
      cleanUrl: clean,
    };
  } catch {
    const stripped = url.split(/[?#]/)[0].replace(/\/+$/, "");
    return {
      platform: "general",
      shareId: stripped,
      canonicalKey: `general:${stripped.toLowerCase()}`,
      cleanUrl: stripped,
    };
  }
}
