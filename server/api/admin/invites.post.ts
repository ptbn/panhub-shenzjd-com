import { defineEventHandler, readBody } from "h3";
import { requireAdminUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";
import { createInviteCode, DEFAULT_INVITE_TTL_MS } from "../../core/services/inviteService";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const db = await getDatabase(event);
  const body = await readBody(event).catch(() => ({}));
  const ttlMs = Number(body?.ttlMs) > 0 ? Number(body.ttlMs) : DEFAULT_INVITE_TTL_MS;

  const invite = await createInviteCode(admin.id, db, ttlMs);
  return {
    success: true,
    invite,
  };
});
