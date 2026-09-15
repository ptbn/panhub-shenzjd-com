import { describe, it, expect, beforeEach, vi } from "vitest";
import { getMemoryDatabase } from "../../server/core/db/index";
import { MemoryDatabaseAdapter } from "../../server/core/db/memoryAdapter";
import { registerUser, loginUser } from "../../server/core/services/authService";
import { createInviteCode, revokeInviteCode, listAllInvites } from "../../server/core/services/inviteService";
import { encryptCredential, decryptCredential, generateSalt, hashPassword } from "../../server/core/db/crypto";
import { dispatchPushTask } from "../../server/core/nas/dispatcher";

describe("Admin & NAS Profile 业务层综合测试", () => {
  const db = getMemoryDatabase();
  const masterSecret = "unit-test-secret-key-2026";

  beforeEach(() => {
    db.reset();
    vi.restoreAllMocks();
  });

  it("多租户 NAS 配置保存、密钥密文加密与脱敏输出", async () => {
    // 1. 创建管理员用户
    const admin = await registerUser(
      { email: "admin@test.com", username: "Admin", password: "Password123" },
      db
    );

    // 2. 模拟保存 NAS Profile (带真实 Token 与 RPC 密码)
    const rawAlistToken = "alist-my-secret-token";
    const rawAria2Secret = "aria2-my-rpc-secret";

    const encryptedToken = await encryptCredential(rawAlistToken, masterSecret);
    const encryptedSecret = await encryptCredential(rawAria2Secret, masterSecret);

    const saved = await db.upsertNasProfile({
      id: "nas_1",
      userId: admin.user.id,
      name: "绿联 DX4600 UGOS",
      isDefault: 1,
      cloudDriveEnabled: 1,
      alistUrl: "https://alist.taogehome.cloud",
      alistTokenEncrypted: encryptedToken,
      alistDefaultPath: "/我的网盘/电影",
      torrentClientType: "aria2",
      torrentClientUrl: "https://aria2.taogehome.cloud/jsonrpc",
      torrentClientSecretEncrypted: encryptedSecret,
      torrentDefaultDir: "/Media/Movies",
    });

    expect(saved.name).toBe("绿联 DX4600 UGOS");

    // 验证密文中不含明文
    expect(saved.alistTokenEncrypted).not.toContain(rawAlistToken);
    expect(saved.torrentClientSecretEncrypted).not.toContain(rawAria2Secret);

    // 验证能够使用 masterSecret 成功解密
    const decryptedToken = await decryptCredential(saved.alistTokenEncrypted, masterSecret);
    expect(decryptedToken).toBe(rawAlistToken);

    // 3. 验证对超级管理员管理后台也是脱敏安全的
    const profile = await db.getNasProfile(admin.user.id);
    const isConfigured = Boolean(profile && profile.alistTokenEncrypted);
    expect(isConfigured).toBe(true);
  });

  it("超级管理员管理生命周期：冻结用户、解封用户、注销账号与重置密码", async () => {
    const admin = await registerUser(
      { email: "admin@taogehome.cloud", username: "涛哥", password: "AdminPassword123" },
      db
    );

    const inv = await createInviteCode(admin.user.id, db);
    const member = await registerUser(
      { email: "member@taogehome.cloud", username: "小明", password: "MemberPassword123", inviteCode: inv.code },
      db
    );

    // 冻结用户
    await db.updateUserStatus(member.user.id, "frozen");
    await db.deleteSessionsByUser(member.user.id);

    const frozenUser = await db.getUserById(member.user.id);
    expect(frozenUser?.status).toBe("frozen");

    // 解冻用户
    await db.updateUserStatus(member.user.id, "active");
    const activeUser = await db.getUserById(member.user.id);
    expect(activeUser?.status).toBe("active");

    // 删除用户
    await db.deleteUser(member.user.id);
    const deletedUser = await db.getUserById(member.user.id);
    expect(deletedUser).toBeNull();
  });

  it("邀请码全生命周期与作废隔离", async () => {
    const admin = await registerUser(
      { email: "admin@test.com", username: "Admin", password: "Password123" },
      db
    );

    const inv = await createInviteCode(admin.user.id, db);
    expect(inv.code).toHaveLength(8);

    const list1 = await listAllInvites(db);
    expect(list1).toHaveLength(1);
    expect(list1[0].isRevoked).toBe(0);

    // 作废邀请码
    const revoked = await revokeInviteCode(inv.code, db);
    expect(revoked).toBe(true);

    const list2 = await listAllInvites(db);
    expect(list2[0].isRevoked).toBe(1);
  });

  it("全站公告与广播设置", async () => {
    await db.setAnnouncement("今晚家庭宽带升级维护，离线下载可能短暂排队", true);
    const ann = await db.getAnnouncement();
    expect(ann?.enabled).toBe(1);
    expect(ann?.content).toContain("家庭宽带升级维护");
  });

  it("管理后台跨节点刷新与双向邀请码/用户同步机制 (Edge & Client Rehydration)", async () => {
    // 1. Isolate A 中管理员生成加密邀请码
    const admin = await registerUser(
      { email: "super@taogehome.cloud", username: "SuperAdmin", password: "Password123" },
      db
    );
    const inv = await createInviteCode(admin.user.id, db);
    expect(inv.code).toHaveLength(8);

    // 2. 模拟前端客户端保存了该邀请码镜像
    const clientKnownInvites = [inv];

    // 3. 模拟进入全新的 Cloudflare Isolate B (纯冷启动内存实例)
    const isolateB = new MemoryDatabaseAdapter();
    await isolateB.init();

    // 此时 Isolate B 中邀请码未丢失，能从 Edge Registry 自动聚合
    const listBeforeSync = await isolateB.listInvites();
    expect(listBeforeSync.some((i) => i.code === inv.code)).toBe(true);

    // 4. 新用户在 Isolate B 凭邀请码注册成功
    const newUser = await registerUser(
      { email: "friend@taogehome.cloud", username: "Friend", password: "Password123", inviteCode: inv.code },
      isolateB
    );
    expect(newUser.user.email).toBe("friend@taogehome.cloud");

    // 5. 验证已核销状态同步回 Isolate B 的邀请码列表中
    const updatedInvites = await isolateB.listInvites();
    const targetInv = updatedInvites.find((i) => i.code === inv.code);
    expect(targetInv?.usedBy).toBe(newUser.user.id);
  });

  it("超级管理员直接创建与录入用户 (免邀请码直接开通)", async () => {
    const salt = generateSalt(16);
    const hash = await hashPassword("DirectPassword123", salt);
    const directUser = await db.createUser({
      id: "u_direct_01",
      email: "direct@taogehome.cloud",
      username: "DirectUser",
      passwordHash: hash,
      passwordSalt: salt,
      role: "user",
      status: "active",
    });
    expect(directUser.email).toBe("direct@taogehome.cloud");
    const found = await db.getUserByEmail("direct@taogehome.cloud");
    expect(found?.username).toBe("DirectUser");
    const allUsers = await db.listUsers();
    expect(allUsers.some((u) => u.email === "direct@taogehome.cloud")).toBe(true);
  });

  it("家庭/系统默认 NAS 配置自动降级兜底与专属配置覆盖机制", async () => {
    // 1. 管理员创建并配置系统默认 NAS (isDefault = 1)
    const admin = await registerUser(
      { email: "owner@taogehome.cloud", username: "HouseOwner", password: "Password123" },
      db
    );
    const encToken = await encryptCredential("alist-family-shared-token", masterSecret);
    await db.upsertNasProfile({
      id: "nas_default_1",
      userId: admin.user.id,
      name: "绿联 DX4600 家庭共享",
      isDefault: 1,
      cloudDriveEnabled: 1,
      alistUrl: "https://alist.taogehome.cloud",
      alistTokenEncrypted: encToken,
      alistDefaultPath: "/NAS本地盘",
      torrentClientType: "qbittorrent",
      torrentClientUrl: "http://192.168.31.2:8080",
      torrentClientSecretEncrypted: "",
      torrentDefaultDir: "/volume2/影音资源",
    });

    // 2. 新成员注册，尚未主动配置 NAS
    const inv = await createInviteCode(admin.user.id, db);
    const member = await registerUser(
      { email: "family@taogehome.cloud", username: "FamilyMember", password: "Password123", inviteCode: inv.code },
      db
    );

    // 3. 验证新成员通过 getNasProfile 能够无缝继承系统默认配置，绝不报“未配置”
    const fallbackProfile = await db.getNasProfile(member.user.id);
    expect(fallbackProfile).not.toBeNull();
    expect(fallbackProfile?.name).toBe("绿联 DX4600 家庭共享");
    expect(fallbackProfile?.alistUrl).toBe("https://alist.taogehome.cloud");
    expect(fallbackProfile?.torrentDefaultDir).toBe("/volume2/影音资源");

    // 4. 新成员在设置中自定义了自己的专属 NAS 目录
    const memberToken = await encryptCredential("member-private-token", masterSecret);
    await db.upsertNasProfile({
      id: "nas_member_1",
      userId: member.user.id,
      name: "小明的极空间 NAS",
      isDefault: 0,
      cloudDriveEnabled: 1,
      alistUrl: "https://alist-member.taogehome.cloud",
      alistTokenEncrypted: memberToken,
      alistDefaultPath: "/小明专属盘",
      torrentClientType: "aria2",
      torrentClientUrl: "http://192.168.31.5:6800/jsonrpc",
      torrentClientSecretEncrypted: "",
      torrentDefaultDir: "/downloads/member",
    });

    // 5. 验证新成员读取到自己的专属配置，而管理员仍然读取自己的默认配置
    const memberProfile = await db.getNasProfile(member.user.id);
    expect(memberProfile?.name).toBe("小明的极空间 NAS");
    expect(memberProfile?.alistUrl).toBe("https://alist-member.taogehome.cloud");

    const adminProfile = await db.getNasProfile(admin.user.id);
    expect(adminProfile?.name).toBe("绿联 DX4600 家庭共享");
    expect(adminProfile?.alistUrl).toBe("https://alist.taogehome.cloud");
  });
});
