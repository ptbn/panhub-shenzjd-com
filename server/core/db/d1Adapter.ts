// server/core/db/d1Adapter.ts
// Cloudflare D1 数据库适配器 (纯 JS/TS，执行 D1 SQL Prepared Statements)

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
import { D1_SCHEMA_SQL } from "./schema";

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<any>;
}

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = any>(colName?: string): Promise<T | null>;
  run<T = any>(): Promise<{ success: boolean; meta?: any }>;
  all<T = any>(): Promise<{ results?: T[]; success: boolean }>;
}

export class D1DatabaseAdapter implements DatabaseAdapter {
  private db: D1Database;
  private initialized = false;

  constructor(db: D1Database) {
    this.db = db;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      // D1 exec() 不支持多语句，逐条执行每个 DDL 语句
      const statements = D1_SCHEMA_SQL
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const sql of statements) {
        await this.db.prepare(sql).run().catch((e: any) => {
          // 忽略"already exists"类错误，保证幂等
          if (!String(e).includes("already exists")) {
            console.warn("[D1] Schema stmt warning:", sql.slice(0, 60), e);
          }
        });
      }
      // 插入默认超管账号（幂等 INSERT OR IGNORE）
      await this.db
        .prepare(
          `INSERT OR IGNORE INTO users (id, email, username, password_salt, password_hash, role, status, created_at, last_active_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          "u_admin_twisper",
          "383004858@qq.com",
          "twisper",
          "0d5ebadf351bedd7b60342138db0b8b6",
          "60a76d4bb3ca42331a13bb64313e8126d30114df383e6c7c7aa611bf0fad10ab",
          "admin",
          "active",
          1789361929784,
          1789361929784
        )
        .run();
      // 幂等迁移：尝试为旧表添加 expires_at 列
      await this.db
        .prepare("ALTER TABLE invites ADD COLUMN expires_at INTEGER")
        .run()
        .catch(() => {});
      this.initialized = true;
    } catch (e) {
      console.warn("[D1] Auto schema initialization warning:", e);
    }
  }

  // Users
  async getUserById(id: string): Promise<UserRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind(id)
      .first<any>();
    return row ? this.mapUser(row) : null;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)")
      .bind(email.trim())
      .first<any>();
    return row ? this.mapUser(row) : null;
  }

  async createUser(data: Omit<UserRecord, "createdAt" | "lastActiveAt">): Promise<UserRecord> {
    const now = Date.now();
    await this.db
      .prepare(
        "INSERT INTO users (id, email, username, password_hash, password_salt, role, status, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        data.id,
        data.email.toLowerCase().trim(),
        data.username,
        data.passwordHash,
        data.passwordSalt,
        data.role,
        data.status,
        now,
        now
      )
      .run();

    return {
      ...data,
      email: data.email.toLowerCase().trim(),
      createdAt: now,
      lastActiveAt: now,
    };
  }

  async updateUserStatus(id: string, status: UserStatus): Promise<boolean> {
    const res = await this.db
      .prepare("UPDATE users SET status = ? WHERE id = ?")
      .bind(status, id)
      .run();
    return res.success;
  }

  async updateUserPassword(id: string, passwordHash: string, passwordSalt: string): Promise<boolean> {
    const res = await this.db
      .prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?")
      .bind(passwordHash, passwordSalt, id)
      .run();
    return res.success;
  }

  async updateUserLastActive(id: string, lastActiveAt: number): Promise<void> {
    await this.db
      .prepare("UPDATE users SET last_active_at = ? WHERE id = ?")
      .bind(lastActiveAt, id)
      .run();
  }

  async updateUserRole(id: string, role: UserRole): Promise<boolean> {
    const res = await this.db
      .prepare("UPDATE users SET role = ? WHERE id = ?")
      .bind(role, id)
      .run();
    return res.success;
  }

  async deleteUser(id: string): Promise<boolean> {
    const res = await this.db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    return res.success;
  }

  async listUsers(): Promise<UserRecord[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM users ORDER BY created_at DESC")
      .all<any>();
    return (results || []).map((r) => this.mapUser(r));
  }

  async countUsers(): Promise<number> {
    const row = await this.db.prepare("SELECT COUNT(*) as count FROM users").first<{ count: number }>();
    return row?.count || 0;
  }

  // Sessions
  async createSession(token: string, userId: string, ttlMs: number): Promise<SessionRecord> {
    const now = Date.now();
    const expiresAt = now + ttlMs;
    await this.db
      .prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(token, userId, now, expiresAt)
      .run();
    return { token, userId, createdAt: now, expiresAt };
  }

  async getSession(token: string): Promise<SessionRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM sessions WHERE token = ?")
      .bind(token)
      .first<any>();
    if (!row) return null;
    if (Date.now() > row.expires_at) {
      await this.deleteSession(token);
      return null;
    }
    return {
      token: row.token,
      userId: row.user_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  async deleteSession(token: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  }

  async deleteSessionsByUser(userId: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
  }

  // Invites
  async createInvite(code: string, createdBy: string, expiresAt?: number | null, createdAt?: number): Promise<InviteRecord> {
    const now = createdAt !== undefined ? createdAt : Date.now();
    const upperCode = code.toUpperCase().trim();
    const finalExpiresAt = expiresAt !== undefined ? expiresAt : (now + 60 * 60 * 1000);
    await this.db
      .prepare(
        "INSERT INTO invites (code, created_by, used_by, is_revoked, created_at, used_at, expires_at) VALUES (?, ?, NULL, 0, ?, NULL, ?)"
      )
      .bind(upperCode, createdBy, now, finalExpiresAt)
      .run();
    return {
      code: upperCode,
      createdBy,
      usedBy: null,
      isRevoked: 0,
      createdAt: now,
      usedAt: null,
      expiresAt: finalExpiresAt,
    };
  }

  async getInvite(code: string): Promise<InviteRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM invites WHERE code = ?")
      .bind(code.toUpperCase().trim())
      .first<any>();
    if (!row) return null;
    return {
      code: row.code,
      createdBy: row.created_by,
      usedBy: row.used_by,
      isRevoked: row.is_revoked,
      createdAt: row.created_at,
      usedAt: row.used_at,
      expiresAt: row.expires_at ?? (row.created_at ? row.created_at + 60 * 60 * 1000 : null),
    };
  }

  async useInvite(code: string, userId: string): Promise<boolean> {
    const now = Date.now();
    const res = await this.db
      .prepare(
        "UPDATE invites SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL AND is_revoked = 0 AND (expires_at IS NULL OR expires_at >= ?)"
      )
      .bind(userId, now, code.toUpperCase().trim(), now)
      .run();
    return res.success;
  }

  async revokeInvite(code: string): Promise<boolean> {
    const res = await this.db
      .prepare("UPDATE invites SET is_revoked = 1 WHERE code = ?")
      .bind(code.toUpperCase().trim())
      .run();
    return res.success;
  }

  async listInvites(): Promise<InviteRecord[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM invites ORDER BY created_at DESC")
      .all<any>();
    return (results || []).map((r) => ({
      code: r.code,
      createdBy: r.created_by,
      usedBy: r.used_by,
      isRevoked: r.is_revoked,
      createdAt: r.created_at,
      usedAt: r.used_at,
      expiresAt: r.expires_at ?? (r.created_at ? r.created_at + 60 * 60 * 1000 : null),
    }));
  }

  // NAS Profiles
  async getNasProfile(userId: string): Promise<NasProfileRecord | null> {
    let row = await this.db
      .prepare("SELECT * FROM nas_profiles WHERE user_id = ?")
      .bind(userId)
      .first<any>();

    // 降级兜底：私有化与家庭场景下，若该账号尚未单独配置，无缝回退至系统全局默认配置 (is_default = 1)
    if (!row) {
      row = await this.db
        .prepare("SELECT * FROM nas_profiles WHERE is_default = 1 ORDER BY updated_at DESC LIMIT 1")
        .first<any>();
    }

    if (!row) return null;
    return this.mapNasProfile(row);
  }

  async upsertNasProfile(
    profile: Omit<NasProfileRecord, "createdAt" | "updatedAt">
  ): Promise<NasProfileRecord> {
    const existingRow = await this.db
      .prepare("SELECT * FROM nas_profiles WHERE user_id = ?")
      .bind(profile.userId)
      .first<any>();
    const now = Date.now();
    const createdAt = existingRow ? existingRow.created_at : now;
    const finalId = existingRow ? existingRow.id : (profile.id || `nas_${now}_${Math.random().toString(36).slice(2, 7)}`);

    await this.db
      .prepare(
        `INSERT INTO nas_profiles (
          id, user_id, name, is_default, cloud_drive_enabled,
          alist_url, alist_token_encrypted, alist_default_path,
          torrent_client_type, torrent_client_url, torrent_client_secret_encrypted, torrent_default_dir,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          name = excluded.name,
          is_default = excluded.is_default,
          cloud_drive_enabled = excluded.cloud_drive_enabled,
          alist_url = excluded.alist_url,
          alist_token_encrypted = excluded.alist_token_encrypted,
          alist_default_path = excluded.alist_default_path,
          torrent_client_type = excluded.torrent_client_type,
          torrent_client_url = excluded.torrent_client_url,
          torrent_client_secret_encrypted = excluded.torrent_client_secret_encrypted,
          torrent_default_dir = excluded.torrent_default_dir,
          updated_at = excluded.updated_at`
      )
      .bind(
        finalId,
        profile.userId,
        profile.name,
        profile.isDefault,
        profile.cloudDriveEnabled,
        profile.alistUrl,
        profile.alistTokenEncrypted,
        profile.alistDefaultPath,
        profile.torrentClientType,
        profile.torrentClientUrl,
        profile.torrentClientSecretEncrypted,
        profile.torrentDefaultDir,
        createdAt,
        now
      )
      .run();

    return {
      ...profile,
      id: finalId,
      createdAt,
      updatedAt: now,
    };
  }

  // Push Logs
  async createPushLog(log: Omit<PushLogRecord, "id" | "createdAt">): Promise<PushLogRecord> {
    const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    await this.db
      .prepare(
        `INSERT INTO push_logs (id, user_id, username, title, url, protocol, target_device, target_path, status, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        log.userId,
        log.username,
        log.title,
        log.url,
        log.protocol,
        log.targetDevice,
        log.targetPath,
        log.status,
        log.message,
        now
      )
      .run();

    return { ...log, id, createdAt: now };
  }

  async listPushLogsByUser(userId: string, limit = 50): Promise<PushLogRecord[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM push_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
      .bind(userId, limit)
      .all<any>();
    return (results || []).map((r) => this.mapPushLog(r));
  }

  async listAllPushLogs(limit = 100): Promise<PushLogRecord[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM push_logs ORDER BY created_at DESC LIMIT ?")
      .bind(limit)
      .all<any>();
    return (results || []).map((r) => this.mapPushLog(r));
  }

  // Announcements
  async getAnnouncement(): Promise<AnnouncementRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM announcements WHERE id = 'global'")
      .first<any>();
    if (!row) return null;
    return {
      id: row.id,
      content: row.content,
      enabled: row.enabled,
      updatedAt: row.updated_at,
    };
  }

  async setAnnouncement(content: string, enabled: boolean): Promise<AnnouncementRecord> {
    const now = Date.now();
    const enabledNum = enabled ? 1 : 0;
    await this.db
      .prepare(
        `INSERT INTO announcements (id, content, enabled, updated_at)
         VALUES ('global', ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET content = excluded.content, enabled = excluded.enabled, updated_at = excluded.updated_at`
      )
      .bind(content, enabledNum, now)
      .run();

    return {
      id: "global",
      content,
      enabled: enabledNum,
      updatedAt: now,
    };
  }

  private mapUser(row: any): UserRecord {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      passwordHash: row.password_hash,
      passwordSalt: row.password_salt,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
      lastActiveAt: row.last_active_at,
    };
  }

  private mapNasProfile(row: any): NasProfileRecord {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      isDefault: row.is_default,
      cloudDriveEnabled: row.cloud_drive_enabled,
      alistUrl: row.alist_url,
      alistTokenEncrypted: row.alist_token_encrypted,
      alistDefaultPath: row.alist_default_path,
      torrentClientType: row.torrent_client_type,
      torrentClientUrl: row.torrent_client_url,
      torrentClientSecretEncrypted: row.torrent_client_secret_encrypted,
      torrentDefaultDir: row.torrent_default_dir,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapPushLog(row: any): PushLogRecord {
    return {
      id: row.id,
      userId: row.user_id,
      username: row.username,
      title: row.title,
      url: row.url,
      protocol: row.protocol,
      targetDevice: row.target_device,
      targetPath: row.target_path,
      status: row.status,
      message: row.message,
      createdAt: row.created_at,
    };
  }
}
