import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateNasTargetUrl } from "../../server/core/nas/ssrfGuard";
import {
  testAListConnection,
  addAListOfflineDownload,
  getAListStorages,
  refreshAListPath,
} from "../../server/core/nas/alistClient";
import { testAria2Connection, addAria2Uri } from "../../server/core/nas/aria2Client";
import { testQBittorrentConnection, addQBittorrentTorrent } from "../../server/core/nas/qbittorrentClient";
import { dispatchPushTask, isCloudDriveUrl } from "../../server/core/nas/dispatcher";
import { encryptCredential } from "../../server/core/db/crypto";
import { getMemoryDatabase } from "../../server/core/db/index";
import type { NasProfileRecord } from "../../server/core/db/types";

describe("NAS Drivers & SSRF Security 模块测试", () => {
  const masterSecret = "test-master-secret-key-2026";
  const db = getMemoryDatabase();

  beforeEach(() => {
    vi.restoreAllMocks();
    db.reset();
  });

  describe("SSRF 物理级门禁防御", () => {
    it("放行正规公网及 Cloudflare Tunnel 域名", () => {
      const res1 = validateNasTargetUrl("https://alist.taogehome.cloud");
      expect(res1.valid).toBe(true);

      const res2 = validateNasTargetUrl("https://aria2.taogehome.cloud/jsonrpc");
      expect(res2.valid).toBe(true);
    });

    it("坚决拦截私有与保留内网 IP (Fail-Closed)", () => {
      expect(validateNasTargetUrl("http://127.0.0.1:5244").valid).toBe(false);
      expect(validateNasTargetUrl("http://localhost:6800").valid).toBe(false);
      expect(validateNasTargetUrl("http://10.0.0.5:8080").valid).toBe(false);
      expect(validateNasTargetUrl("http://192.168.31.1").valid).toBe(false);
      expect(validateNasTargetUrl("http://172.20.0.2").valid).toBe(false);
      expect(validateNasTargetUrl("http://169.254.169.254/latest/meta-data/").valid).toBe(false);
    });

    it("拒绝非法及危险协议 (file://, ftp://, gopher://)", () => {
      expect(validateNasTargetUrl("file:///etc/passwd").valid).toBe(false);
      expect(validateNasTargetUrl("ftp://1.2.3.4").valid).toBe(false);
      expect(validateNasTargetUrl("gopher://1.2.3.4").valid).toBe(false);
    });
  });

  describe("AList REST API 客户端", () => {
    it("测试连通性 (成功与失败状态处理)", async () => {
      // Mock AList /api/me 成功响应
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 200, message: "success", data: { username: "admin" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const res = await testAListConnection("https://alist.taogehome.cloud", "my-token");
      expect(res.success).toBe(true);
      expect(res.username).toBe("admin");
    });

    it("提交离线转存任务", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 200, message: "success", data: { tasks: [{ id: "task_9988" }] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const res = await addAListOfflineDownload(
        "https://alist.taogehome.cloud",
        "my-token",
        "https://pan.quark.cn/s/abcdef123456",
        "/我的网盘/电影"
      );
      expect(res.success).toBe(true);
      expect(res.taskId).toBe("task_9988");
    });

    it("拉取已挂载的全部云存储驱动列表及状态", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            message: "success",
            data: {
              content: [
                { id: 1, mount_path: "/115网盘", driver: "115 Cloud", status: "work", webdav_policy: "302_redirect" },
                { id: 2, mount_path: "/夸克", driver: "QuarkTV", status: "work", webdav_policy: "302_redirect" },
                { id: 5, mount_path: "/NAS本地盘", driver: "Local", status: "work", webdav_policy: "native_proxy" },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await getAListStorages("https://alist.taogehome.cloud", "my-token");
      expect(res.success).toBe(true);
      expect(res.storages?.length).toBe(3);
      expect(res.storages?.[0].mountPath).toBe("/115网盘");
      expect(res.storages?.[0].status).toBe("work");
    });

    it("主动穿透刷新 AList 目录缓存", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            message: "success",
            data: { total: 12 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await refreshAListPath("https://alist.taogehome.cloud", "my-token", "/115网盘");
      expect(res.success).toBe(true);
      expect(res.total).toBe(12);
      expect(res.message).toContain("缓存已成功穿透刷新");
    });

    it("当 AList 目录不存在返回 storage not found 时，输出人性化指引避免 rawPath 裸露", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 500,
            message: "failed get storage: storage not found; rawPath: /迅雷网盘",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await refreshAListPath("https://alist.taogehome.cloud", "my-token", "/迅雷网盘");
      expect(res.success).toBe(false);
      expect(res.message).not.toContain("rawPath");
      expect(res.message).toContain("未在 AList 中检测到挂载目录");
      expect(res.message).toContain("/迅雷网盘");
    });
  });

  describe("Aria2 JSON-RPC 客户端", () => {
    it("连通性与版本探测", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ jsonrpc: "2.0", id: "panhub_ping", result: { version: "1.36.0" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const res = await testAria2Connection("https://aria2.taogehome.cloud/jsonrpc", "rpc-secret");
      expect(res.success).toBe(true);
      expect(res.version).toBe("1.36.0");
    });

    it("添加磁力离线任务", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ jsonrpc: "2.0", id: "123", result: "2089b05ecca3d829" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const res = await addAria2Uri(
        "https://aria2.taogehome.cloud/jsonrpc",
        "rpc-secret",
        ["magnet:?xt=urn:btih:abcdef1234567890"],
        "/Media/Movies"
      );
      expect(res.success).toBe(true);
      expect(res.gid).toBe("2089b05ecca3d829");
    });
  });

  describe("多协议调度引擎 Dispatcher", () => {
    it("网盘链接自动路由至 AList 并推导绿联云影院 Movies 目录", async () => {
      const encryptedToken = await encryptCredential("alist_secret_token", masterSecret);
      const profile: NasProfileRecord = {
        id: "p1",
        userId: "u1",
        name: "绿联 DX4600 UGOS",
        isDefault: 1,
        cloudDriveEnabled: 1,
        alistUrl: "https://alist.taogehome.cloud",
        alistTokenEncrypted: encryptedToken,
        alistDefaultPath: "/我的网盘",
        torrentClientType: "aria2",
        torrentClientUrl: "https://aria2.taogehome.cloud/jsonrpc",
        torrentClientSecretEncrypted: "",
        torrentDefaultDir: "/Media",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 200, message: "success", data: { tasks: [{ id: "t1" }] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const pushRes = await dispatchPushTask(
        profile,
        {
          title: "奥本海默 4K 原盘",
          url: "https://pan.quark.cn/s/abcdef",
          category: "movie",
        },
        masterSecret,
        db,
        "涛哥"
      );

      expect(pushRes.success).toBe(true);
      expect(pushRes.protocol).toBe("alist");
      expect(pushRes.targetPath).toBe("/我的网盘/电影");

      // 验证已落盘审计日志
      const logs = await db.listPushLogsByUser("u1");
      expect(logs).toHaveLength(1);
      expect(logs[0].title).toBe("奥本海默 4K 原盘");
      expect(logs[0].protocol).toBe("alist");
    });

    it("磁力链接自动路由至 Aria2 并推导绿联云影院 TV 剧集目录", async () => {
      const encryptedSecret = await encryptCredential("aria2_secret", masterSecret);
      const profile: NasProfileRecord = {
        id: "p1",
        userId: "u1",
        name: "绿联 DX4600 UGOS",
        isDefault: 1,
        cloudDriveEnabled: 1,
        alistUrl: "https://alist.taogehome.cloud",
        alistTokenEncrypted: "",
        alistDefaultPath: "/我的网盘",
        torrentClientType: "aria2",
        torrentClientUrl: "https://aria2.taogehome.cloud/jsonrpc",
        torrentClientSecretEncrypted: encryptedSecret,
        torrentDefaultDir: "/Media",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ jsonrpc: "2.0", id: "1", result: "gid_8888" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const pushRes = await dispatchPushTask(
        profile,
        {
          title: "绝命毒师 全五季 1080p",
          url: "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567",
          category: "tv",
        },
        masterSecret,
        db,
        "涛哥"
      );

      expect(pushRes.success).toBe(true);
      expect(pushRes.protocol).toBe("aria2");
      expect(pushRes.targetPath).toBe("/Media/TV");

      const logs = await db.listPushLogsByUser("u1");
      expect(logs).toHaveLength(1);
      expect(logs[0].title).toBe("绝命毒师 全五季 1080p");
      expect(logs[0].protocol).toBe("aria2");
    });

    it("磁力链接在未配置独立 qB 域名时，自动通过已绑定的 AList 以 tool: qBittorrent 安全下发", async () => {
      const profile: NasProfileRecord = {
        id: "p2",
        userId: "u2",
        name: "绿联 DX4600 (方案 A 局域网闭环)",
        isDefault: 1,
        cloudDriveEnabled: 1,
        alistUrl: "https://alist.taogehome.cloud",
        alistTokenEncrypted: "",
        alistDefaultPath: "/NAS本地盘",
        torrentClientType: "qbittorrent",
        torrentClientUrl: "", // 未配置独立公网域名
        torrentClientSecretEncrypted: "",
        torrentDefaultDir: "/NAS本地盘/电影",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Mock AList /api/fs/add_offline_download 响应
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            message: "success",
            data: { tasks: [{ id: "qbit_task_999" }] },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );

      const pushRes = await dispatchPushTask(
        profile,
        {
          title: "肖申克的救赎 4K Remux",
          url: "magnet:?xt=urn:btih:abcdef1234567890abcdef1234567890abcdef12",
          category: "movie",
          preferredClient: "qbittorrent",
        },
        masterSecret,
        db,
        "涛哥"
      );

      expect(pushRes.success).toBe(true);
      expect(pushRes.protocol).toBe("qbittorrent");
      expect(pushRes.targetPath).toBe("/NAS本地盘/电影");

      // 验证调用的 AList 接口载荷中 tool 必须为 "qBittorrent"
      expect(fetchSpy).toHaveBeenCalled();
      const lastCall = fetchSpy.mock.calls[0];
      expect(lastCall[0]).toBe("https://alist.taogehome.cloud/api/fs/add_offline_download");
      const requestBody = JSON.parse((lastCall[1] as any).body);
      expect(requestBody.tool).toBe("qBittorrent");
      expect(requestBody.urls[0]).toBe("magnet:?xt=urn:btih:abcdef1234567890abcdef1234567890abcdef12");

      // 验证审计日志
      const logs = await db.listPushLogsByUser("u2");
      expect(logs).toHaveLength(1);
      expect(logs[0].title).toBe("肖申克的救赎 4K Remux");
      expect(logs[0].protocol).toBe("qbittorrent");
    });
  });
});
