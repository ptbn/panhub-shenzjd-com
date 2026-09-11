import { defineEventHandler } from "h3";
import { requireAuthUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const db = await getDatabase(event);

  const logs = await db.listPushLogsByUser(user.id, 50);
  return {
    logs,
  };
});
