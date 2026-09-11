// server/core/services/inviteService.ts
// 一次性邀请码管理服务

import type { DatabaseAdapter, InviteRecord } from "../db/types";
import { generateInviteCode } from "../db/crypto";

export async function createInviteCode(
  createdByUserId: string,
  db: DatabaseAdapter
): Promise<InviteRecord> {
  // 生成 8 位无歧义随机码
  let code = generateInviteCode();
  // 碰撞预防
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db.getInvite(code);
    if (!existing) break;
    code = generateInviteCode();
    attempts++;
  }

  return await db.createInvite(code, createdByUserId);
}

export async function listAllInvites(db: DatabaseAdapter): Promise<InviteRecord[]> {
  return await db.listInvites();
}

export async function revokeInviteCode(code: string, db: DatabaseAdapter): Promise<boolean> {
  return await db.revokeInvite(code);
}
