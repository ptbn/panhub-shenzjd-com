import { describe, it, expect } from "vitest";
import { resolveEnglishTitle } from "../../server/core/utils/queryExpansion";

describe("元数据智能对齐引擎 - queryExpansion", () => {
  it("纯英文或数字应当直接跳过（返回 null），无需多余解析", async () => {
    expect(await resolveEnglishTitle("Interstellar")).toBeNull();
    expect(await resolveEnglishTitle("2024")).toBeNull();
    expect(await resolveEnglishTitle("   ")).toBeNull();
  });

  it("常见中文热门电影应能正确解析出对应的原版英文名与年份", async () => {
    const meta = await resolveEnglishTitle("星际穿越");
    expect(meta).not.toBeNull();
    expect(meta?.originalTitle?.toLowerCase()).toContain("interstellar");
    expect(meta?.year).toBe("2014");
  });

  it("多次查询相同词应当命中内存缓存", async () => {
    const start = Date.now();
    const meta1 = await resolveEnglishTitle("奥本海默");
    const mid = Date.now();
    const meta2 = await resolveEnglishTitle("奥本海默");
    const end = Date.now();

    expect(meta1).not.toBeNull();
    expect(meta2).toEqual(meta1);
    // 第二次缓存命中耗时应当极短 (< 5ms)
    expect(end - mid).toBeLessThan(10);
  });
});
