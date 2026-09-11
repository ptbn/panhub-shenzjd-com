import { defineEventHandler, readBody, createError } from "h3";
import { requireAdminUser } from "../../../../utils/authSession";
import { getDatabase } from "../../../../core/db/index";
import { hashPassword, generateSalt } from "../../../../core/db/crypto";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);
  const targetUserId = event.context.params?.id;
  if (!targetUserId) {
    throw createError({ statusCode: 400, message: "缺少目标用户 ID" });
  }

  const body = await readBody(event);
  const newPassword = body?.newPassword || `PanHub@${Math.random().toString(36).slice(2, 8)}`;
  if (newPassword.length < 6) {
    throw createError({ statusCode: 400, message: "新密码长度至少为 6 位" });
  }

  const db = await getDatabase(event);
  const user = await db.getUserById(targetUserId);
  if (!user) {
    throw createError({ statusCode: 404, message: "未找到该用户" });
  }

  const salt = generateSalt(16);
  const hash = await hashPassword(newPassword, salt);
  await db.updateUserPassword(targetUserId, hash, salt);
  // 清理该用户旧会话
  await db.deleteSessionsByUser(targetUserId);

  return {
    success: true,
    message: "密码重置成功，该用户需要使用新密码重新登录",
    temporaryPassword: newPassword,
  };
});
