// test/unit/storageResolver.test.ts
// 智能动态网盘驱动解析与 AList 路径智能匹配单元测试

import { describe, it, expect } from "vitest";
import { resolveNetdiskMountPath, NETDISK_RULES } from "../../utils/storageResolver";

describe("智能网盘挂载路径解析 (StorageResolver)", () => {
  const mockStorages = [
    { id: 1, mountPath: "/115网盘", driver: "115 Cloud", status: "work" },
    { id: 2, mountPath: "/夸克", driver: "QuarkTV", status: "work" },
    { id: 3, mountPath: "/百度", driver: "BaiduNetdisk", status: "work" },
    { id: 4, mountPath: "/迅雷", driver: "Thunder", status: "work" },
    { id: 5, mountPath: "/NAS本地盘", driver: "Local", status: "work" },
  ];

  it("迅雷网盘链接能够通过 driver 精准匹配到 /迅雷 (而非硬编码的 /迅雷网盘)", () => {
    const xunleiUrl = "https://pan.xunlei.com/s/VNz4YyL9GhykZ3tK4dEa4W_xA1?pwd=468y";
    const res = resolveNetdiskMountPath(xunleiUrl, mockStorages);

    expect(res.matched).toBe(true);
    expect(res.rule?.key).toBe("xunlei");
    expect(res.driver).toBe("Thunder");
    expect(res.targetPath).toBe("/迅雷");
    expect(res.strategy).toBe("driver_match");
  });

  it("百度网盘链接能够通过 driver 精准匹配到 /百度 (而非硬编码的 /百度网盘)", () => {
    const baiduUrl = "https://pan.baidu.com/s/1aBcDeFgHiJkLmNoPqRsTuV?pwd=8888";
    const res = resolveNetdiskMountPath(baiduUrl, mockStorages);

    expect(res.matched).toBe(true);
    expect(res.rule?.key).toBe("baidu");
    expect(res.driver).toBe("BaiduNetdisk");
    expect(res.targetPath).toBe("/百度");
    expect(res.strategy).toBe("driver_match");
  });

  it("夸克网盘链接能够通过 driver 精准匹配到 /夸克", () => {
    const quarkUrl = "https://pan.quark.cn/s/60abcde12345";
    const res = resolveNetdiskMountPath(quarkUrl, mockStorages);

    expect(res.matched).toBe(true);
    expect(res.rule?.key).toBe("quark");
    expect(res.driver).toBe("QuarkTV");
    expect(res.targetPath).toBe("/夸克");
    expect(res.strategy).toBe("driver_match");
  });

  it("115网盘链接能够通过 driver 精准匹配到 /115网盘", () => {
    const u115Url = "https://115.com/s/swn3abcde12?password=115";
    const res = resolveNetdiskMountPath(u115Url, mockStorages);

    expect(res.matched).toBe(true);
    expect(res.rule?.key).toBe("115");
    expect(res.driver).toBe("115 Cloud");
    expect(res.targetPath).toBe("/115网盘");
    expect(res.strategy).toBe("driver_match");
  });

  it("当用户自定义了挂载目录名时，能根据 driver 依然精准命中", () => {
    const customStorages = [
      { id: 10, mountPath: "/影视/ThunderVIP", driver: "Thunder", status: "work" },
    ];
    const xunleiUrl = "https://pan.xunlei.com/s/VMK234";
    const res = resolveNetdiskMountPath(xunleiUrl, customStorages);

    expect(res.matched).toBe(true);
    expect(res.targetPath).toBe("/影视/ThunderVIP");
    expect(res.strategy).toBe("driver_match");
  });

  it("当 driver 未匹配但 mountPath 含有关键词时，能够关键词模糊匹配", () => {
    const fuzzyStorages = [
      { id: 20, mountPath: "/我的迅雷电影", driver: "CustomDrive", status: "work" },
    ];
    const xunleiUrl = "https://pan.xunlei.com/s/VMK234";
    const res = resolveNetdiskMountPath(xunleiUrl, fuzzyStorages);

    expect(res.matched).toBe(true);
    expect(res.targetPath).toBe("/我的迅雷电影");
    expect(res.strategy).toBe("keyword_match");
  });

  it("当用户尚未在 AList 挂载对应网盘时，安全回退到推荐默认路径", () => {
    const otherStorages = [
      { id: 99, mountPath: "/NAS本地盘", driver: "Local", status: "work" },
    ];
    const xunleiUrl = "https://pan.xunlei.com/s/VMK234";
    const res = resolveNetdiskMountPath(xunleiUrl, otherStorages);

    expect(res.matched).toBe(true);
    expect(res.targetPath).toBe("/迅雷");
    expect(res.strategy).toBe("rule_fallback");
  });

  it("未知或非网盘 URL 返回根目录并标记未匹配", () => {
    const unknownUrl = "magnet:?xt=urn:btih:1234567890abcdef";
    const res = resolveNetdiskMountPath(unknownUrl, mockStorages);

    expect(res.matched).toBe(false);
    expect(res.targetPath).toBe("/");
    expect(res.strategy).toBe("root_fallback");
  });
});
