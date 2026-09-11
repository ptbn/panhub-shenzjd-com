import { describe, expect, it } from "vitest";
import { rankAndFilterSearchResults, tokenizeText } from "../../server/core/utils/searchRelevance";
import type { SearchResult } from "../../server/core/types/models";

function makeResult(id: string, title: string, content: string = "", datetime: string = "2026-01-01"): SearchResult {
  return {
    message_id: id,
    unique_id: id,
    channel: "test",
    datetime,
    title,
    content,
    links: [{ type: "quark", url: `https://pan.quark.cn/s/${id}`, password: "" }],
  };
}

describe("searchRelevance MiniSearch BM25 检索评分与过滤", () => {
  it("中文与多语言分词正常运作", () => {
    const tokens = tokenizeText("哈利波特与魔法石 4K REMUX");
    expect(tokens).toContain("哈利");
    expect(tokens).toContain("波特");
    expect(tokens).toContain("魔法");
    expect(tokens).toContain("石");
    expect(tokens).not.toContain("与"); // 停用词被过滤
  });

  it("精准命中排在首位，大包合集保留，无关蹭词条目被剔除", () => {
    const input: SearchResult[] = [
      makeResult("1", "好莱坞俗套大吐槽 (2021) 魔法与奇迹", "冷门纪录片", "2026-01-05"),
      makeResult("2", "哈利波特全集 1-8部 4K Remux", "华纳经典合集", "2026-01-02"),
      makeResult("3", "哈利波特与魔法石 2001 4K HDR BluRay", "第1部", "2026-01-01"),
      makeResult("4", "黑暗侵袭 1-2部 1080P", "恐怖片", "2026-01-04"),
    ];

    const ranked = rankAndFilterSearchResults(input, "哈利波特与魔法石");

    // 黑暗侵袭和好莱坞俗套大吐槽（只蹭了“魔法”单个词）被滤掉
    const titles = ranked.map((r) => r.title);
    expect(titles).not.toContain("黑暗侵袭 1-2部 1080P");
    expect(titles).not.toContain("好莱坞俗套大吐槽 (2021) 魔法与奇迹");

    // 哈利波特与魔法石 精准匹配应排在最前
    expect(titles[0]).toBe("哈利波特与魔法石 2001 4K HDR BluRay");
    // 哈利波特全集 也应当被保留
    expect(titles).toContain("哈利波特全集 1-8部 4K Remux");
  });

  it("单字符搜索跳过强过滤", () => {
    const input: SearchResult[] = [
      makeResult("1", "好莱坞俗套大吐槽", "", "2026-01-01"),
      makeResult("2", "流浪地球2", "", "2026-01-02"),
    ];
    const ranked = rankAndFilterSearchResults(input, "1");
    expect(ranked).toHaveLength(2);
  });
});
