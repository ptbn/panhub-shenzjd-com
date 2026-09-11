import { describe, it, expect } from "vitest";
import { YtsPlugin, buildYtsMagnet } from "../../server/core/plugins/yts";

describe("YTS Plugin - 电影BT磁力检索", () => {
  it("应当正确根据 Hash 和标题组装 Magnet 链接", () => {
    const hash = "3b10b06b986b245a4a58b2cdfe42a6327b7f8c14";
    const title = "Interstellar.2014.1080p";
    const magnet = buildYtsMagnet(hash, title);

    expect(magnet).toContain("magnet:?xt=urn:btih:3b10b06b986b245a4a58b2cdfe42a6327b7f8c14");
    expect(magnet).toContain("dn=Interstellar.2014.1080p");
    expect(magnet).toContain("tr=");
  });

  it("空关键词或过短字符应当直接返回空数组", async () => {
    const plugin = new YtsPlugin();
    const res1 = await plugin.search("");
    const res2 = await plugin.search("a");

    expect(res1).toEqual([]);
    expect(res2).toEqual([]);
  });

  it("插件属性配置应符合规范", () => {
    const plugin = new YtsPlugin();
    expect(plugin.name()).toBe("yts");
    expect(plugin.priority()).toBe(5);
  });
});
