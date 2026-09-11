import { describe, it, expect } from "vitest";
import { getOrCreateSearchService } from "../../server/core/services/index";

describe("BT扩充端到端检索与安全整合测试", () => {
  const service = getOrCreateSearchService({
    defaultConcurrency: 4,
    pluginTimeoutMs: 3500,
    cacheEnabled: false,
    cacheTtlMinutes: 10,
  });

  it("中文电影检索（星际穿越）应通过中英元数据映射调出全球优质磁力", async () => {
    const { response } = await service.searchWithWarnings(
      "星际穿越",
      undefined,
      4,
      false,
      "merged_by_type",
      "plugin",
      undefined,
      undefined,
      {},
      undefined
    );

    expect(response.merged_by_type).toBeDefined();
    const magnets = response.merged_by_type?.magnet || [];
    expect(magnets.length).toBeGreaterThan(0);

    // 校验磁力特征
    const first = magnets[0];
    expect(first.url.toLowerCase()).toContain("magnet:?xt=urn:btih:");
    // 应当包含 1080p 或 2160p 或 4K 或 BluRay
    const hasHd = magnets.some(
      (m) =>
        /1080p|2160p|4k|bluray|remux/i.test(m.note) ||
        /1080p|2160p|4k|bluray|remux/i.test(m.description || "")
    );
    expect(hasHd).toBe(true);
  }, 15000);

  it("动漫番剧检索（鬼灭之刃）应能调出正规字幕组分流磁力", async () => {
    const { response } = await service.searchWithWarnings(
      "鬼灭之刃",
      undefined,
      4,
      false,
      "merged_by_type",
      "plugin",
      undefined,
      undefined,
      {},
      undefined
    );

    expect(response.merged_by_type).toBeDefined();
    const magnets = response.merged_by_type?.magnet || [];
    expect(magnets.length).toBeGreaterThan(0);

    const first = magnets[0];
    expect(first.url.toLowerCase()).toContain("magnet:?xt=urn:btih:");
  }, 25000);

  it("所有输出的磁力链接均需通过安全门禁（严禁包含可执行文件木马）", async () => {
    const { response } = await service.searchWithWarnings(
      "星际穿越",
      undefined,
      4,
      false,
      "merged_by_type",
      "plugin",
      undefined,
      undefined,
      {},
      undefined
    );

    const magnets = response.merged_by_type?.magnet || [];
    for (const item of magnets) {
      const fullText = `${item.note || ""} ${item.description || ""}`;
      expect(fullText).not.toMatch(/\.(exe|scr|bat|apk|vbs|msi|lnk|jar)(\.|\s|$)/i);
      expect(fullText).not.toMatch(/(澳门新葡京|现金棋牌|官方直营|真人荷官)/);
    }
  }, 15000);
});
