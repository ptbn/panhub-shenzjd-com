// test/unit/pushDrawerRendering.test.ts
// 针对前端各类网盘的能力分流与界面响应逻辑进行全量状态机断言

import { describe, it, expect } from "vitest";
import { resolveNetdiskMountPath } from "../../utils/storageResolver";

describe("PushDrawer 前端状态机与能力分流断言", () => {
  const realUserStorages = [
    { id: 1, mountPath: "/115网盘", driver: "115 Cloud", status: "work" },
    { id: 2, mountPath: "/夸克", driver: "QuarkTV", status: "work" },
    { id: 3, mountPath: "/百度", driver: "BaiduNetdisk", status: "work" },
    { id: 4, mountPath: "/迅雷", driver: "Thunder", status: "work" },
    { id: 5, mountPath: "/NAS本地盘", driver: "Local", status: "work" },
  ];

  // 模拟 PushDrawer 内部核心计算属性
  function computeDrawerState(itemUrl: string) {
    const isCloud = /quark\.cn|aliyundrive\.com|alipan\.com|pan\.baidu\.com|123pan\.com|115\.com|pan\.xunlei\.com|drive\.uc\.cn/i.test(
      itemUrl
    );
    const canShareMount = /115\.com\/s|pan\.baidu\.com\/s|alipan\.com\/s|aliyundrive\.com\/s|123pan\.com\/s/i.test(
      itemUrl.toLowerCase()
    );
    const resolved = resolveNetdiskMountPath(itemUrl, realUserStorages);
    const detectedNetdiskName = resolved.rule?.name || "网盘资源";
    const resolvedAlistPath = resolved.matched ? resolved.targetPath : "";

    return {
      isCloud,
      canShareMount,
      scheme: canShareMount ? "A" : "B",
      detectedNetdiskName,
      resolvedAlistPath,
      buttonText: canShareMount
        ? "⚡ 一键挂载到 AList (芝杜秒播)"
        : `🔄 ② 存入后穿透刷新 AList [${resolvedAlistPath}]`,
    };
  }

  it("迅雷网盘链接准确分流至方案 B，按钮显示包含 [/迅雷] 真实挂载点", () => {
    const state = computeDrawerState("https://pan.xunlei.com/s/VNz4YyL9GhykZ3tK4dEa4W_xA1?pwd=468y");
    expect(state.isCloud).toBe(true);
    expect(state.canShareMount).toBe(false);
    expect(state.scheme).toBe("B");
    expect(state.detectedNetdiskName).toBe("迅雷网盘");
    expect(state.resolvedAlistPath).toBe("/迅雷");
    expect(state.buttonText).toBe("🔄 ② 存入后穿透刷新 AList [/迅雷]");
  });

  it("夸克网盘链接准确分流至方案 B，按钮显示包含 [/夸克] 真实挂载点", () => {
    const state = computeDrawerState("https://pan.quark.cn/s/c5f884bf6fa0");
    expect(state.isCloud).toBe(true);
    expect(state.canShareMount).toBe(false);
    expect(state.scheme).toBe("B");
    expect(state.detectedNetdiskName).toBe("夸克网盘");
    expect(state.resolvedAlistPath).toBe("/夸克");
    expect(state.buttonText).toBe("🔄 ② 存入后穿透刷新 AList [/夸克]");
  });

  it("百度网盘分享链接准确分流至方案 A，提供一键动态免转存挂载能力", () => {
    const state = computeDrawerState("https://pan.baidu.com/s/1yZbCxWvU_tSrQpOnMlKj1A?pwd=6666");
    expect(state.isCloud).toBe(true);
    expect(state.canShareMount).toBe(true);
    expect(state.scheme).toBe("A");
    expect(state.detectedNetdiskName).toBe("百度网盘");
    expect(state.resolvedAlistPath).toBe("/百度");
    expect(state.buttonText).toBe("⚡ 一键挂载到 AList (芝杜秒播)");
  });

  it("115网盘分享链接准确分流至方案 A，提供一键动态免转存挂载能力", () => {
    const state = computeDrawerState("https://115.com/s/swn3abcde12?password=115");
    expect(state.isCloud).toBe(true);
    expect(state.canShareMount).toBe(true);
    expect(state.scheme).toBe("A");
    expect(state.detectedNetdiskName).toBe("115网盘");
    expect(state.resolvedAlistPath).toBe("/115网盘");
    expect(state.buttonText).toBe("⚡ 一键挂载到 AList (芝杜秒播)");
  });

  it("磁力链接准确识别为非网盘，分流至 NAS 下载器调度面板", () => {
    const state = computeDrawerState("magnet:?xt=urn:btih:3fa85f64cb2820a174092b23a9d70df81e3a1f7e");
    expect(state.isCloud).toBe(false);
    expect(state.canShareMount).toBe(false);
  });

  describe("动态落盘与转存目录推导 (彻底杜绝 /我的网盘 假目录)", () => {
    function computeTargetDir(
      itemUrl: string,
      category: "movie" | "tv" | "anime" | "other",
      userDefaultPath?: string
    ): string {
      const isCloud = /quark\.cn|aliyundrive\.com|alipan\.com|pan\.baidu\.com|123pan\.com|115\.com|pan\.xunlei\.com|drive\.uc\.cn/i.test(itemUrl);
      const sub = category === "movie" ? "电影" : category === "tv" ? "电视剧" : category === "anime" ? "动漫" : "其他";
      const enSub = category === "movie" ? "Movies" : category === "tv" ? "TV" : category === "anime" ? "Anime" : "Downloads";

      if (isCloud) {
        const resolved = resolveNetdiskMountPath(itemUrl, realUserStorages);
        let cloudRoot = "";
        if (
          resolved.matched &&
          (resolved.strategy === "driver_match" || resolved.strategy === "keyword_match")
        ) {
          cloudRoot = resolved.targetPath;
        }
        if (!cloudRoot) {
          cloudRoot =
            userDefaultPath &&
            userDefaultPath !== "/我的影视挂载" &&
            userDefaultPath !== "/我的网盘/电影"
              ? userDefaultPath
              : "/NAS本地盘";
        }
        if (cloudRoot && cloudRoot !== "/") {
          return `${cloudRoot.replace(/\/+$/, "")}/${sub}`;
        }
        return `/${sub}`;
      }
      return `/Media/${enSub}`;
    }

    it("迅雷网盘电影资源自动精准对齐至实机 [/迅雷/电影]", () => {
      const dir = computeTargetDir("https://pan.xunlei.com/s/VNz4YyL9GhykZ3tK4dEa4W_xA1", "movie");
      expect(dir).toBe("/迅雷/电影");
      expect(dir).not.toContain("我的网盘");
    });

    it("夸克网盘电视剧资源自动精准对齐至实机 [/夸克/电视剧]", () => {
      const dir = computeTargetDir("https://pan.quark.cn/s/c5f884bf6fa0", "tv");
      expect(dir).toBe("/夸克/电视剧");
      expect(dir).not.toContain("我的网盘");
    });

    it("百度网盘动漫资源自动精准对齐至实机 [/百度/动漫]", () => {
      const dir = computeTargetDir("https://pan.baidu.com/s/1yZbCxWvU_tSrQpOnMlKj1A", "anime");
      expect(dir).toBe("/百度/动漫");
      expect(dir).not.toContain("我的网盘");
    });

    it("115网盘电影资源自动精准对齐至实机 [/115网盘/电影]", () => {
      const dir = computeTargetDir("https://115.com/s/swn3abcde12", "movie");
      expect(dir).toBe("/115网盘/电影");
      expect(dir).not.toContain("我的网盘");
    });

    it("未挂载于 AList 的网盘资源自动纠偏并降级至实机 [/NAS本地盘/电影]，绝不抛出 storage not found", () => {
      const dir = computeTargetDir("https://drive.uc.cn/s/unknown_movie_123", "movie", "/我的影视挂载");
      expect(dir).toBe("/NAS本地盘/电影");
      expect(dir).not.toContain("我的影视挂载");
      expect(dir).not.toContain("我的网盘");
    });
  });
});
