/**
 * 资源元数据智能特征解析引擎 (useResourceParser)
 * 集成开源标准 parse-torrent-title 与中文网盘命名增强规则
 * 从上游杂乱的网盘资源标题与描述中毫秒级抽离分辨率、影视类型、年份、特色画质标签、体积大小、视频编码与音轨字幕
 */

import ptt from "parse-torrent-title";

export type ResolutionType = "all" | "4K" | "1080P" | "720P" | "other";
export type MediaType = "all" | "movie" | "tv" | "anime" | "doc" | "show" | "other";
export type QualityTag = "REMUX" | "杜比视界" | "HDR" | "蓝光" | "高帧率";
export type YearRange = "all" | "2024-2025" | "2020-2023" | "2010-2019" | "2000-2009" | "before-2000";
export type SortOption = "default" | "quality-desc" | "year-desc" | "year-asc";

export interface ParsedResourceMeta {
  resolution: "4K" | "1080P" | "720P" | "other";
  qualityTags: QualityTag[];
  year: number | null;
  mediaType: "movie" | "tv" | "anime" | "doc" | "show" | "other";
  rawTitle: string;
  size?: string;         // 如 "45.2 GB"、"2.5 GB/集"
  codec?: string;        // 如 "HEVC/H.265"、"AVC/H.264"、"AV1"
  audio?: string;        // 如 "Dolby Atmos"、"DTS-HD"、"国粤双语"
  subtitles?: string;    // 如 "中英双字"、"简繁内封"
  episodeInfo?: string;  // 如 "全39集"、"更新至EP12"
}

export interface FilterState {
  platform: string;
  resolution: ResolutionType;
  mediaType: MediaType;
  yearRange: YearRange;
  specialQuality: QualityTag | "all";
  sortBy: SortOption;
}

// 缓存解析结果，避免高频重绘重复计算
const metaCache = new Map<string, ParsedResourceMeta>();

/**
 * 解析单条资源的元数据特征
 * @param title 标题
 * @param description 正文描述详情（可选，用于辅助提取详细压制参数）
 */
export function parseResourceMeta(title: string, description?: string): ParsedResourceMeta {
  if (!title && !description) {
    return {
      resolution: "other",
      qualityTags: [],
      year: null,
      mediaType: "other",
      rawTitle: "",
    };
  }

  const cacheKey = `${title || ""}###${description || ""}`;
  const cached = metaCache.get(cacheKey);
  if (cached) return cached;

  const t = (title || "").trim();
  const fullText = description ? `${t} ${description}` : t;

  // 使用开源标准 parse-torrent-title 尝试解析欧美规范命名
  let pttInfo: any = {};
  try {
    pttInfo = ptt.parse(t) || {};
  } catch {
    pttInfo = {};
  }

  // 1. 清晰度识别
  let resolution: "4K" | "1080P" | "720P" | "other" = "other";
  if (
    pttInfo.resolution === "2160p" ||
    pttInfo.resolution === "4k" ||
    /(?:4k|2160p|uhd|3840x2160)/i.test(fullText)
  ) {
    resolution = "4K";
  } else if (
    pttInfo.resolution === "1080p" ||
    /(?:1080p|1080i|fhd|1920x1080)/i.test(fullText)
  ) {
    resolution = "1080P";
  } else if (
    pttInfo.resolution === "720p" ||
    /(?:720p|hd|1280x720)/i.test(fullText)
  ) {
    resolution = "720P";
  }

  // 2. 特殊规格与画质标签
  const qualityTags: QualityTag[] = [];
  if (
    pttInfo.quality === "remux" ||
    /(?:remux|原盘|bdremux|uhdremux)/i.test(fullText)
  ) {
    qualityTags.push("REMUX");
  }
  if (
    /(?:dolby\s*vision|dovi|\bdv\b|杜比视界)/i.test(fullText)
  ) {
    qualityTags.push("杜比视界");
  }
  if (
    pttInfo.color === "HDR" ||
    /(?:hdr10\+|hdr10|\bhdr\b|高动态)/i.test(fullText)
  ) {
    qualityTags.push("HDR");
  }
  if (
    pttInfo.source === "bluray" ||
    /(?:bluray|blu-ray|bdr|bdrip|蓝光)/i.test(fullText)
  ) {
    qualityTags.push("蓝光");
  }
  if (/(?:60fps|60帧|120fps|120帧)/i.test(fullText)) {
    qualityTags.push("高帧率");
  }

  // 3. 发行年份识别（优先取 PTT 解析结果，未取到则用中文正则）
  let year: number | null = null;
  if (pttInfo.year && pttInfo.year >= 1920 && pttInfo.year <= 2035) {
    year = pttInfo.year;
  } else {
    const yearMatch = fullText.match(
      /(?:[\(\[\.\s_\-]|年)(19[2-9]\d|20[0-3]\d)(?:[\)\]\.\s_\-]|年|$)/
    );
    if (yearMatch && yearMatch[1]) {
      year = parseInt(yearMatch[1], 10);
    }
  }

  // 4. 片源内容类型识别
  let mediaType: "movie" | "tv" | "anime" | "doc" | "show" | "other" = "other";
  if (/(?:动画|动漫|新番|剧场版|番剧|b-global|bilibili|\banime\b|ova|oad)/i.test(fullText)) {
    mediaType = "anime";
  } else if (/(?:纪录片|纪录|documentary|\bbbc\b|国家地理|探索频道|discovery)/i.test(fullText)) {
    mediaType = "doc";
  } else if (/(?:综艺|真人秀|脱口秀|期全|演唱会|晚会)/i.test(fullText)) {
    mediaType = "show";
  } else if (
    pttInfo.season !== undefined ||
    pttInfo.episode !== undefined ||
    /(?:s\d{1,2}|ep?\d{1,2}|全[0-9一二三四五六七八九十百]+[集回话]|第[0-9一二三四五六七八九十]+[季部期集]|更新至|完结|连载|美剧|韩剧|日剧|国产剧|电视剧|连续剧|集全)/i.test(
      fullText
    )
  ) {
    mediaType = "tv";
  } else if (/(?:电影|movie|\bbd\b|\bhd\b)/i.test(fullText) || (year && resolution !== "other")) {
    mediaType = "movie";
  }

  // 5. 体积大小识别 (如 45.2 GB, 2.5 GB/集, 120GB)
  let size: string | undefined = undefined;
  const sizeMatch = fullText.match(
    /(?:^|[\s\[\(|·])(\d+(?:\.\d+)?\s*(?:GB|MB|TB|G|M))(?=$|[\s\]\)|·\/])/i
  );
  if (sizeMatch && sizeMatch[1]) {
    size = sizeMatch[1].toUpperCase().replace(/\s+/, "");
    if (/^\d+[GM]$/.test(size)) {
      size += "B";
    }
  }

  // 6. 视频编码识别 (H.265 / HEVC, H.264 / AVC, AV1)
  let codec: string | undefined = undefined;
  if (pttInfo.codec === "x265" || /(?:h\.?265|hevc|x265)/i.test(fullText)) {
    codec = "H.265/HEVC";
  } else if (pttInfo.codec === "x264" || /(?:h\.?264|avc|x264)/i.test(fullText)) {
    codec = "H.264/AVC";
  } else if (/\bav1\b/i.test(fullText)) {
    codec = "AV1";
  }

  // 7. 音频规格识别 (Atmos, DTS-HD, 多音轨, 国粤双语)
  let audio: string | undefined = undefined;
  if (pttInfo.audio === "atmos" || /(?:atmos|杜比全景声)/i.test(fullText)) {
    audio = "Dolby Atmos";
  } else if (pttInfo.audio === "dts-hd" || /(?:dts-hd|dts)/i.test(fullText)) {
    audio = "DTS-HD";
  } else if (/(?:国粤双语|国日双语|国英语|双语音轨)/i.test(fullText)) {
    audio = "国粤双语";
  } else if (/(?:国语音轨|国语配音|国语)/i.test(fullText)) {
    audio = "国语";
  }

  // 8. 字幕规格识别 (中英双字, 简繁内封)
  let subtitles: string | undefined = undefined;
  if (/(?:中英双字|中英字幕|双语字幕)/i.test(fullText)) {
    subtitles = "中英双字";
  } else if (/(?:内封字幕|简繁字幕|简繁内封)/i.test(fullText)) {
    subtitles = "简繁内封";
  } else if (/(?:中文字幕|官方中字|中字)/i.test(fullText)) {
    subtitles = "中文字幕";
  }

  // 9. 集数/完结状态识别 (全39集, 更新至EP12)
  let episodeInfo: string | undefined = undefined;
  const epMatch = fullText.match(
    /(?:全\s*\d+\s*[集话回期]|更新至\s*(?:ep?)?\d+[集话回期]?|s\d{1,2}e\d{1,2}|第[0-9一二三四五六七八九十]+[季部期集])/i
  );
  if (epMatch) {
    episodeInfo = epMatch[0].trim();
  }

  const result: ParsedResourceMeta = {
    resolution,
    qualityTags,
    year,
    mediaType,
    rawTitle: t,
    size,
    codec,
    audio,
    subtitles,
    episodeInfo,
  };

  // 控制缓存大小（最多缓存 2000 条条目）
  if (metaCache.size > 2000) {
    metaCache.clear();
  }
  metaCache.set(cacheKey, result);

  return result;
}

/**
 * 判断单条资源是否符合全部筛选条件
 */
export function matchesFilter(
  meta: ParsedResourceMeta,
  filters: FilterState,
  platformKey: string
): boolean {
  // 1. 平台过滤
  if (filters.platform !== "all" && platformKey !== filters.platform) {
    return false;
  }

  // 2. 清晰度过滤
  if (filters.resolution !== "all" && meta.resolution !== filters.resolution) {
    return false;
  }

  // 3. 内容类型过滤
  if (filters.mediaType !== "all" && meta.mediaType !== filters.mediaType) {
    return false;
  }

  // 4. 特色画质过滤 (REMUX, 杜比, HDR)
  if (filters.specialQuality !== "all" && !meta.qualityTags.includes(filters.specialQuality)) {
    return false;
  }

  // 5. 年份区间过滤
  if (filters.yearRange !== "all") {
    if (!meta.year) return false;
    if (filters.yearRange === "2024-2025" && (meta.year < 2024 || meta.year > 2025)) return false;
    if (filters.yearRange === "2020-2023" && (meta.year < 2020 || meta.year > 2023)) return false;
    if (filters.yearRange === "2010-2019" && (meta.year < 2010 || meta.year > 2019)) return false;
    if (filters.yearRange === "2000-2009" && (meta.year < 2000 || meta.year > 2009)) return false;
    if (filters.yearRange === "before-2000" && meta.year >= 2000) return false;
  }

  return true;
}

/**
 * 排序权重辅助函数
 */
export function compareResources(a: any, b: any, sortBy: SortOption): number {
  const metaA = parseResourceMeta(a?.note || a?.url || "", a?.description);
  const metaB = parseResourceMeta(b?.note || b?.url || "", b?.description);

  if (sortBy === "quality-desc") {
    const qualityScore = (m: ParsedResourceMeta) => {
      let score = 0;
      if (m.resolution === "4K") score += 100;
      else if (m.resolution === "1080P") score += 50;
      else if (m.resolution === "720P") score += 20;

      if (m.qualityTags.includes("REMUX")) score += 30;
      if (m.qualityTags.includes("杜比视界")) score += 20;
      if (m.qualityTags.includes("HDR")) score += 10;
      return score;
    };
    const diff = qualityScore(metaB) - qualityScore(metaA);
    if (diff !== 0) return diff;
  } else if (sortBy === "year-desc") {
    const yA = metaA.year || 0;
    const yB = metaB.year || 0;
    if (yA !== yB) return yB - yA;
  } else if (sortBy === "year-asc") {
    const yA = metaA.year || 9999;
    const yB = metaB.year || 9999;
    if (yA !== yB) return yA - yB;
  }

  // 默认按收录时间最新在前
  const timeA = new Date(a?.datetime || "1970-01-01").getTime();
  const timeB = new Date(b?.datetime || "1970-01-01").getTime();
  return timeB - timeA;
}

/**
 * 默认筛选器初始值
 */
export function getDefaultFilterState(): FilterState {
  return {
    platform: "all",
    resolution: "all",
    mediaType: "all",
    yearRange: "all",
    specialQuality: "all",
    sortBy: "default",
  };
}
