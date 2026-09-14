import { ofetch } from "ofetch";
import { loggers } from "./logger";

export interface ExpandedMeta {
  chineseTitle: string;
  originalTitle: string;
  year?: string;
  type?: string;
}

interface CacheEntry {
  meta: ExpandedMeta | null;
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 小时缓存
const MAX_CACHE_SIZE = 500;
const memoryCache = new Map<string, CacheEntry>();

/**
 * 智能元数据对齐（参考 Torrentio 核心机制）：
 * 若搜索词包含中文，且属于影视作品，自动利用轻量元数据接口提取其对应的原版英文名与年份
 */
export async function resolveEnglishTitle(keyword: string): Promise<ExpandedMeta | null> {
  const trimmed = keyword.trim();
  if (!trimmed) return null;

  // 仅在包含中文字符时尝试映射（纯英文/拼音无需映射）
  if (!/[\u4e00-\u9fa5]/.test(trimmed)) {
    return null;
  }

  const cacheKey = trimmed.toLowerCase();
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.meta;
  }

  try {
    const url = `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(trimmed)}`;
    const data = await ofetch<any[]>(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      timeout: 3500,
      retry: 2,
      retryDelay: 300,
    });

    if (Array.isArray(data) && data.length > 0) {
      // 遍历前 3 个候选，优先寻找包含有效英文字符的原名 sub_title
      for (const item of data.slice(0, 3)) {
        const subTitle = typeof item.sub_title === "string" ? item.sub_title.trim() : "";
        // 确保原名中包含至少 2 个连续英文字符（避免繁体中文又作为原名）
        if (subTitle && /[a-zA-Z]{2,}/.test(subTitle)) {
          const result: ExpandedMeta = {
            chineseTitle: String(item.title || trimmed),
            originalTitle: subTitle,
            year: item.year ? String(item.year) : undefined,
            type: item.type ? String(item.type) : undefined,
          };

          if (memoryCache.size >= MAX_CACHE_SIZE) {
            const oldestKey = memoryCache.keys().next().value;
            if (oldestKey) memoryCache.delete(oldestKey);
          }
          memoryCache.set(cacheKey, { meta: result, timestamp: Date.now() });
          return result;
        }
      }
    }
  } catch (err: any) {
    loggers.plugin.debug("元数据对齐查询跳过", { keyword: trimmed, error: err?.message });
  }

  // 记录空结果缓存，防止对同一冷门词重复查询
  if (memoryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(cacheKey, { meta: null, timestamp: Date.now() });
  return null;
}
