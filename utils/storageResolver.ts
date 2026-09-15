// utils/storageResolver.ts
// 智能动态网盘驱动与 AList 挂载路径解析引擎 (前后端通用)

export interface NetdiskMatchRule {
  key: string;
  name: string;
  urlPatterns: RegExp[];
  drivers: string[];
  keywords: string[];
  fallbackPath: string;
}

export const NETDISK_RULES: NetdiskMatchRule[] = [
  {
    key: "xunlei",
    name: "迅雷网盘",
    urlPatterns: [/pan\.xunlei\.com/i, /xunlei/i],
    drivers: ["Thunder", "Xunlei"],
    keywords: ["迅雷", "xunlei", "thunder"],
    fallbackPath: "/迅雷",
  },
  {
    key: "quark",
    name: "夸克网盘",
    urlPatterns: [/quark\.cn/i, /quark/i],
    drivers: ["QuarkTV", "Quark"],
    keywords: ["夸克", "quark"],
    fallbackPath: "/夸克",
  },
  {
    key: "baidu",
    name: "百度网盘",
    urlPatterns: [/pan\.baidu\.com/i, /baidu/i],
    drivers: ["BaiduNetdisk", "BaiduPhoto"],
    keywords: ["百度", "baidu"],
    fallbackPath: "/百度",
  },
  {
    key: "115",
    name: "115网盘",
    urlPatterns: [/115\.com/i],
    drivers: ["115 Cloud", "115"],
    keywords: ["115", "115网盘"],
    fallbackPath: "/115网盘",
  },
  {
    key: "aliyun",
    name: "阿里云盘",
    urlPatterns: [/aliyundrive\.com/i, /alipan\.com/i],
    drivers: ["AliyundriveShare2Open", "AliyundriveOpen", "Aliyundrive"],
    keywords: ["阿里", "alipan", "aliyun"],
    fallbackPath: "/阿里云盘",
  },
  {
    key: "123pan",
    name: "123网盘",
    urlPatterns: [/123pan\.com/i],
    drivers: ["123Pan"],
    keywords: ["123网盘", "123pan"],
    fallbackPath: "/123网盘",
  },
  {
    key: "uc",
    name: "UC网盘",
    urlPatterns: [/drive\.uc\.cn/i, /uc\.cn/i],
    drivers: ["UCDrive", "UC"],
    keywords: ["uc网盘", "uc云盘"],
    fallbackPath: "/UC网盘",
  },
  {
    key: "189",
    name: "天翼云盘",
    urlPatterns: [/cloud\.189\.cn/i],
    drivers: ["189Cloud"],
    keywords: ["天翼云盘", "天翼", "189云盘"],
    fallbackPath: "/天翼云盘",
  },
  {
    key: "139",
    name: "移动云盘",
    urlPatterns: [/caiyun\.139\.com/i],
    drivers: ["139Yun"],
    keywords: ["移动云盘", "和彩云"],
    fallbackPath: "/移动云盘",
  },
];

export interface ResolvedStorageResult {
  matched: boolean;
  rule?: NetdiskMatchRule;
  targetPath: string;
  driver?: string;
  strategy: "driver_match" | "keyword_match" | "rule_fallback" | "root_fallback";
  humanReadableName: string;
}

export function resolveNetdiskMountPath(
  resourceTarget: string,
  configuredStorages: any[] = []
): ResolvedStorageResult {
  const url = (resourceTarget || "").trim().toLowerCase();
  const isUri = /^[a-z0-9+.-]+:/i.test(url) || url.includes("://");

  // 1. 查找匹配的网盘规则：若是 URI 则严格匹配域名/协议正则；纯文本时才做中文关键词匹配
  const rule = NETDISK_RULES.find((r) => {
    if (r.urlPatterns.some((p) => p.test(url))) {
      return true;
    }
    if (!isUri) {
      return r.keywords.some((k) => k.length >= 2 && url.includes(k.toLowerCase()));
    }
    return false;
  });

  if (!rule) {
    return {
      matched: false,
      targetPath: "/",
      strategy: "root_fallback",
      humanReadableName: "通用根目录",
    };
  }

  if (configuredStorages && configuredStorages.length > 0) {
    const driverMatch = configuredStorages.find((s) =>
      rule.drivers.some((d) => d.toLowerCase() === (s.driver || "").toLowerCase())
    );
    if (driverMatch && driverMatch.mountPath) {
      return {
        matched: true,
        rule,
        targetPath: driverMatch.mountPath.startsWith("/") ? driverMatch.mountPath : `/${driverMatch.mountPath}`,
        driver: driverMatch.driver,
        strategy: "driver_match",
        humanReadableName: `${rule.name} (${driverMatch.mountPath})`,
      };
    }

    const keywordMatch = configuredStorages.find((s) => {
      const p = (s.mountPath || "").toLowerCase();
      return rule.keywords.some((k) => p.includes(k.toLowerCase()));
    });
    if (keywordMatch && keywordMatch.mountPath) {
      return {
        matched: true,
        rule,
        targetPath: keywordMatch.mountPath.startsWith("/") ? keywordMatch.mountPath : `/${keywordMatch.mountPath}`,
        driver: keywordMatch.driver,
        strategy: "keyword_match",
        humanReadableName: `${rule.name} (${keywordMatch.mountPath})`,
      };
    }
  }

  return {
    matched: true,
    rule,
    targetPath: rule.fallbackPath,
    strategy: "rule_fallback",
    humanReadableName: `${rule.name} (${rule.fallbackPath})`,
  };
}
