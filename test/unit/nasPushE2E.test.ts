import { describe, it, expect, beforeEach, vi } from "vitest";
import { getMemoryDatabase } from "../../server/core/db/index";
import { registerUser, loginUser } from "../../server/core/services/authService";
import { createInviteCode } from "../../server/core/services/inviteService";
import { encryptCredential } from "../../server/core/db/crypto";
import { dispatchPushTask } from "../../server/core/nas/dispatcher";

describe("PanHub 私有云中枢与 NAS 离线推送全链路 E2E 闭环测试", () => {
  const db = getMemoryDatabase();
  const masterSecret = "e2e-master-secret-taogehome-2026";

  beforeEach(() => {
    db.reset();
    vi.restoreAllMocks();
  });

  it("完整的端到端全业务链路：自举Admin -> 生成邀请码 -> 用户注册 -> 绑定绿联DX4600 -> 网盘转存推送 -> 磁力推送联动影院 -> 管理后台全局审计与广播", async () => {
    // -------------------------------------------------------------
    // Step 1: 初始空库，首位注册自举为系统超级管理员
    // -------------------------------------------------------------
    const adminRes = await registerUser(
      {
        email: "taoge@taogehome.cloud",
        username: "涛哥",
        password: "AdminSuperSecretPassword123!",
      },
      db
    );
    expect(adminRes.user.role).toBe("admin");
    expect(adminRes.session.token).toBeDefined();

    // -------------------------------------------------------------
    // Step 2: 超级管理员在后台生成 8 位一次性专属邀请码
    // -------------------------------------------------------------
    const invite = await createInviteCode(adminRes.user.id, db);
    expect(invite.code).toHaveLength(8);
    expect(invite.usedBy).toBeNull();

    // -------------------------------------------------------------
    // Step 3: 好友/家庭成员使用该邀请码注册新账号
    // -------------------------------------------------------------
    const userRes = await registerUser(
      {
        email: "family@taogehome.cloud",
        username: "家庭成员",
        password: "FamilyPassword123!",
        inviteCode: invite.code,
      },
      db
    );
    expect(userRes.user.role).toBe("user");
    expect(userRes.session.token).toBeDefined();

    // 验证邀请码已被消耗，再次使用必须被拒绝
    await expect(
      registerUser(
        {
          email: "stranger@taogehome.cloud",
          username: "陌生人",
          password: "Password123!",
          inviteCode: invite.code,
        },
        db
      )
    ).rejects.toThrow("邀请码无效、已过期或已被使用");

    // -------------------------------------------------------------
    // Step 4: 用户在【我的 NAS】中配置绑定的绿联 DX4600 设备 (UGOS)
    // -------------------------------------------------------------
    const rawAlistToken = "dx4600-alist-auth-token-xyz";
    const rawAria2Secret = "dx4600-aria2-rpc-secret-123";

    const encAlistToken = await encryptCredential(rawAlistToken, masterSecret);
    const encAria2Secret = await encryptCredential(rawAria2Secret, masterSecret);

    const profile = await db.upsertNasProfile({
      id: `nas_${userRes.user.id}`,
      userId: userRes.user.id,
      name: "客厅绿联 DX4600 (UGOS)",
      isDefault: 1,
      cloudDriveEnabled: 1,
      alistUrl: "https://alist.taogehome.cloud",
      alistTokenEncrypted: encAlistToken,
      alistDefaultPath: "/我的网盘/电影",
      torrentClientType: "aria2",
      torrentClientUrl: "https://aria2.taogehome.cloud/jsonrpc",
      torrentClientSecretEncrypted: encAria2Secret,
      torrentDefaultDir: "/Media/Movies",
    });
    expect(profile.name).toBe("客厅绿联 DX4600 (UGOS)");

    // -------------------------------------------------------------
    // Step 5: 用户搜到夸克网盘电影，点击【推送到 NAS】(AList 驱动)
    // -------------------------------------------------------------
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 200, message: "success", data: { tasks: [{ id: "alist_task_1001" }] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const alistPush = await dispatchPushTask(
      profile,
      {
        title: "流浪地球 2 (2023) 4K 杜比视界高码版",
        url: "https://pan.quark.cn/s/66778899aabb",
        category: "movie",
      },
      masterSecret,
      db,
      userRes.user.username
    );

    expect(alistPush.success).toBe(true);
    expect(alistPush.protocol).toBe("alist");
    expect(alistPush.taskId).toBe("alist_task_1001");
    expect(alistPush.targetPath).toBe("/我的网盘/电影");

    // -------------------------------------------------------------
    // Step 6: 用户搜到磁力电视剧，点击【推送到 NAS】(Aria2 驱动联动绿联云影院 TV 目录)
    // -------------------------------------------------------------
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: "aria2_req_1", result: "gid_dx4600_9988" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const aria2Push = await dispatchPushTask(
      profile,
      {
        title: "三体 (电视剧) 4K 全 30 集",
        url: "magnet:?xt=urn:btih:fedcba9876543210fedcba9876543210fedcba98",
        category: "tv",
      },
      masterSecret,
      db,
      userRes.user.username
    );

    expect(aria2Push.success).toBe(true);
    expect(aria2Push.protocol).toBe("aria2");
    expect(aria2Push.taskId).toBe("gid_dx4600_9988");
    expect(aria2Push.targetPath).toBe("/Media/TV");

    // -------------------------------------------------------------
    // Step 7: 超级管理员控制台审计与全站广播
    // -------------------------------------------------------------
    // 7.1 管理员查验全站推送日志
    const allLogs = await db.listAllPushLogs(10);
    expect(allLogs).toHaveLength(2);
    expect(allLogs[0].title).toBe("三体 (电视剧) 4K 全 30 集");
    expect(allLogs[0].protocol).toBe("aria2");
    expect(allLogs[0].targetDevice).toBe("客厅绿联 DX4600 (UGOS)");
    expect(allLogs[1].title).toBe("流浪地球 2 (2023) 4K 杜比视界高码版");
    expect(allLogs[1].protocol).toBe("alist");

    // 7.2 管理员查验用户列表并验证凭据脱敏安全
    const users = await db.listUsers();
    expect(users).toHaveLength(2);
    // 普通用户的凭据在数据库中是加密密文，零明文泄露
    const userProfile = await db.getNasProfile(userRes.user.id);
    expect(userProfile?.alistTokenEncrypted).not.toContain(rawAlistToken);
    expect(userProfile?.torrentClientSecretEncrypted).not.toContain(rawAria2Secret);

    // 7.3 管理员发布全站维护广播通知
    await db.setAnnouncement("温馨提示：绿联 DX4600 今晚凌晨将进行 UGOS 固件安全升级，请合理安排下载任务。", true);
    const ann = await db.getAnnouncement();
    expect(ann?.enabled).toBe(1);
    expect(ann?.content).toContain("绿联 DX4600 今晚凌晨将进行 UGOS 固件安全升级");
  });
});
