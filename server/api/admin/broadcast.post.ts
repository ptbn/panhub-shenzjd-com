import { defineEventHandler, readBody, createError } from "h3";
import { requireAdminUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);
  const body = await readBody(event);
  if (!body) {
    throw createError({ statusCode: 400, message: "请求体不能为空" });
  }

  const db = await getDatabase(event);
  const record = await db.setAnnouncement(body.content || "", Boolean(body.enabled));

  return {
    success: true,
    announcement: record,
  };
});
