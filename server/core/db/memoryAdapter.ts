// server/core/db/memoryAdapter.ts
// 纯 TypeScript 内存数据库适配器 (用于开发、单元测试和无 D1 绑定时的安全降级)

import type {
  DatabaseAdapter,
  UserRecord,
  SessionRecord,
  InviteRecord,
  NasProfileRecord,
  PushLogRecord,
  AnnouncementRecord,
  UserStatus,
  UserRole,
} from "./types";
import {
  syncEdgeUserRecord,
  getEdgeUserByEmail,
  getEdgeUsersList,
  syncEdgeInviteRecord,
  getEdgeInviteByCode,
  getEdgeInvitesList,
  resetEdgeRegistry,
} from "./edgeRegistry";

export const DEFAULT_ADMIN_USER: UserRecord = {
  id: "u_admin_twisper",
  email: "383004858@qq.com",
  username: "twisper",
  passwordSalt: "0d5ebadf351bedd7b60342138db0b8b6",
  passwordHash: "60a76d4bb3ca42331a13bb64313e8126d30114df383e6c7c7aa611bf0fad10ab",
  role: "admin",
  status: "active",
  createdAt: 1789361929784,
  lastActiveAt: 1789361929784,
};

export class MemoryDatabaseAdapter implements DatabaseAdapter {
  private users = new Map<string, UserRecord>();
  private sessions = new Map<string, SessionRecord>();
  private revokedSessions = new Set<string>();
  private invites = new Map<string, InviteRecord>();
  private nasProfiles = new Map<string, NasProfileRecord>();
  private pushLogs: PushLogRecord[] = [];
  private announcement: AnnouncementRecord | null = null;

  async init(): Promise<void> {
    if (this.users.size === 0) {
      this.users.set(DEFAULT_ADMIN_USER.id, { ...DEFAULT_ADMIN_USER });
    }
  }

  // Users
  async getUserById(id: string): Promise<UserRecord | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const lower = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === lower) {
        return { ...u };
      }
    }
    return null;
  }

  async createUser(data: Omit<UserRecord, "createdAt" | "lastActiveAt">): Promise<UserRecord> {
    const now = Date.now();
    const user: UserRecord = {
      ...data,
      email: data.email.toLowerCase().trim(),
      createdAt: now,
      lastActiveAt: now,
    };
    this.users.set(user.id, user);
    syncEdgeUserRecord(user).catch(() => {});
    return { ...user };
  }

  async updateUserStatus(id: string, status: UserStatus): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;
    user.status = status;
    syncEdgeUserRecord(user).catch(() => {});
    return true;
  }

  async updateUserPassword(id: string, passwordHash: string, passwordSalt: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;
    user.passwordHash = passwordHash;
    user.passwordSalt = passwordSalt;
    syncEdgeUserRecord(user).catch(() => {});
    return true;
  }

  async updateUserLastActive(id: string, lastActiveAt: number): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.lastActiveAt = lastActiveAt;
    }
  }

  async updateUserRole(id: string, role: UserRole): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;
    user.role = role;
    syncEdgeUserRecord(user).catch(() => {});
    return true;
  }

  async deleteUser(id: string): Promise<boolean> {
    const deleted = this.users.delete(id);
    this.nasProfiles.delete(id);
    await this.deleteSessionsByUser(id);
    return deleted;
  }

  async listUsers(): Promise<UserRecord[]> {
    const list = Array.from(this.users.values()).map((u) => ({ ...u }));
    const edgeList = await getEdgeUsersList().catch(() => []);
    const map = new Map<string, UserRecord>();
    for (const u of edgeList) {
      map.set(u.id, u);
    }
    for (const u of list) {
      map.set(u.id, u);
    }
    return Array.from(map.values()).map((u) => ({ ...u }));
  }

  async countUsers(): Promise<number> {
    return this.users.size;
  }

  // Sessions
  async createSession(token: string, userId: string, ttlMs: number): Promise<SessionRecord> {
    const now = Date.now();
    const session: SessionRecord = {
      token,
      userId,
      createdAt: now,
      expiresAt: now + ttlMs,
    };
    this.sessions.set(token, session);
    return { ...session };
  }

  async getSession(token: string): Promise<SessionRecord | null> {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    return { ...session };
  }

  async deleteSession(token: string): Promise<void> {
    this.sessions.delete(token);
    this.revokedSessions.add(token);
  }

  isSessionRevoked(token: string): boolean {
    return this.revokedSessions.has(token);
  }

  async deleteSessionsByUser(userId: string): Promise<void> {
    for (const [token, s] of this.sessions.entries()) {
      if (s.userId === userId) {
        this.sessions.delete(token);
      }
    }
  }

  // Invites
  async createInvite(code: string, createdBy: string, expiresAt?: number | null, createdAt?: number): Promise<InviteRecord> {
    const now = createdAt !== undefined ? createdAt : Date.now();
    const finalExpiresAt = expiresAt !== undefined ? expiresAt : (now + 60 * 60 * 1000);
    const invite: InviteRecord = {
      code: code.toUpperCase().trim(),
      createdBy,
      usedBy: null,
      isRevoked: 0,
      createdAt: now,
      usedAt: null,
      expiresAt: finalExpiresAt,
    };
    this.invites.set(invite.code, invite);
    syncEdgeInviteRecord(invite).catch(() => {});
    return { ...invite };
  }

  async getInvite(code: string): Promise<InviteRecord | null> {
    const upper = code.toUpperCase().trim();
    const inv = this.invites.get(upper);
    return inv ? { ...inv } : null;
  }

  async useInvite(code: string, userId: string): Promise<boolean> {
    const upper = code.toUpperCase().trim();
    let inv = this.invites.get(upper);
    if (!inv) {
      const edge = await getEdgeInviteByCode(upper).catch(() => null);
      if (edge) {
        inv = edge;
        this.invites.set(upper, inv);
      }
    }
    if (!inv || inv.isRevoked || inv.usedBy) {
      return false;
    }
    if (inv.expiresAt && Date.now() > inv.expiresAt) {
      return false;
    }
    inv.usedBy = userId;
    inv.usedAt = Date.now();
    syncEdgeInviteRecord(inv).catch(() => {});
    return true;
  }

  async revokeInvite(code: string): Promise<boolean> {
    const upper = code.toUpperCase().trim();
    let inv = this.invites.get(upper);
    if (!inv) {
      const edge = await getEdgeInviteByCode(upper).catch(() => null);
      if (edge) {
        inv = edge;
        this.invites.set(upper, inv);
      }
    }
    if (!inv) return false;
    inv.isRevoked = 1;
    syncEdgeInviteRecord(inv).catch(() => {});
    return true;
  }

  async listInvites(): Promise<InviteRecord[]> {
    const list = Array.from(this.invites.values());
    const edgeList = await getEdgeInvitesList().catch(() => []);
    const map = new Map<string, InviteRecord>();
    for (const inv of edgeList) {
      map.set(inv.code.toUpperCase().trim(), inv);
    }
    for (const inv of list) {
      map.set(inv.code.toUpperCase().trim(), inv);
    }
    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  // NAS Profiles
  async getNasProfile(userId: string): Promise<NasProfileRecord | null> {
    let profile = this.nasProfiles.get(userId);
    if (!profile) {
      // 降级兜底：家庭私有化环境，若该用户尚未单独配置，无缝回退至系统全局默认配置 (is_default = 1)
      for (const p of this.nasProfiles.values()) {
        if (p.isDefault === 1) {
          profile = p;
          break;
        }
      }
    }
    return profile ? { ...profile } : null;
  }

  async upsertNasProfile(
    profile: Omit<NasProfileRecord, "createdAt" | "updatedAt">
  ): Promise<NasProfileRecord> {
    const now = Date.now();
    const existing = this.nasProfiles.get(profile.userId);
    const record: NasProfileRecord = {
      ...profile,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };
    this.nasProfiles.set(profile.userId, record);
    return { ...record };
  }

  // Push Logs
  async createPushLog(log: Omit<PushLogRecord, "id" | "createdAt">): Promise<PushLogRecord> {
    const record: PushLogRecord = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    this.pushLogs.unshift(record);
    // 保留最近 1000 条
    if (this.pushLogs.length > 1000) {
      this.pushLogs.pop();
    }
    return { ...record };
  }

  async listPushLogsByUser(userId: string, limit = 50): Promise<PushLogRecord[]> {
    return this.pushLogs.filter((l) => l.userId === userId).slice(0, limit);
  }

  async listAllPushLogs(limit = 100): Promise<PushLogRecord[]> {
    return this.pushLogs.slice(0, limit);
  }

  // Announcements
  async getAnnouncement(): Promise<AnnouncementRecord | null> {
    return this.announcement ? { ...this.announcement } : null;
  }

  async setAnnouncement(content: string, enabled: boolean): Promise<AnnouncementRecord> {
    this.announcement = {
      id: "global",
      content,
      enabled: enabled ? 1 : 0,
      updatedAt: Date.now(),
    };
    return { ...this.announcement };
  }

  // 测试辅助：重置数据库
  reset(): void {
    this.users.clear();
    this.sessions.clear();
    this.revokedSessions.clear();
    this.invites.clear();
    this.nasProfiles.clear();
    this.pushLogs = [];
    this.announcement = null;
    resetEdgeRegistry();
  }
}
