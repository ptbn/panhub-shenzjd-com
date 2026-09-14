// server/core/db/schema.ts
// Cloudflare D1 边缘 SQLite 表结构定义

export const D1_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  used_by TEXT,
  is_revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  used_at INTEGER,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS nas_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 1,
  cloud_drive_enabled INTEGER NOT NULL DEFAULT 1,
  alist_url TEXT NOT NULL DEFAULT '',
  alist_token_encrypted TEXT NOT NULL DEFAULT '',
  alist_default_path TEXT NOT NULL DEFAULT '',
  torrent_client_type TEXT NOT NULL DEFAULT 'aria2',
  torrent_client_url TEXT NOT NULL DEFAULT '',
  torrent_client_secret_encrypted TEXT NOT NULL DEFAULT '',
  torrent_default_dir TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS push_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  protocol TEXT NOT NULL,
  target_device TEXT NOT NULL,
  target_path TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_logs_user_id ON push_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_push_logs_created_at ON push_logs(created_at);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
`;
