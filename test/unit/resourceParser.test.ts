import { describe, it, expect } from "vitest";
import {
  parseResourceMeta,
  matchesFilter,
  compareResources,
  getDefaultFilterState,
  getDynamicYearRanges,
} from "../../composables/useResourceParser";

describe("useResourceParser 智能特征解析引擎测试", () => {
  it("应准确识别 4K 原盘、HDR、杜比视界和 1994 年份", () => {
    const title = "肖申克的救赎.The.Shawshank.Redemption.1994.2160p.UHD.BluRay.x265.10bit.HDR.DTS-HD.MA.5.1-SWTYBLZ";
    const meta = parseResourceMeta(title);
    expect(meta.resolution).toBe("4K");
    expect(meta.year).toBe(1994);
    expect(meta.mediaType).toBe("movie");
    expect(meta.qualityTags).toContain("HDR");
    expect(meta.qualityTags).toContain("蓝光");
  });

  it("应准确识别电视剧集、2023年份和60帧", () => {
    const title = "[狂飙 全39集][2023][国语中字][4K 60帧][无水印收藏版]";
    const meta = parseResourceMeta(title);
    expect(meta.resolution).toBe("4K");
    expect(meta.year).toBe(2023);
    expect(meta.mediaType).toBe("tv");
    expect(meta.qualityTags).toContain("高帧率");
  });

  it("应准确识别动漫/番剧类型与1080P", () => {
    const title = "名侦探柯南 S01-S27 + 剧场版 1080P 高清 国日双语 简繁字幕";
    const meta = parseResourceMeta(title);
    expect(meta.resolution).toBe("1080P");
    expect(meta.mediaType).toBe("anime");
  });

  it("应准确识别纪录片与杜比视界", () => {
    const title = "地球脉动 第三季 Planet Earth III (2023) 4K HDR 杜比视界 6集全 纪录片";
    const meta = parseResourceMeta(title);
    expect(meta.resolution).toBe("4K");
    expect(meta.year).toBe(2023);
    expect(meta.mediaType).toBe("doc");
    expect(meta.qualityTags).toContain("杜比视界");
    expect(meta.qualityTags).toContain("HDR");
  });

  it("多维条件组合过滤逻辑断言", () => {
    const title = "阿凡达2.水之道.Avatar.The.Way.of.Water.2022.2160p.HDR.杜比视界";
    const meta = parseResourceMeta(title);

    const filter = getDefaultFilterState();
    expect(matchesFilter(meta, filter, "quark")).toBe(true);

    // 过滤清晰度：4K 应匹配，1080P 不匹配
    filter.resolution = "4K";
    expect(matchesFilter(meta, filter, "quark")).toBe(true);
    filter.resolution = "1080P";
    expect(matchesFilter(meta, filter, "quark")).toBe(false);

    // 过滤年份：2020-2023 应匹配，2026 不匹配
    filter.resolution = "all";
    filter.yearRange = "2020-2023";
    expect(matchesFilter(meta, filter, "quark")).toBe(true);
    filter.yearRange = "2022";
    expect(matchesFilter(meta, filter, "quark")).toBe(true);
    filter.yearRange = "2026";
    expect(matchesFilter(meta, filter, "quark")).toBe(false);

    // 过滤网盘
    filter.yearRange = "all";
    filter.platform = "aliyun";
    expect(matchesFilter(meta, filter, "quark")).toBe(false);
    expect(matchesFilter(meta, filter, "aliyun")).toBe(true);
  });

  it("动态年份生成器应返回包含当前年份的选项", () => {
    const options = getDynamicYearRanges();
    const currentYear = String(new Date().getFullYear());
    expect(options[0].key).toBe(currentYear);
    expect(options[0].label).toContain(currentYear);
    expect(options.some(o => o.key === "before-2000")).toBe(true);
  });

  it("清晰度优先排序逻辑测试", () => {
    const item1080 = { note: "流浪地球 1080P 高清", datetime: "2024-01-01" };
    const item4K = { note: "流浪地球 4K 2160p 原盘", datetime: "2023-01-01" };
    const sorted = [item1080, item4K].sort((a, b) => compareResources(a, b, "quality-desc"));
    expect(sorted[0].note).toContain("4K");
  });

  it("深度解析体积大小、编码格式、杜比音轨、字幕与集数", () => {
    const title = "流浪地球2.The.Wandering.Earth.II.2023.2160p.UHD.BluRay.x265.10bit.HDR.DDP5.1.Atmos-SWTYBLZ [45.2GB]";
    const meta = parseResourceMeta(title);
    expect(meta.resolution).toBe("4K");
    expect(meta.size).toBe("45.2GB");
    expect(meta.codec).toBe("H.265/HEVC");
    expect(meta.audio).toBe("Dolby Atmos");
  });

  it("当标题简短时，可从 description 补充解析画质与参数", () => {
    const title = "【夸克网盘】流浪地球2";
    const desc = "4K 60FPS 杜比视界 蓝光原盘 国粤双语 中英双字 65GB";
    const meta = parseResourceMeta(title, desc);
    expect(meta.resolution).toBe("4K");
    expect(meta.qualityTags).toContain("杜比视界");
    expect(meta.qualityTags).toContain("蓝光");
    expect(meta.audio).toBe("国粤双语");
    expect(meta.subtitles).toBe("中英双字");
    expect(meta.size).toBe("65GB");
  });
});
