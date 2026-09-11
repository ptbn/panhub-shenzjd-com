/**
 * 豆瓣影视多维探索服务 (Douban Explore Service)
 * 采用豆瓣官方探索 API (/j/new_search_subjects)，支持按大类、题材、年份区间、评分区间、排序规则进行多维检索
 */

import { ofetch } from "ofetch";
import { MemoryCache } from "../cache/memoryCache";

export interface DoubanExploreQuery {
  type?: string; // 电影 | 电视剧 | 动漫 | 纪录片 | 综艺 | all
  genre?: string; // 科幻 | 悬疑 | 动作 | 喜剧 | 爱情 | 犯罪 | 惊悚 | 恐怖 | 战争 | 动画 | 奇幻 | 冒险 | 灾难 | all
  yearRange?: string; // 2024-2025 | 2020-2023 | 2010-2019 | 2000-2009 | before-2000 | all
  scoreRange?: string; // 9-10 | 8-10 | 7-10 | all
  sort?: string; // U (近期热门) | S (评分最高) | R (最新上映) | T (标记最多)
  page?: number;
  limit?: number;
}

export interface DoubanExploreItem {
  id: string;
  title: string;
  rate: string;
  cover: string;
  url: string;
  directors: string[];
  casts: string[];
  star?: string;
}

export interface DoubanExploreResult {
  items: DoubanExploreItem[];
  hasMore: boolean;
  page: number;
  limit: number;
  query: DoubanExploreQuery;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 小时内存缓存
const DOUBAN_EXPLORE_BASE = "https://movie.douban.com/j/new_search_subjects";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// 初始化探索缓存（最多缓存 200 组筛选结果）
export const exploreCache = new MemoryCache<DoubanExploreResult>({
  maxSize: 200,
  maxMemoryBytes: 32 * 1024 * 1024,
});

/**
 * 构建向豆瓣发起请求的 URL 与参数
 */
export function buildDoubanExploreUrl(query: DoubanExploreQuery): string {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(50, Math.max(5, query.limit || 20));
  const start = (page - 1) * limit;

  // 1. 组装 tags
  const tags: string[] = [];
  if (query.type && query.type !== "all") {
    tags.push(query.type);
  }
  if (query.genre && query.genre !== "all") {
    tags.push(query.genre);
  }

  // 2. 映射评分区间
  let range = "0,10";
  if (query.scoreRange === "9-10") range = "9,10";
  else if (query.scoreRange === "8-10") range = "8,10";
  else if (query.scoreRange === "7-10") range = "7,10";

  // 3. 映射年份区间
  let yearRangeParam = "";
  if (query.yearRange === "2024-2025") yearRangeParam = "2024,2025";
  else if (query.yearRange === "2020-2023") yearRangeParam = "2020,2023";
  else if (query.yearRange === "2010-2019") yearRangeParam = "2010,2019";
  else if (query.yearRange === "2000-2009") yearRangeParam = "2000,2009";
  else if (query.yearRange === "before-2000") yearRangeParam = "1920,1999";

  // 4. 排序模式
  const sort = query.sort && ["U", "S", "R", "T"].includes(query.sort) ? query.sort : "U";

  const params = new URLSearchParams();
  params.set("sort", sort);
  params.set("range", range);
  if (tags.length > 0) {
    params.set("tags", tags.join(","));
  }
  if (yearRangeParam) {
    params.set("year_range", yearRangeParam);
  }
  params.set("start", String(start));
  params.set("limit", String(limit));

  return `${DOUBAN_EXPLORE_BASE}?${params.toString()}`;
}

/**
 * 执行豆瓣影视多维检索
 */
export async function fetchDoubanExplore(
  query: DoubanExploreQuery = {}
): Promise<DoubanExploreResult> {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(50, Math.max(5, query.limit || 20));

  const normalizedQuery: DoubanExploreQuery = {
    type: query.type || "all",
    genre: query.genre || "all",
    yearRange: query.yearRange || "all",
    scoreRange: query.scoreRange || "all",
    sort: query.sort || "U",
    page,
    limit,
  };

  const cacheKey = `douban-explore:${normalizedQuery.type}:${normalizedQuery.genre}:${normalizedQuery.yearRange}:${normalizedQuery.scoreRange}:${normalizedQuery.sort}:${page}:${limit}`;

  // 检查内存缓存
  const cached = exploreCache.get(cacheKey);
  if (cached.hit && cached.value) {
    return cached.value;
  }

  const url = buildDoubanExploreUrl(normalizedQuery);

  try {
    const rawData = await ofetch<{ data?: any[] }>(url, {
      headers: {
        "User-Agent": UA,
        Referer: "https://movie.douban.com/explore",
      },
      timeout: 8000,
    });

    const rawItems = Array.isArray(rawData?.data) ? rawData.data : [];
    const items: DoubanExploreItem[] = rawItems.map((item: any) => ({
      id: String(item.id || ""),
      title: String(item.title || "").trim(),
      rate: String(item.rate || "0.0"),
      cover: String(item.cover || ""),
      url: String(item.url || (item.id ? `https://movie.douban.com/subject/${item.id}/` : "")),
      directors: Array.isArray(item.directors) ? item.directors : [],
      casts: Array.isArray(item.casts) ? item.casts : [],
      star: String(item.star || ""),
    }));

    const result: DoubanExploreResult = {
      items,
      hasMore: items.length >= limit,
      page,
      limit,
      query: normalizedQuery,
    };

    if (items.length > 0) {
      exploreCache.set(cacheKey, result, CACHE_TTL_MS);
    }

    return result;
  } catch (err: any) {
    console.warn(`[DoubanExplore] 请求失败 (${url}):`, err?.message || err);
    // 优雅降级返回空结果，不抛出异常打崩溃页面
    return {
      items: [],
      hasMore: false,
      page,
      limit,
      query: normalizedQuery,
    };
  }
}
