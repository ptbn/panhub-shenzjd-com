// server/core/services/inviteService.ts
// 一次性邀请码管理服务

import type { DatabaseAdapter, InviteRecord } from "../db/types";
import { generateSignedInviteCode } from "../db/crypto";

export const DEFAULT_INVITE_TTL_MS = 60 * 60 * 1000; // 默认 1 小时 (3,600,000 ms)

export async function createInviteCode(
  createdByUserId: string,
  db: DatabaseAdapter,
  ttlMs: number = DEFAULT_INVITE_TTL_MS
): Promise<InviteRecord> {
  const expiresAt = Date.now() + ttlMs;
  // 生成 8 位自包含防篡改加密签名邀请码 (全球跨节点无状态零丢失)
  let code = await generateSignedInviteCode(expiresAt);
  // 碰撞预防
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db.getInvite(code);
    if (!existing) break;
    code = await generateSignedInviteCode(expiresAt);
    attempts++;
  }

  return await db.createInvite(code, createdByUserId, expiresAt);
}

export async function listAllInvites(db: DatabaseAdapter): Promise<InviteRecord[]> {
  return await db.listInvites();
}

export async function revokeInviteCode(code: string, db: DatabaseAdapter): Promise<boolean> {
  return await db.revokeInvite(code);
}
