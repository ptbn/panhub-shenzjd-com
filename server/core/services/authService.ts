// server/core/services/authService.ts
// 认证与用户服务 (支持首位超级管理员自举、环境变量覆盖、30天安全Session)

import type { DatabaseAdapter, UserPublic, UserRecord, SessionRecord } from "../db/types";
import {
  generateSalt,
  generateToken,
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken,
  verifySignedInviteCode,
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

async function syncEdgeUser(user: UserRecord): Promise<void> {
  const cache = (globalThis as any).caches?.default;
  if (!cache) return;
  try {
    const url = `https://panhub-internal.local/users/${encodeURIComponent(user.email.toLowerCase().trim())}`;
    const res = new Response(JSON.stringify(user), {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=2592000, s-maxage=2592000",
      },
    });
    await cache.put(new Request(url), res);
  } catch {}
}

async function findEdgeUser(email: string): Promise<UserRecord | null> {
  const cache = (globalThis as any).caches?.default;
  if (!cache) return null;
  try {
    const url = `https://panhub-internal.local/users/${encodeURIComponent(email.toLowerCase().trim())}`;
    const res = await cache.match(new Request(url));
    if (!res) return null;
    return (await res.json()) as UserRecord;
  } catch {
    return null;
  }
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

  if (!cleanEmail || !cleanUsername || !dto.password) {
    throw new Error("邮箱、用户名和密码均为必填项");
  }

  if (dto.password.length < 6) {
    throw new Error("密码长度至少为 6 位字符");
  }

  // 检查是否已有该邮箱注册
  const existing = await db.getUserByEmail(cleanEmail);
  if (existing) {
    throw new Error("该邮箱已被注册，请直接登录");
  }

  const isBootstrap = await isBootstrapMode(db);
  const userId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // 邀请码准入拦截：非自举模式且非环境变量覆盖邮箱必须持有有效邀请码
  if (!isBootstrap) {
    const isEnvAdmin = adminEmailEnv && cleanEmail === adminEmailEnv.toLowerCase().trim();
    if (!isEnvAdmin) {
      const code = (dto.inviteCode || "").toUpperCase().trim();
      if (!code) {
        throw new Error("本站处于私有化封闭运行模式，注册必须填写邀请码");
      }
      let invite = await db.getInvite(code);
      if (!invite) {
        // 跨节点无状态 Isolate 校验：尝试加密签名还原
        const signed = await verifySignedInviteCode(code);
        if (signed && signed.valid) {
          if (Date.now() > signed.expiresAt) {
            throw new Error("邀请码已过期（默认有效期为 1 小时），请向管理员索取新邀请码");
          }
          invite = await db.createInvite(code, "u_admin_twisper", signed.expiresAt);
        }
      }
      if (!invite || invite.isRevoked || invite.usedBy) {
        throw new Error("邀请码无效、已过期或已被使用");
      }
      if (invite.expiresAt && Date.now() > invite.expiresAt) {
        throw new Error("邀请码已过期（默认有效期为 1 小时），请向管理员索取新邀请码");
      }
      const used = await db.useInvite(code, userId);
      if (!used) {
        throw new Error("邀请码核销失败，已过期或已被使用");
      }
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

  // 同步到 Edge 缓存 (多 Isolate 数据共享)
  syncEdgeUser(newUser).catch(() => {});

  const publicUser = toPublicUser(newUser);
  const sessionToken = await signSessionToken(publicUser);
  const session = await db.createSession(sessionToken, newUser.id, SESSION_TTL_MS);

  return {
    user: publicUser,
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

  let user = await db.getUserByEmail(cleanEmail);
  if (!user) {
    user = await findEdgeUser(cleanEmail);
    if (user && typeof (db as any).createUser === "function") {
      await (db as any).createUser(user).catch(() => {});
    }
  }
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

  const publicUser = toPublicUser(user);
  const sessionToken = await signSessionToken(publicUser);
  const session = await db.createSession(sessionToken, user.id, SESSION_TTL_MS);

  return {
    user: publicUser,
    session,
  };
}

export async function validateSession(
  token: string,
  db: DatabaseAdapter
): Promise<UserPublic | null> {
  if (!token) return null;

  // 0. 检查是否已被当前节点显式注销 (Revoked)
  if (typeof (db as any).isSessionRevoked === "function" && (db as any).isSessionRevoked(token)) {
    return null;
  }

  // 1. 优先尝试自包含签名 Session 校验 (支持 Cloudflare 全球集群跨 Isolate 零丢失)
  const signed = await verifySessionToken(token);
  if (signed) {
    const userInDb = await db.getUserById(signed.id).catch(() => null);
    if (userInDb) {
      if (userInDb.status === "frozen") {
        return null;
      }
      db.updateUserLastActive(userInDb.id, Date.now()).catch(() => {});
      return toPublicUser(userInDb);
    }

    // 若当前无状态全新节点内存中尚未缓存该用户，自动补入内存
    if (typeof (db as any).createUser === "function") {
      await (db as any).createUser({
        id: signed.id,
        email: signed.email,
        username: signed.username,
        passwordHash: "",
        passwordSalt: "",
        role: signed.role,
        status: "active",
      }).catch(() => {});
      await db.createSession(token, signed.id, SESSION_TTL_MS).catch(() => {});
    }
    return signed;
  }

  // 2. 回退到普通数据库 Session 记录
  const session = await db.getSession(token);
  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    await db.deleteSession(token);
    return null;
  }

  const user = await db.getUserById(session.userId);
  if (!user || user.status === "frozen") {
    if (user?.status === "frozen") {
      await db.deleteSession(token);
    }
    return null;
  }

  db.updateUserLastActive(user.id, Date.now()).catch(() => {});
  return toPublicUser(user);
}

export async function logoutUser(token: string, db: DatabaseAdapter): Promise<void> {
  if (token) {
    await db.deleteSession(token);
  }
}
