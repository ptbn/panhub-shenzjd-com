import { defineEventHandler, readBody, createError } from "h3";
import { requireAdminUser } from "../../../../utils/authSession";
import { getDatabase } from "../../../../core/db/index";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const targetUserId = event.context.params?.id;
  if (!targetUserId) {
    throw createError({ statusCode: 400, message: "缺少目标用户 ID" });
  }

  if (targetUserId === admin.id) {
    throw createError({ statusCode: 400, message: "禁止对自己执行封禁或删除操作" });
  }

  const body = await readBody(event);
  const action = body?.action || "toggle_status"; // 'freeze' | 'unfreeze' | 'delete'
  const db = await getDatabase(event);

  if (action === "delete") {
    const ok = await db.deleteUser(targetUserId);
    return { success: ok, message: "用户账号已注销" };
  } else if (action === "freeze") {
    const ok = await db.updateUserStatus(targetUserId, "frozen");
    await db.deleteSessionsByUser(targetUserId);
    return { success: ok, message: "用户账号已冻结，其会话已立即终止" };
  } else if (action === "unfreeze") {
    const ok = await db.updateUserStatus(targetUserId, "active");
    return { success: ok, message: "用户账号已成功解冻" };
  }

  throw createError({ statusCode: 400, message: `不支持的操作类型: ${action}` });
});
