import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getQBittorrentTorrents,
  controlQBittorrentTorrents,
  type QBittorrentTorrentItem,
} from "../../server/core/nas/qbittorrentClient";

describe("qBittorrent 状态与控制客户端单元测试 (SSOT 单一事实来源)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("当 qBittorrent 成功返回种子列表时，应正确解析并返回", async () => {
    const mockTorrents: QBittorrentTorrentItem[] = [
      {
        hash: "dc36bc7e6dd458a4298651450d35737256632dbd",
        name: "[DBD-Raws][4K_HDR][奥本海默][IMAX版][2160P]",
        size: 10292315086,
        progress: 0.45,
        dlspeed: 12500000,
        upspeed: 120000,
        eta: 360,
        state: "downloading",
        num_seeds: 18,
        num_leechs: 4,
        ratio: 0.1,
        save_path: "/data/nas_storage/temp/qBittorrent/xxx",
        added_on: 1789461000,
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/v2/auth/login")) {
        return {
          ok: true,
          status: 200,
          headers: { get: (name: string) => (name.toLowerCase() === "set-cookie" ? "QBT_SID=mock_sid_123" : null) },
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => mockTorrents,
      };
    }) as any;

    const res = await getQBittorrentTorrents("http://192.168.1.110:8080", "admin", "pwd", undefined, true);


    expect(res.success).toBe(true);
    expect(res.torrents.length).toBe(1);
    expect(res.torrents[0].name).toContain("奥本海默");
    expect(res.torrents[0].progress).toBe(0.45);
    expect(res.torrents[0].state).toBe("downloading");
  });

  it("当 qBittorrent 响应错误状态码时，应平滑返回错误信息而不是抛出未捕获异常", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
    } as any);

    const res = await getQBittorrentTorrents("http://192.168.1.110:8080", undefined, undefined, undefined, true);

    expect(res.success).toBe(false);
    expect(res.torrents).toEqual([]);
    expect(res.message).toContain("502");
  });

  it("controlQBittorrentTorrents 应正确组装暂停、恢复与删除参数", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as any);
    globalThis.fetch = fetchSpy;

    // 测试暂停
    const pauseRes = await controlQBittorrentTorrents(
      "http://192.168.1.110:8080",
      "pause",
      ["hash1", "hash2"],
      false,
      undefined,
      undefined,
      true
    );
    expect(pauseRes.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://192.168.1.110:8080/api/v2/torrents/pause",
      expect.objectContaining({
        method: "POST",
        body: "hashes=hash1%7Chash2",
      })
    );

    // 测试删除带本地文件
    await controlQBittorrentTorrents(
      "http://192.168.1.110:8080",
      "delete",
      ["hash1"],
      true,
      undefined,
      undefined,
      true
    );
    expect(fetchSpy).toHaveBeenLastCalledWith(
      "http://192.168.1.110:8080/api/v2/torrents/delete",
      expect.objectContaining({
        method: "POST",
        body: "hashes=hash1&deleteFiles=true",
      })
    );
  });
});
