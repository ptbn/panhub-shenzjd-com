import { defineEventHandler, createError } from "h3";
import { requireAdminUser } from "../../../../utils/authSession";
import { getDatabase } from "../../../../core/db/index";
import { revokeInviteCode } from "../../../../core/services/inviteService";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);
  const code = event.context.params?.code;
  if (!code) {
    throw createError({ statusCode: 400, message: "缺少邀请码" });
  }

  const db = await getDatabase(event);
  const success = await revokeInviteCode(code, db);

  return {
    success,
    message: success ? "邀请码已成功作废" : "未找到该邀请码",
  };
});
