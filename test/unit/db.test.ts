import { describe, it, expect, beforeEach } from "vitest";
import { getMemoryDatabase } from "../../server/core/db/index";
import { hashPassword, generateSalt } from "../../server/core/db/crypto";

describe("Database Adapter 测试 (多租户、用户、邀请码、NAS Profile与审计)", () => {
  const db = getMemoryDatabase();

  beforeEach(() => {
    db.reset();
  });

  it("用户生命周期管理 (增删查改、状态与角色)", async () => {
    const salt = generateSalt();
    const hash = await hashPassword("pass123", salt);

    const user = await db.createUser({
      id: "u_1",
      email: "Admin@TaogeHome.Cloud",
      username: "涛哥",
      passwordHash: hash,
      passwordSalt: salt,
      role: "admin",
      status: "active",
    });

    expect(user.email).toBe("admin@taogehome.cloud"); // 规范化小写
    expect(user.role).toBe("admin");

    const found = await db.getUserByEmail("admin@taogehome.cloud");
    expect(found).toBeDefined();
    expect(found?.username).toBe("涛哥");

    // 冻结用户
    await db.updateUserStatus("u_1", "frozen");
    const frozen = await db.getUserById("u_1");
    expect(frozen?.status).toBe("frozen");

    // 统计
    const count = await db.countUsers();
    expect(count).toBe(1);
  });

  it("Session 生命周期 (创建、过期与自动销毁)", async () => {
    const session = await db.createSession("sess_abc123", "u_1", 1000);
    expect(session.userId).toBe("u_1");

    const fetched = await db.getSession("sess_abc123");
    expect(fetched?.token).toBe("sess_abc123");

    // 删除
    await db.deleteSession("sess_abc123");
    const empty = await db.getSession("sess_abc123");
    expect(empty).toBeNull();
  });

  it("一次性邀请码体系 (即发即废、作废机制)", async () => {
    const inv = await db.createInvite("A7K9X2P4", "u_admin");
    expect(inv.code).toBe("A7K9X2P4");
    expect(inv.usedBy).toBeNull();

    // 消费邀请码
    const success = await db.useInvite("a7k9x2p4", "u_guest");
    expect(success).toBe(true);

    // 再次消费应失败 (一次性)
    const duplicateUse = await db.useInvite("a7k9x2p4", "u_other");
    expect(duplicateUse).toBe(false);

    // 作废邀请码
    await db.createInvite("REVOKEME", "u_admin");
    await db.revokeInvite("REVOKEME");
    const revokedUse = await db.useInvite("REVOKEME", "u_someone");
    expect(revokedUse).toBe(false);
  });

  it("NAS Profile 保存与更新 (AList & Aria2 双驱动)", async () => {
    const profile = await db.upsertNasProfile({
      id: "prof_1",
      userId: "u_1",
      name: "绿联 DX4600 UGOS",
      isDefault: 1,
      cloudDriveEnabled: 1,
      alistUrl: "https://alist.taogehome.cloud",
      alistTokenEncrypted: "encrypted_token",
      alistDefaultPath: "/我的网盘/电影",
      torrentClientType: "aria2",
      torrentClientUrl: "https://aria2.taogehome.cloud/jsonrpc",
      torrentClientSecretEncrypted: "encrypted_secret",
      torrentDefaultDir: "/Media/Movies",
    });

    expect(profile.name).toBe("绿联 DX4600 UGOS");

    const fetched = await db.getNasProfile("u_1");
    expect(fetched?.alistDefaultPath).toBe("/我的网盘/电影");
    expect(fetched?.torrentDefaultDir).toBe("/Media/Movies");
  });

  it("推送审计日志记录与按用户查询", async () => {
    await db.createPushLog({
      userId: "u_1",
      username: "涛哥",
      title: "星际穿越 2160p Remux",
      url: "https://pan.quark.cn/s/123456",
      protocol: "alist",
      targetDevice: "绿联 DX4600",
      targetPath: "/Media/Movies",
      status: "success",
      message: "任务已送达 AList",
    });

    const logs = await db.listPushLogsByUser("u_1");
    expect(logs).toHaveLength(1);
    expect(logs[0].title).toBe("星际穿越 2160p Remux");
    expect(logs[0].status).toBe("success");
  });
});
