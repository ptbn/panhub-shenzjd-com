// test/unit/nasShareMount.test.ts
// 方案 A：AList 动态分享挂载与多用户隔离单测套件

import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseShareInfo, mountAListShare } from "../../server/core/nas/alistClient";

describe("方案 A：AList 动态分享挂载 (Share Mount) 驱动测试", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("网盘分享链接智能解析 (parseShareInfo)", () => {
    it("正确解析 115 网盘分享链接与密码", () => {
      const info1 = parseShareInfo("https://115.com/s/sw3h8j802ka?password=abcd");
      expect(info1.supported).toBe(true);
      expect(info1.driverName).toBe("115 Share");
      expect(info1.shareCode).toBe("sw3h8j802ka");
      expect(info1.receiveCode).toBe("abcd");
      expect(info1.addition.share_code).toBe("sw3h8j802ka");

      // 分开传密码
      const info2 = parseShareInfo("https://115.com/s/sw3h8j802ka", "pass123");
      expect(info2.receiveCode).toBe("pass123");
    });

    it("正确解析 百度网盘 分享链接与提取码", () => {
      const info1 = parseShareInfo("https://pan.baidu.com/s/1sKkZ88-Abcd99?pwd=k8j2");
      expect(info1.supported).toBe(true);
      expect(info1.driverName).toBe("BaiduShare");
      expect(info1.addition.surl).toBe("sKkZ88-Abcd99");
      expect(info1.addition.pwd).toBe("k8j2");
    });

    it("正确解析 阿里云盘 / Alipan 分享链接与提取码", () => {
      const info1 = parseShareInfo("https://www.alipan.com/s/9Bka87sHkz?pwd=ali8");
      expect(info1.supported).toBe(true);
      expect(info1.driverName).toBe("AliyundriveShare");
      expect(info1.addition.share_id).toBe("9Bka87sHkz");
      expect(info1.addition.share_pwd).toBe("ali8");
    });

    it("正确解析 123 云盘 分享链接与提取码", () => {
      const info1 = parseShareInfo("https://www.123pan.com/s/AbCd-XyZ?pwd=1234");
      expect(info1.supported).toBe(true);
      expect(info1.driverName).toBe("123PanShare");
      expect(info1.addition.sharekey).toBe("AbCd-XyZ");
      expect(info1.addition.sharepassword).toBe("1234");
    });

    it("夸克网盘识别为需转存驱动，提供明确原因", () => {
      const info = parseShareInfo("https://pan.quark.cn/s/982a17cb4fa2");
      expect(info.supported).toBe(false);
      expect(info.driverName).toBe("Quark");
      expect(info.reason).toContain("需转存至个人网盘");
    });

    it("非法或未知网盘链接返回不支持状态", () => {
      const info = parseShareInfo("https://example.com/invalid/link");
      expect(info.supported).toBe(false);
      expect(info.driverName).toBe("Unknown");
    });
  });

  describe("mountAListShare 动态挂载调度链路", () => {
    it("SSRF 拦截内网 AList 地址", async () => {
      const res = await mountAListShare(
        "http://192.168.1.1:5244",
        "token",
        "https://pan.baidu.com/s/1xyz?pwd=1234",
        "",
        "/twisper/影视/测试"
      );
      expect(res.success).toBe(false);
      expect(res.message).toContain("SSRF 防御拦截");
    });

    it("夸克链接被友好拦截并返回提示", async () => {
      const res = await mountAListShare(
        "https://alist.taogehome.cloud",
        "token",
        "https://pan.quark.cn/s/abcdef",
        "",
        "/twisper/影视/测试"
      );
      expect(res.success).toBe(false);
      expect(res.message).toContain("需转存至个人网盘");
    });

    it("百度网盘分享链接动态创建挂载点成功并获取媒体文件列表", async () => {
      vi.spyOn(globalThis, "fetch")
        // 1. getAListStorages (storage/list) -> 返回空列表
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ code: 200, message: "success", data: { content: [] } }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
        // 2. storage/create -> 返回 200 成功
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ code: 200, message: "success", data: { id: 88 } }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
        // 3. refreshAListPath (fs/list with refresh) -> 返回 200
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ code: 200, message: "success", data: { total: 1 } }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
        // 4. 列出挂载目录下媒体文件 (fs/list) -> 返回文件
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              code: 200,
              message: "success",
              data: {
                content: [
                  { name: "Interstellar.2014.2160p.mkv", size: 28492048291, is_dir: false },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );

      const res = await mountAListShare(
        "https://alist.taogehome.cloud",
        "token-123",
        "https://pan.baidu.com/s/1abc-xyz?pwd=8888",
        "",
        "/twisper/影视挂载/星际穿越"
      );

      expect(res.success).toBe(true);
      expect(res.driver).toBe("BaiduShare");
      expect(res.mountPath).toBe("/twisper/影视挂载/星际穿越");
      expect(res.webdavUrl).toBe("https://alist.taogehome.cloud/dav/twisper/影视挂载/星际穿越");
      expect(res.alistPlayUrl).toBe("https://alist.taogehome.cloud/twisper/影视挂载/星际穿越");
      expect(res.files?.length).toBe(1);
      expect(res.files?.[0].name).toBe("Interstellar.2014.2160p.mkv");
    });

    it("同名挂载点已存在时，自动调用 storage/update 更新配置", async () => {
      vi.spyOn(globalThis, "fetch")
        // 1. getAListStorages -> 已存在 mountPath: /twisper/影视挂载/星际穿越, id: 99
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              code: 200,
              message: "success",
              data: {
                content: [
                  { id: 99, mount_path: "/twisper/影视挂载/星际穿越", driver: "BaiduShare", status: "work" },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
        // 2. storage/update -> 返回 200
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ code: 200, message: "success" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
        // 3. refresh
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ code: 200, message: "success", data: { total: 0 } }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
        // 4. fs/list
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ code: 200, message: "success", data: { content: [] } }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );

      const res = await mountAListShare(
        "https://alist.taogehome.cloud",
        "token-123",
        "https://pan.baidu.com/s/1abc-xyz?pwd=8888",
        "",
        "/twisper/影视挂载/星际穿越"
      );

      expect(res.success).toBe(true);
      expect(res.mountPath).toBe("/twisper/影视挂载/星际穿越");
    });

    it("当百度分享因 errno: 2 初始化失败且创建了残存存储时，自动清理僵尸存储并友好提示", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch")
        // 1. getAListStorages (初始检查，无旧挂载)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ code: 200, message: "success", data: { content: [] } }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
        // 2. storage/create 失败但 AList 报 failed init storage but storage is already created
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              code: 500,
              message: 'failed init storage but storage is already created: failed init storage: 200 OK; {"errno":2,"data":{"list":[]}}',
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
        // 3. getAListStorages (清理时重新检查，发现刚才创建的残留 storage ID 101)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              code: 200,
              message: "success",
              data: {
                content: [
                  { id: 101, mount_path: "/twisper/影视挂载/失败资源", driver: "BaiduShare" },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
        // 4. storage/delete?id=101 -> 成功清理
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ code: 200, message: "success" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );

      const res = await mountAListShare(
        "https://alist.taogehome.cloud",
        "token-123",
        "https://pan.baidu.com/s/1invalid-link?pwd=wrong",
        "",
        "/twisper/影视挂载/失败资源"
      );

      expect(res.success).toBe(false);
      expect(res.message).toContain("百度网盘接口提示【errno: 2 参数错误/资源失效】");
      expect(res.message).toContain("已自动为您清理失败的挂载点");

      // 断言调用了删除接口清理残留
      const deleteCall = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes("/api/admin/storage/delete?id=101")
      );
      expect(deleteCall).toBeDefined();
    });
  });
});
