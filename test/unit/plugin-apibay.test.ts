import { describe, it, expect } from "vitest";
import { ApiBayPlugin } from "../../server/core/plugins/apibay";

describe("ApiBay Plugin - 全球开源 BT 检索", () => {
  it("插件属性配置应符合规范", () => {
    const plugin = new ApiBayPlugin();
    expect(plugin.name()).toBe("apibay");
    expect(plugin.priority()).toBe(4);
  });

  it("空关键词应当直接返回空数组", async () => {
    const plugin = new ApiBayPlugin();
    const res = await plugin.search("");
    expect(res).toEqual([]);
  });

  it("检索常见热门电影应当返回合规的 magnet 链接与健康度信息", async () => {
    const plugin = new ApiBayPlugin();
    const results = await plugin.search("Interstellar");
    expect(Array.isArray(results)).toBe(true);

    if (results.length > 0) {
      const first = results[0];
      expect(first.channel).toContain("ApiBay");
      expect(first.links?.[0]?.type).toBe("magnet");
      expect(first.links?.[0]?.url).toMatch(/^magnet:\?xt=urn:btih:[a-f0-9]{40}/i);
      expect(first.content).toContain("做种");
    }
  }, 15000);
});
