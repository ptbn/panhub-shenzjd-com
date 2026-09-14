import { describe, it, expect, beforeEach } from "vitest";
import { getMemoryDatabase } from "../../server/core/db/index";
import { MemoryDatabaseAdapter } from "../../server/core/db/memoryAdapter";
import {
  registerUser,
  loginUser,
  validateSession,
  logoutUser,
  isBootstrapMode,
} from "../../server/core/services/authService";
import { createInviteCode } from "../../server/core/services/inviteService";

describe("Auth & Invite Service 测试 (封闭准入、自举Admin与一次性邀请码)", () => {
  const db = getMemoryDatabase();

  beforeEach(() => {
    db.reset();
  });

  it("初始为空库时，isBootstrapMode 为 true", async () => {
    expect(await isBootstrapMode(db)).toBe(true);
  });

  it("首位注册用户自举为超级管理员 (Admin)，且无需邀请码", async () => {
    const res = await registerUser(
      {
        email: "Taoge@TaogeHome.Cloud",
        username: "涛哥",
        password: "SuperSecretPassword123",
      },
      db
    );

    expect(res.user.role).toBe("admin");
    expect(res.user.email).toBe("taoge@taogehome.cloud");
    expect(res.session.token).toBeDefined();

    // 注册后不再是自举模式
    expect(await isBootstrapMode(db)).toBe(false);
  });

  it("次席用户无邀请码注册必须失败", async () => {
    // 先注册首位管理员
    await registerUser(
      {
        email: "admin@test.com",
        username: "Admin",
        password: "Password123",
      },
      db
    );

    // 次席用户不填邀请码
    await expect(
      registerUser(
        {
          email: "guest@test.com",
          username: "Guest",
          password: "Password123",
        },
        db
      )
    ).rejects.toThrow("本站处于私有化封闭运行模式，注册必须填写邀请码");
  });

  it("次席用户使用有效邀请码注册成功，角色为 user，且邀请码立即作废", async () => {
    const admin = await registerUser(
      {
        email: "admin@test.com",
        username: "Admin",
        password: "Password123",
      },
      db
    );

    // 管理员生成邀请码
    const invite = await createInviteCode(admin.user.id, db);
    expect(invite.code).toHaveLength(8);

    // 用户使用邀请码注册
    const res = await registerUser(
      {
        email: "friend@test.com",
        username: "朋友",
        password: "FriendPassword123",
        inviteCode: invite.code,
      },
      db
    );

    expect(res.user.role).toBe("user");
    expect(res.user.email).toBe("friend@test.com");

    // 第三方尝试重复使用该邀请码应当失败
    await expect(
      registerUser(
        {
          email: "another@test.com",
          username: "路人",
          password: "Password123",
          inviteCode: invite.code,
        },
        db
      )
    ).rejects.toThrow("邀请码无效、已过期或已被使用");
  });

  it("邀请码有效期机制：默认 1 小时有效，过期后注册被拒绝拦截", async () => {
    const admin = await registerUser(
      {
        email: "admin2@test.com",
        username: "Admin2",
        password: "Password123",
      },
      db
    );

    // 默认生成的邀请码有效期正好为 1 小时 (3,600,000 ms)
    const validInvite = await createInviteCode(admin.user.id, db);
    expect(validInvite.expiresAt).toBeDefined();
    expect(validInvite.expiresAt! - validInvite.createdAt).toBe(60 * 60 * 1000);

    // 生成一个已过期的邀请码
    const expiredInvite = await createInviteCode(admin.user.id, db, -1000);
    expect(expiredInvite.expiresAt).toBeLessThan(Date.now());

    // 尝试使用过期邀请码注册应当被拦截
    await expect(
      registerUser(
        {
          email: "late@test.com",
          username: "迟到者",
          password: "Password123",
          inviteCode: expiredInvite.code,
        },
        db
      )
    ).rejects.toThrow("邀请码已过期");
  });

  it("跨节点无状态 Isolate 模拟：在无共享内存的全新节点凭签名邀请码成功注册", async () => {
    // 节点 1 (Isolate A): 管理员生成签名邀请码
    const isolateA = new MemoryDatabaseAdapter();
    await isolateA.init();
    const admin = await isolateA.getUserByEmail("383004858@qq.com");
    expect(admin).not.toBeNull();

    const invite = await createInviteCode(admin!.id, isolateA);
    expect(invite.code).toHaveLength(8);

    // 节点 2 (Isolate B): 模拟全新的独立边缘 Isolate，内存中完全没有该邀请码
    const isolateB = new MemoryDatabaseAdapter();
    await isolateB.init();
    expect(await isolateB.getInvite(invite.code)).toBeNull(); // 验证 Isolate B 确实没有该码

    // 用户在 Isolate B 使用该邀请码注册，通过 HMAC-SHA256 签名自校验成功核销
    const regRes = await registerUser(
      {
        email: "cross_isolate_user@test.com",
        username: "跨节点用户",
        password: "UserPassword123",
        inviteCode: invite.code,
      },
      isolateB
    );

    expect(regRes.user.email).toBe("cross_isolate_user@test.com");
    expect(regRes.user.role).toBe("user");
    expect(regRes.session.token).toBeDefined();

    // 注册后在 Isolate B 该邀请码已被核销
    const consumed = await isolateB.getInvite(invite.code);
    expect(consumed).not.toBeNull();
    expect(consumed?.usedBy).toBe(regRes.user.id);

    // 再次在 Isolate B 使用该邀请码注册必定失败
    await expect(
      registerUser(
        {
          email: "another_user@test.com",
          username: "重试用户",
          password: "UserPassword123",
          inviteCode: invite.code,
        },
        isolateB
      )
    ).rejects.toThrow("邀请码无效、已过期或已被使用");
  });

  it("登录验证：正确密码成功，错误密码失败，冻结账号拦截", async () => {
    await registerUser(
      {
        email: "user@test.com",
        username: "TestUser",
        password: "CorrectPassword123",
      },
      db
    );

    // 错误密码
    await expect(
      loginUser(
        {
          email: "user@test.com",
          password: "WrongPassword",
        },
        db
      )
    ).rejects.toThrow("邮箱或密码错误");

    // 正确密码
    const loginRes = await loginUser(
      {
        email: "user@test.com",
        password: "CorrectPassword123",
      },
      db
    );
    expect(loginRes.user.email).toBe("user@test.com");
    expect(loginRes.session.token).toBeDefined();

    // 冻结账号后登录
    await db.updateUserStatus(loginRes.user.id, "frozen");
    await expect(
      loginUser(
        {
          email: "user@test.com",
          password: "CorrectPassword123",
        },
        db
      )
    ).rejects.toThrow("该账号已被管理员冻结");
  });

  it("ADMIN_EMAIL 环境变量强保底提升角色", async () => {
    const admin = await registerUser(
      {
        email: "admin@test.com",
        username: "Admin",
        password: "Password123",
      },
      db
    );

    const invite = await createInviteCode(admin.user.id, db);
    const guest = await registerUser(
      {
        email: "boss@company.com",
        username: "Boss",
        password: "BossPassword123",
        inviteCode: invite.code,
      },
      db
    );
    expect(guest.user.role).toBe("user");

    // 配置 ADMIN_EMAIL 登录后自动提升
    const loginRes = await loginUser(
      {
        email: "boss@company.com",
        password: "BossPassword123",
      },
      db,
      "boss@company.com"
    );
    expect(loginRes.user.role).toBe("admin");
  });

  it("Session 验证与注销登出", async () => {
    const res = await registerUser(
      {
        email: "me@test.com",
        username: "Me",
        password: "Password123",
      },
      db
    );

    const validUser = await validateSession(res.session.token, db);
    expect(validUser?.id).toBe(res.user.id);

    // 登出
    await logoutUser(res.session.token, db);
    const afterLogout = await validateSession(res.session.token, db);
    expect(afterLogout).toBeNull();
  });
});
