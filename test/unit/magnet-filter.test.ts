/**
 * 磁力链接支持与安全门禁测试
 * 验证：
 * 1. 正常磁力资源在 merged_by_type 与 results 模式下均能被正确收录至 magnet 分类；
 * 2. 伪装木马恶意后缀（.exe, .bat, .scr 等）被安全门禁拦截剔除；
 * 3. 常见博彩诈骗垃圾信息被安全门禁拦截剔除。
 */
import { describe, expect, it } from "vitest";
import { SearchService, isSafeResource } from "../../server/core/services/searchService";
import { BaseAsyncPlugin, PluginManager } from "../../server/core/plugins/manager";
import type { SearchResult } from "../../server/core/types/models";

// 纯种子站风格：结果包含正常磁力链接
class MagnetOnlyPlugin extends BaseAsyncPlugin {
  override async search(): Promise<SearchResult[]> {
    return [
      {
        message_id: "m1",
        unique_id: "magnet-only-1",
        channel: "seed",
        datetime: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        title: "测试 纯种子资源 1080p BluRay",
        content: "做种: 100",
        links: [{ type: "magnet", url: "magnet:?xt=urn:btih:abc123", password: "" }],
      },
    ];
  }
}

// 混合风格：同一条结果里既有网盘又有磁力链接
class MixedPlugin extends BaseAsyncPlugin {
  override async search(): Promise<SearchResult[]> {
    return [
      {
        message_id: "mx1",
        unique_id: "mixed-1",
        channel: "mixed",
        datetime: new Date("2026-01-02T00:00:00.000Z").toISOString(),
        title: "测试 混合资源",
        content: "",
        links: [
          { type: "quark", url: "https://pan.quark.cn/s/abc", password: "1234" },
          { type: "magnet", url: "magnet:?xt=urn:btih:def456", password: "" },
        ],
      },
    ];
  }
}

// 上游把磁力 URL 标成其他 type 的场景（应自动校正归入 magnet）
class MislabeledPlugin extends BaseAsyncPlugin {
  override async search(): Promise<SearchResult[]> {
    return [
      {
        message_id: "ml1",
        unique_id: "mislabeled-1",
        channel: "mislabeled",
        datetime: new Date("2026-01-03T00:00:00.000Z").toISOString(),
        title: "测试 错误标注为 others 的磁力",
        content: "",
        links: [
          { type: "others", url: "magnet:?xt=urn:btih:deadbeef", password: "" },
        ],
      },
    ];
  }
}

// 恶意伪装木马种子
class MalwarePlugin extends BaseAsyncPlugin {
  override async search(): Promise<SearchResult[]> {
    return [
      {
        message_id: "mal1",
        unique_id: "malware-1",
        channel: "fake",
        datetime: new Date("2026-01-05T00:00:00.000Z").toISOString(),
        title: "测试 最新热门大片高清完整版.mp4.exe",
        content: "解压执行观看",
        links: [{ type: "magnet", url: "magnet:?xt=urn:btih:malwarehash", password: "" }],
      },
      {
        message_id: "mal2",
        unique_id: "malware-2",
        channel: "fake",
        datetime: new Date("2026-01-05T00:00:00.000Z").toISOString(),
        title: "测试 澳门新葡京官方直营真人荷官现金棋牌",
        content: "注册送彩金",
        links: [{ type: "magnet", url: "magnet:?xt=urn:btih:spamhash", password: "" }],
      },
    ];
  }
}

function createService(plugins: BaseAsyncPlugin[]) {
  const manager = new PluginManager();
  for (const plugin of plugins) manager.registerPlugin(plugin);
  return new SearchService(
    {
      priorityChannels: [],
      defaultChannels: [],
      defaultConcurrency: 2,
      pluginTimeoutMs: 100,
      cacheEnabled: false,
      cacheTtlMinutes: 1,
    },
    manager
  );
}

describe("搜索结果融合磁力链接与安全防护", () => {
  it("merged_by_type 模式：正常磁力资源应正确归入 magnet 分组", async () => {
    const svc = createService([new MagnetOnlyPlugin("magnet-only", 1)]);
    const { response } = await svc.searchWithWarnings(
      "测试",
      undefined,
      undefined,
      false,
      "merged_by_type",
      "plugin",
      undefined,
      undefined,
      {},
      undefined
    );
    expect(response.merged_by_type).toBeDefined();
    expect(response.merged_by_type!.magnet).toHaveLength(1);
    expect(response.merged_by_type!.magnet[0].url).toBe("magnet:?xt=urn:btih:abc123");
    expect(response.total).toBe(1);
  });

  it("merged_by_type 模式：混合结果应同时保留网盘与磁力", async () => {
    const svc = createService([new MixedPlugin("mixed", 1)]);
    const { response } = await svc.searchWithWarnings(
      "测试",
      undefined,
      undefined,
      false,
      "merged_by_type",
      "plugin",
      undefined,
      undefined,
      {},
      undefined
    );
    const merged = response.merged_by_type!;
    expect(merged.quark).toHaveLength(1);
    expect(merged.quark![0].url).toBe("https://pan.quark.cn/s/abc");
    expect(merged.magnet).toHaveLength(1);
    expect(merged.magnet![0].url).toBe("magnet:?xt=urn:btih:def456");
  });

  it("url 以 magnet: 开头即使 type 标错也应自动校正归入 magnet", async () => {
    const svc = createService([new MislabeledPlugin("mislabeled", 1)]);
    const { response } = await svc.searchWithWarnings(
      "测试",
      undefined,
      undefined,
      false,
      "merged_by_type",
      "plugin",
      undefined,
      undefined,
      {},
      undefined
    );
    expect(response.merged_by_type!.magnet).toHaveLength(1);
    expect(response.merged_by_type!.magnet[0].url).toBe("magnet:?xt=urn:btih:deadbeef");
  });

  it("安全门禁：伪装木马 (.exe / .bat) 及博彩垃圾种子应被物理剔除", async () => {
    const svc = createService([new MalwarePlugin("malware", 1)]);
    const { response } = await svc.searchWithWarnings(
      "测试",
      undefined,
      undefined,
      false,
      "merged_by_type",
      "plugin",
      undefined,
      undefined,
      {},
      undefined
    );
    expect(response.total).toBe(0);
    expect(response.merged_by_type?.magnet).toBeUndefined();

    // 单独校验 isSafeResource 规则
    expect(isSafeResource({ title: "大片.mp4.exe", links: [] } as any)).toBe(false);
    expect(isSafeResource({ title: "播放器.scr", links: [] } as any)).toBe(false);
    expect(isSafeResource({ title: "澳门新葡京官方直营", links: [] } as any)).toBe(false);
    expect(isSafeResource({ title: "Interstellar.2014.1080p.mkv", links: [] } as any)).toBe(true);
  });
});
