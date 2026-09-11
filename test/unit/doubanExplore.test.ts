import { describe, it, expect, beforeEach } from "vitest";
import {
  buildDoubanExploreUrl,
  exploreCache,
  type DoubanExploreQuery,
} from "../../server/core/services/doubanExploreService";

describe("DoubanExploreService - 影视多维探索服务", () => {
  beforeEach(() => {
    // 清空测试缓存
    (exploreCache as any).store.clear();
  });

  it("默认参数应该正确生成探索 URL", () => {
    const url = buildDoubanExploreUrl({});
    expect(url).toContain("https://movie.douban.com/j/new_search_subjects");
    expect(url).toContain("sort=U");
    expect(url).toContain("range=0%2C10");
    expect(url).toContain("start=0");
    expect(url).toContain("limit=20");
    expect(url).not.toContain("tags=");
  });

  it("多维组合参数应该正确映射 tags 与 range", () => {
    const query: DoubanExploreQuery = {
      type: "电视剧",
      genre: "悬疑",
      yearRange: "2020-2023",
      scoreRange: "8-10",
      sort: "S",
      page: 2,
      limit: 15,
    };
    const url = buildDoubanExploreUrl(query);
    const decoded = decodeURIComponent(url);

    expect(decoded).toContain("tags=电视剧,悬疑");
    expect(decoded).toContain("year_range=2020,2023");
    expect(decoded).toContain("range=8,10");
    expect(decoded).toContain("sort=S");
    expect(decoded).toContain("start=15");
    expect(decoded).toContain("limit=15");
  });

  it("单一类型与高分神作参数映射", () => {
    const query: DoubanExploreQuery = {
      type: "电影",
      genre: "all",
      scoreRange: "9-10",
      yearRange: "all",
    };
    const url = buildDoubanExploreUrl(query);
    const decoded = decodeURIComponent(url);

    expect(decoded).toContain("tags=电影");
    expect(decoded).toContain("range=9,10");
    expect(decoded).not.toContain("year_range=");
  });

  it("年代区间映射（经典老片 before-2000）", () => {
    const query: DoubanExploreQuery = {
      yearRange: "before-2000",
    };
    const url = buildDoubanExploreUrl(query);
    const decoded = decodeURIComponent(url);

    expect(decoded).toContain("year_range=1920,1999");
  });

  it("动态单一年份应映射为相同起止年份 (如 2026 -> 2026,2026)", () => {
    const query: DoubanExploreQuery = {
      yearRange: "2026",
    };
    const url = buildDoubanExploreUrl(query);
    const decoded = decodeURIComponent(url);

    expect(decoded).toContain("year_range=2026,2026");
  });

  it("内存缓存功能应正常存储与读取", () => {
    const cacheKey = "douban-explore:test";
    const dummyData = {
      items: [
        {
          id: "123",
          title: "星际穿越",
          rate: "9.4",
          cover: "https://example.com/cover.jpg",
          url: "https://movie.douban.com/subject/123/",
          directors: ["诺兰"],
          casts: ["马修"],
        },
      ],
      hasMore: true,
      page: 1,
      limit: 20,
      query: {},
    };

    exploreCache.set(cacheKey, dummyData, 60000);
    const cached = exploreCache.get(cacheKey);

    expect(cached.hit).toBe(true);
    expect(cached.value?.items[0].title).toBe("星际穿越");
  });
});
