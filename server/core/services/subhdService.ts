/**
 * SubHD 字幕检索与解析服务 (SubHD Subtitle Service)
 * 支持基于豆瓣 Subject ID (如 /d/1889243) 及电影关键词 (如 /search/星际穿越) 对接 SubHD (subhd.cc)
 * 提取中文字幕、字幕组徽章、简繁双语与特效格式标签，并提供 6 小时内存缓存
 */

import { ofetch } from "ofetch";
import * as cheerio from "cheerio";
import { MemoryCache } from "../cache/memoryCache";

export interface SubItem {
  id: string; // SubHD 字幕唯一标识 (如 "setAL8")
  title: string; // 字幕文件/发布名称 (如 "Interstellar.2014.1080p.BluRay.x264.DTS-RARBG")
  filmTitle?: string; // 关联影片中文名 (如 "星际穿越")
  url: string; // 直达 SubHD 详情下载页面 (如 "https://subhd.cc/a/setAL8")
  group?: string; // 字幕组 (如 "F.I.X字幕侠", "电波字幕组") 或发布人
  languages: string[]; // 语言属性 (如 ["双语", "简体", "英语"])
  formats: string[]; // 格式属性 (如 ["ASS", "SRT", "SUP"])
  tags: string[]; // 质量与来源标签 (如 ["官方字幕", "精选推荐", "特效"])
  downloads?: string; // 下载量 (如 "2278")
}

export interface SubhdResult {
  doubanId?: string;
  keyword?: string;
  subhdUrl: string; // 直达 SubHD 聚合页链接 (https://subhd.cc/d/... 或 /search/...)
  items: SubItem[];
  total: number;
}

export interface SubhdQuery {
  doubanId?: string;
  keyword?: string;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 小时缓存
const SUBHD_BASE = "https://subhd.cc";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// 初始化字幕缓存（最多缓存 300 部影片字幕结果）
export const subhdCache = new MemoryCache<SubhdResult>({
  maxSize: 300,
  maxMemoryBytes: 16 * 1024 * 1024,
});

const KNOWN_FORMATS = new Set(["ASS", "SRT", "SUP", "SSA", "VTT", "SUB", "IDX"]);
const KNOWN_LANGUAGES = new Set([
  "双语",
  "简体",
  "繁体",
  "中英",
  "双语字幕",
  "简繁",
  "英语",
  "中字",
  "国配",
  "多语",
  "粤语",
  "日语",
  "韩语",
]);
const KNOWN_TAGS = new Set([
  "官方字幕",
  "精选推荐",
  "原创翻译",
  "其他来源",
  "首发",
  "特效",
  "压制",
  "听译",
  "重置",
]);

/**
 * 从 HTML 中解析 SubHD 字幕列表
 */
export function parseSubhdHtml(
  html: string,
  doubanId?: string,
  keyword?: string
): SubhdResult {
  const $ = cheerio.load(html);
  const items: SubItem[] = [];
  const seenIds = new Set<string>();

  // 1. 优先提取搜索列表页卡片 (.bg-white.shadow-sm.rounded-3.mb-4)
  $(".bg-white.shadow-sm.rounded-3.mb-4").each((_, card) => {
    const $card = $(card);
    const subLinks = $card.find('a[href^="/a/"]');
    if (subLinks.length === 0) return;

    // 获取字幕 ID
    const href = subLinks.first().attr("href") || "";
    const idMatch = href.match(/\/a\/([a-zA-Z0-9_-]+)/);
    if (!idMatch) return;
    const id = idMatch[1];
    if (seenIds.has(id)) return;

    let filmTitle = "";
    let releaseTitle = "";
    if (subLinks.length >= 2) {
      filmTitle = $(subLinks[0]).text().trim();
      releaseTitle = $(subLinks[1]).text().trim();
    } else {
      releaseTitle = $(subLinks[0]).text().trim();
    }

    const title = releaseTitle || filmTitle || "未知字幕文件";

    // 提取字幕组或发布人
    const groupLink = $card.find('a[href^="/zu/"]').first();
    const userLink = $card.find('a[href^="/u/"]').first();
    const group = groupLink.text().trim() || userLink.text().trim() || undefined;

    // 提取徽章
    const languages: string[] = [];
    const formats: string[] = [];
    const tags: string[] = [];
    let downloads: string | undefined;

    $card.find("span, div.f11 span").each((_, span) => {
      const text = $(span).text().trim();
      if (!text) return;
      const upper = text.toUpperCase();
      if (KNOWN_FORMATS.has(upper)) {
        if (!formats.includes(upper)) formats.push(upper);
      } else if (KNOWN_LANGUAGES.has(text)) {
        if (!languages.includes(text)) languages.push(text);
      } else if (KNOWN_TAGS.has(text)) {
        if (!tags.includes(text)) tags.push(text);
      }
    });

    // 提取下载量（寻找包含 bi-download 的图标后跟随的数字）
    $card.find(".bi-download").each((_, icon) => {
      const parent = $(icon).parent();
      const text = parent.text().trim();
      const match = text.match(/(\d+)/);
      if (match) downloads = match[1];
    });

    seenIds.add(id);
    items.push({
      id,
      title,
      filmTitle: filmTitle || undefined,
      url: `${SUBHD_BASE}/a/${id}`,
      group,
      languages,
      formats,
      tags,
      downloads,
    });
  });

  // 2. 若未从卡片中提取到（例如豆瓣聚合页 /d/{doubanId} 的行列表容器 div.view-text），则按通用模式提取
  $('a[href^="/a/"]').each((_, a) => {
    const $a = $(a);
    const href = $a.attr("href") || "";
    const idMatch = href.match(/\/a\/([a-zA-Z0-9_-]+)/);
    if (!idMatch) return;
    const id = idMatch[1];
    if (seenIds.has(id)) return;

    const title = $a.text().trim();
    if (!title || title.length < 2) return;

    // 寻找整行或容器 (排除仅包裹标题的 div.view-text)
    const row = $a.closest(".px-3.py-2, .list-group-item, tr, li, div.border-bottom, .bg-white");
    const scope = row.length > 0 ? row : $a.parent().parent();

    // 提取字幕组
    const groupLink = scope.find('a[href^="/zu/"]').first();
    const userLink = scope.find('a[href^="/u/"]').first();
    const group = groupLink.text().trim() || userLink.text().trim() || undefined;

    // 提取徽章
    const languages: string[] = [];
    const formats: string[] = [];
    const tags: string[] = [];
    let downloads: string | undefined;

    scope.find("span, .badge").each((_, span) => {
      const text = $(span).text().trim();
      if (!text) return;
      const upper = text.toUpperCase();
      if (KNOWN_FORMATS.has(upper)) {
        if (!formats.includes(upper)) formats.push(upper);
      } else if (KNOWN_LANGUAGES.has(text)) {
        if (!languages.includes(text)) languages.push(text);
      } else if (KNOWN_TAGS.has(text)) {
        if (!tags.includes(text)) tags.push(text);
      }
    });

    seenIds.add(id);
    items.push({
      id,
      title,
      url: `${SUBHD_BASE}/a/${id}`,
      group,
      languages,
      formats,
      tags,
      downloads,
    });
  });

  const subhdUrl = doubanId
    ? `${SUBHD_BASE}/d/${doubanId}`
    : `${SUBHD_BASE}/search/${encodeURIComponent(keyword || "")}`;

  return {
    doubanId,
    keyword,
    subhdUrl,
    items,
    total: items.length,
  };
}

/**
 * 获取 SubHD 字幕列表（支持 6 小时内存缓存与优雅容错）
 */
export async function fetchSubhdSubtitles(
  query: SubhdQuery
): Promise<SubhdResult> {
  const doubanId = (query.doubanId || "").trim();
  const keyword = (query.keyword || "").trim();

  if (!doubanId && !keyword) {
    return {
      subhdUrl: SUBHD_BASE,
      items: [],
      total: 0,
    };
  }

  const cacheKey = doubanId ? `subhd:d:${doubanId}` : `subhd:kw:${keyword}`;
  const cached = subhdCache.get(cacheKey);
  if (cached.hit && cached.value) {
    return cached.value;
  }

  const defaultResult: SubhdResult = {
    doubanId: doubanId || undefined,
    keyword: keyword || undefined,
    subhdUrl: doubanId
      ? `${SUBHD_BASE}/d/${doubanId}`
      : `${SUBHD_BASE}/search/${encodeURIComponent(keyword)}`,
    items: [],
    total: 0,
  };

  try {
    let result: SubhdResult | null = null;

    // 1. 若有豆瓣 ID，优先通过 /d/{doubanId} 检索精准专页
    if (doubanId) {
      const url = `${SUBHD_BASE}/d/${doubanId}`;
      const html = await ofetch<string>(url, {
        headers: { "User-Agent": UA, Referer: SUBHD_BASE },
        timeout: 8000,
        responseType: "text",
      });
      const parsed = parseSubhdHtml(html, doubanId, keyword);
      if (parsed.items.length > 0) {
        result = parsed;
      }
    }

    // 2. 若豆瓣 ID 检索无果，或仅传入关键词，则降级通过 /search/{keyword} 检索
    if ((!result || result.items.length === 0) && keyword) {
      const searchUrl = `${SUBHD_BASE}/search/${encodeURIComponent(keyword)}`;
      const html = await ofetch<string>(searchUrl, {
        headers: { "User-Agent": UA, Referer: SUBHD_BASE },
        timeout: 8000,
        responseType: "text",
      });
      const parsed = parseSubhdHtml(html, doubanId, keyword);
      result = parsed;
    }

    const finalResult = result || defaultResult;

    if (finalResult.items.length > 0) {
      subhdCache.set(cacheKey, finalResult, CACHE_TTL_MS);
    }

    return finalResult;
  } catch (err: any) {
    console.warn(`[SubHD] 字幕请求失败 (id=${doubanId}, kw=${keyword}):`, err?.message || err);
    return defaultResult;
  }
}
