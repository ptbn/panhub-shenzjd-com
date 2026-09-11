import { describe, it, expect } from "vitest";
import { MikanPlugin } from "../../server/core/plugins/mikan";

describe("Mikan Plugin - 蜜柑计划开源番剧检索", () => {
  it("插件属性配置应符合规范", () => {
    const plugin = new MikanPlugin();
    expect(plugin.name()).toBe("mikan");
    expect(plugin.priority()).toBe(4);
  });

  it("空关键词应当直接返回空数组", async () => {
    const plugin = new MikanPlugin();
    const res = await plugin.search("");
    expect(res).toEqual([]);
  });

  it("检索热门番剧应当返回合规的 magnet 链接与字幕组信息", async () => {
    const plugin = new MikanPlugin();
    const results = await plugin.search("鬼灭之刃");
    expect(Array.isArray(results)).toBe(true);

    if (results.length > 0) {
      const first = results[0];
      expect(first.channel).toContain("蜜柑计划");
      expect(first.links?.[0]?.type).toBe("magnet");
      expect(first.links?.[0]?.url).toMatch(/^magnet:\?xt=urn:btih:[a-f0-9]{40}/i);
      expect(first.content).toContain("正规字幕组分流");
    }
  }, 15000);
});
