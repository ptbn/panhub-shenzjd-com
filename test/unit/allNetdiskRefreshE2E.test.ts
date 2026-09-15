// test/unit/allNetdiskRefreshE2E.test.ts
// 对用户当前账号关联的每一个类型云盘进行完整的穿透刷新与容错降级集成测试

import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveNetdiskMountPath } from "../../utils/storageResolver";
import { refreshAListPath, getAListStorages } from "../../server/core/nas/alistClient";

describe("全类型云盘【存入后穿透 AList】端到端集成测试", () => {
  // 实机导出的用户真实 AList 挂载配置
  const realUserStorages = [
    { id: 1, mountPath: "/115网盘", driver: "115 Cloud", status: "work" },
    { id: 2, mountPath: "/夸克", driver: "QuarkTV", status: "work" },
    { id: 3, mountPath: "/百度", driver: "BaiduNetdisk", status: "work" },
    { id: 4, mountPath: "/迅雷", driver: "Thunder", status: "work" },
    { id: 5, mountPath: "/NAS本地盘", driver: "Local", status: "work" },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. 115网盘 (115 Cloud) 穿透测试", () => {
    it("智能路径推导与 AList 穿透刷新成功", async () => {
      const u115Link = "https://115.com/s/swn3abcde12?password=115";
      const resolved = resolveNetdiskMountPath(u115Link, realUserStorages);
      expect(resolved.matched).toBe(true);
      expect(resolved.targetPath).toBe("/115网盘");
      expect(resolved.driver).toBe("115 Cloud");

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            message: "success",
            data: { total: 2, content: [{ name: "暗黑3破解.rar" }, { name: "辐射3相关.rar" }] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await refreshAListPath("https://alist.taogehome.cloud", "token", resolved.targetPath);
      expect(res.success).toBe(true);
      expect(res.total).toBe(2);
      expect(res.message).toContain("缓存已成功穿透刷新");
    });
  });

  describe("2. 夸克网盘 (QuarkTV) 穿透测试", () => {
    it("智能路径推导与 AList 穿透刷新成功", async () => {
      const quarkLink = "https://pan.quark.cn/s/c5f884bf6fa0";
      const resolved = resolveNetdiskMountPath(quarkLink, realUserStorages);
      expect(resolved.matched).toBe(true);
      expect(resolved.targetPath).toBe("/夸克");
      expect(resolved.driver).toBe("QuarkTV");

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            message: "success",
            data: { total: 3, content: [{ name: "来自：分享" }] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await refreshAListPath("https://alist.taogehome.cloud", "token", resolved.targetPath);
      expect(res.success).toBe(true);
      expect(res.total).toBe(3);
    });
  });

  describe("3. 百度网盘 (BaiduNetdisk) 穿透测试", () => {
    it("智能路径推导到 /百度 (而非硬编码的 /百度网盘) 且刷新成功", async () => {
      const baiduLink = "https://pan.baidu.com/s/1yZbCxWvU_tSrQpOnMlKj1A?pwd=6666";
      const resolved = resolveNetdiskMountPath(baiduLink, realUserStorages);
      expect(resolved.matched).toBe(true);
      expect(resolved.targetPath).toBe("/百度");
      expect(resolved.driver).toBe("BaiduNetdisk");

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            message: "success",
            data: { total: 5, content: [{ name: "apps" }] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await refreshAListPath("https://alist.taogehome.cloud", "token", resolved.targetPath);
      expect(res.success).toBe(true);
      expect(res.total).toBe(5);
    });
  });

  describe("4. 迅雷网盘 (Thunder) 穿透测试", () => {
    it("智能路径推导到 /迅雷 (彻底根除 rawPath: /迅雷网盘 报错) 且刷新成功", async () => {
      const xunleiLink = "https://pan.xunlei.com/s/VNz4YyL9GhykZ3tK4dEa4W_xA1?pwd=468y";
      const resolved = resolveNetdiskMountPath(xunleiLink, realUserStorages);
      expect(resolved.matched).toBe(true);
      expect(resolved.targetPath).toBe("/迅雷");
      expect(resolved.driver).toBe("Thunder");

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            message: "success",
            data: { total: 44, content: [{ name: "图吧工具箱" }] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await refreshAListPath("https://alist.taogehome.cloud", "token", resolved.targetPath);
      expect(res.success).toBe(true);
      expect(res.total).toBe(44);
    });
  });

  describe("5. NAS 本地盘 (Local) 穿透测试", () => {
    it("刷新绿联 NAS 本地影视盘目录缓存成功", async () => {
      const localPath = "/NAS本地盘";

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            message: "success",
            data: { total: 2, content: [{ name: "Rick and Morty.S09" }, { name: "怒火攻心" }] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await refreshAListPath("https://alist.taogehome.cloud", "token", localPath);
      expect(res.success).toBe(true);
      expect(res.total).toBe(2);
    });
  });

  describe("6. 未挂载云盘容错降级与错误清洗测试", () => {
    it("当访问未挂载的目录发生 storage not found 时，输出人性化信息且不暴露 rawPath 堆栈", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 500,
            message: "failed get storage: storage not found; rawPath: /阿里云盘",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await refreshAListPath("https://alist.taogehome.cloud", "token", "/阿里云盘");
      expect(res.success).toBe(false);
      expect(res.message).not.toContain("rawPath");
      expect(res.message).toContain("未在 AList 中检测到挂载目录 [/阿里云盘]");
    });
  });
});
