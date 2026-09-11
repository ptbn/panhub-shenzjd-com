import { defineEventHandler } from "h3";
import { requireAdminUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";
import { createInviteCode } from "../../core/services/inviteService";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const db = await getDatabase(event);

  const invite = await createInviteCode(admin.id, db);
  return {
    success: true,
    invite,
  };
});
