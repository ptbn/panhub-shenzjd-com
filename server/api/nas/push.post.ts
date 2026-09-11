import { defineEventHandler, readBody, createError } from "h3";
import { requireAuthUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";
import { dispatchPushTask } from "../../core/nas/dispatcher";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const body = await readBody(event);
  if (!body || !body.url || !body.title) {
    throw createError({ statusCode: 400, message: "推送任务参数不完整：缺少 title 或 url" });
  }

  const db = await getDatabase(event);
  const profile = await db.getNasProfile(user.id);
  if (!profile) {
    throw createError({
      statusCode: 400,
      message: "您尚未配置 NAS 节点，请点击右上角头像前往【我的 NAS】进行配置",
    });
  }

  const masterSecret =
    process.env.APP_ENCRYPTION_SECRET ||
    (event.context?.cloudflare?.env as any)?.APP_ENCRYPTION_SECRET ||
    "panhub-taoge-nas-secret-key-2026";

  try {
    const result = await dispatchPushTask(
      profile,
      {
        title: body.title,
        url: body.url,
        password: body.password,
        category: body.category || "movie",
        targetDir: body.targetDir,
        preferredClient: body.preferredClient || "auto",
      },
      masterSecret,
      db,
      user.username
    );

    return result;
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      message: err.message || "NAS 推送失败",
    });
  }
});
