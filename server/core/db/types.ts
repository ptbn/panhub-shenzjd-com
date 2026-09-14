// server/core/db/types.ts
// 实体模型契约定义 (纯 TS，与 D1 和内存适配器通用)

export type UserRole = "admin" | "user";
export type UserStatus = "active" | "frozen";

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
  status: UserStatus;
  createdAt: number;
  lastActiveAt: number;
}

export interface UserPublic {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  createdAt: number;
  lastActiveAt: number;
}

export interface InviteRecord {
  code: string; // 8位大写字母数字
  createdBy: string; // 创建者 userId
  usedBy: string | null; // 使用者 userId
  isRevoked: number; // 0 或 1
  createdAt: number;
  usedAt: number | null;
  expiresAt: number | null; // 有效期截止时间戳 (默认创建后1小时)
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

export interface NasProfileRecord {
  id: string;
  userId: string;
  name: string;
  isDefault: number; // 0 或 1
  cloudDriveEnabled: number; // 0 或 1
  alistUrl: string;
  alistTokenEncrypted: string;
  alistDefaultPath: string;
  torrentClientType: "aria2" | "qbittorrent";
  torrentClientUrl: string;
  torrentClientSecretEncrypted: string;
  torrentDefaultDir: string;
  createdAt: number;
  updatedAt: number;
}

export interface PushLogRecord {
  id: string;
  userId: string;
  username: string;
  title: string;
  url: string;
  protocol: "alist" | "aria2" | "qbittorrent";
  targetDevice: string;
  targetPath: string;
  status: "success" | "failed";
  message: string;
  createdAt: number;
}

export interface AnnouncementRecord {
  id: string;
  content: string;
  enabled: number; // 0 或 1
  updatedAt: number;
}

export interface DatabaseAdapter {
  init(): Promise<void>;

  // Users
  getUserById(id: string): Promise<UserRecord | null>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  createUser(user: Omit<UserRecord, "createdAt" | "lastActiveAt">): Promise<UserRecord>;
  updateUserStatus(id: string, status: UserStatus): Promise<boolean>;
  updateUserPassword(id: string, passwordHash: string, passwordSalt: string): Promise<boolean>;
  updateUserLastActive(id: string, lastActiveAt: number): Promise<void>;
  updateUserRole(id: string, role: UserRole): Promise<boolean>;
  deleteUser(id: string): Promise<boolean>;
  listUsers(): Promise<UserRecord[]>;
  countUsers(): Promise<number>;

  // Sessions
  createSession(token: string, userId: string, ttlMs: number): Promise<SessionRecord>;
  getSession(token: string): Promise<SessionRecord | null>;
  deleteSession(token: string): Promise<void>;
  deleteSessionsByUser(userId: string): Promise<void>;

  // Invites
  createInvite(code: string, createdBy: string, expiresAt?: number | null): Promise<InviteRecord>;
  getInvite(code: string): Promise<InviteRecord | null>;
  useInvite(code: string, userId: string): Promise<boolean>;
  revokeInvite(code: string): Promise<boolean>;
  listInvites(): Promise<InviteRecord[]>;

  // NAS Profiles
  getNasProfile(userId: string): Promise<NasProfileRecord | null>;
  upsertNasProfile(profile: Omit<NasProfileRecord, "createdAt" | "updatedAt">): Promise<NasProfileRecord>;

  // Push Logs
  createPushLog(log: Omit<PushLogRecord, "id" | "createdAt">): Promise<PushLogRecord>;
  listPushLogsByUser(userId: string, limit?: number): Promise<PushLogRecord[]>;
  listAllPushLogs(limit?: number): Promise<PushLogRecord[]>;

  // Announcements
  getAnnouncement(): Promise<AnnouncementRecord | null>;
  setAnnouncement(content: string, enabled: boolean): Promise<AnnouncementRecord>;
}
