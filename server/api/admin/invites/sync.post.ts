import { defineEventHandler, readBody } from "h3";
import { requireAdminUser } from "../../../utils/authSession";
import { getDatabase } from "../../../core/db/index";
import { listAllInvites } from "../../../core/services/inviteService";
import { verifySignedInviteCode } from "../../../core/db/crypto";
import type { InviteRecord } from "../../../core/db/types";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const db = await getDatabase(event);
  const body = await readBody(event).catch(() => ({}));
  const knownInvites: InviteRecord[] = Array.isArray(body?.knownInvites) ? body.knownInvites : [];

  for (const item of knownInvites) {
    const code = (item.code || "").toUpperCase().trim();
    if (!code) continue;

    // 自包含 HMAC 验签防篡改
    const verified = await verifySignedInviteCode(code);
    if (!verified || !verified.valid) continue;

    let existing = await db.getInvite(code);
    if (!existing) {
      existing = await db.createInvite(
        code,
        item.createdBy || admin.id,
        item.expiresAt || verified.expiresAt,
        item.createdAt
      );
    }
    if (item.usedBy && existing && !existing.usedBy) {
      await db.useInvite(code, item.usedBy);
    }
    if (item.isRevoked && existing && !existing.isRevoked) {
      await db.revokeInvite(code);
    }
  }

  const invites = await listAllInvites(db);
  return {
    success: true,
    invites,
  };
});
