// server/core/services/authService.ts
// 认证与用户服务 (支持首位超级管理员自举、环境变量覆盖、30天安全Session)

import type { DatabaseAdapter, UserPublic, UserRecord, SessionRecord } from "../db/types";
import {
  generateSalt,
  generateToken,
  hashPassword,
  verifyPassword,
} from "../db/crypto";

export interface RegisterDto {
  email: string;
  username: string;
  password: string;
  inviteCode?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResult {
  user: UserPublic;
  session: SessionRecord;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

export function toPublicUser(u: UserRecord): UserPublic {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    lastActiveAt: u.lastActiveAt,
  };
}

export async function isBootstrapMode(db: DatabaseAdapter): Promise<boolean> {
  const count = await db.countUsers();
  return count === 0;
}

export async function registerUser(
  dto: RegisterDto,
  db: DatabaseAdapter,
  adminEmailEnv?: string
): Promise<AuthResult> {
  const cleanEmail = (dto.email || "").toLowerCase().trim();
  const cleanUsername = (dto.username || "").trim();

  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("请输入有效的电子邮箱地址");
  }
  if (!cleanUsername || cleanUsername.length < 2) {
    throw new Error("用户名至少需要 2 个字符");
  }
  if (!dto.password || dto.password.length < 6) {
    throw new Error("密码长度至少为 6 位");
  }

  const existing = await db.getUserByEmail(cleanEmail);
  if (existing) {
    throw new Error("该邮箱已被注册，请直接登录");
  }

  const isBootstrap = await isBootstrapMode(db);
  const userId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // 邀请码验证
  if (!isBootstrap) {
    const code = (dto.inviteCode || "").toUpperCase().trim();
    if (!code) {
      throw new Error("本站处于私有化封闭运行模式，注册必须填写邀请码");
    }
    const invite = await db.getInvite(code);
    if (!invite || invite.isRevoked || invite.usedBy) {
      throw new Error("邀请码无效、已过期或已被使用");
    }
    const used = await db.useInvite(code, userId);
    if (!used) {
      throw new Error("邀请码核销失败，请重试");
    }
  }

  // 确定角色：首位自举用户或环境变量指定邮箱自动升级为 admin
  let role: "admin" | "user" = "user";
  if (isBootstrap || (adminEmailEnv && cleanEmail === adminEmailEnv.toLowerCase().trim())) {
    role = "admin";
  }

  const salt = generateSalt(16);
  const hash = await hashPassword(dto.password, salt);

  const newUser = await db.createUser({
    id: userId,
    email: cleanEmail,
    username: cleanUsername,
    passwordHash: hash,
    passwordSalt: salt,
    role,
    status: "active",
  });

  const sessionToken = generateToken(32);
  const session = await db.createSession(sessionToken, newUser.id, SESSION_TTL_MS);

  return {
    user: toPublicUser(newUser),
    session,
  };
}

export async function loginUser(
  dto: LoginDto,
  db: DatabaseAdapter,
  adminEmailEnv?: string
): Promise<AuthResult> {
  const cleanEmail = (dto.email || "").toLowerCase().trim();
  if (!cleanEmail || !dto.password) {
    throw new Error("邮箱和密码不能为空");
  }

  const user = await db.getUserByEmail(cleanEmail);
  if (!user) {
    throw new Error("邮箱或密码错误");
  }

  if (user.status === "frozen") {
    throw new Error("该账号已被管理员冻结，请联系超级管理员解封");
  }

  const valid = await verifyPassword(dto.password, user.passwordSalt, user.passwordHash);
  if (!valid) {
    throw new Error("邮箱或密码错误");
  }

  // 环境变量覆盖保底：若匹配 ADMIN_EMAIL 且角色未升级，自动提升为 admin
  if (adminEmailEnv && cleanEmail === adminEmailEnv.toLowerCase().trim() && user.role !== "admin") {
    await db.updateUserRole(user.id, "admin");
    user.role = "admin";
  }

  await db.updateUserLastActive(user.id, Date.now());

  const sessionToken = generateToken(32);
  const session = await db.createSession(sessionToken, user.id, SESSION_TTL_MS);

  return {
    user: toPublicUser(user),
    session,
  };
}

export async function validateSession(
  token: string,
  db: DatabaseAdapter
): Promise<UserPublic | null> {
  if (!token) return null;
  const session = await db.getSession(token);
  if (!session) return null;

  const user = await db.getUserById(session.userId);
  if (!user || user.status === "frozen") {
    if (user?.status === "frozen") {
      await db.deleteSession(token);
    }
    return null;
  }

  // 静默刷新活跃时间
  db.updateUserLastActive(user.id, Date.now()).catch(() => {});

  return toPublicUser(user);
}

export async function logoutUser(token: string, db: DatabaseAdapter): Promise<void> {
  if (token) {
    await db.deleteSession(token);
  }
}
