import { defineEventHandler } from "h3";
import { requireAdminUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";
import { listAllInvites } from "../../core/services/inviteService";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);
  const db = await getDatabase(event);

  const invites = await listAllInvites(db);
  return {
    invites,
  };
});
