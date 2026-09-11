import { defineEventHandler } from "h3";
import { requireAdminUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);
  const db = await getDatabase(event);

  const logs = await db.listAllPushLogs(100);
  return {
    logs,
  };
});
