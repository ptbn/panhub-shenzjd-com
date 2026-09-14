// server/api/nas/mount-share.post.ts
// PanHub 方案 A：AList 动态分享挂载 API（多用户安全隔离与鉴权）

import { defineEventHandler, readBody, createError } from "h3";
import { requireAuthUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";
import { decryptCredential } from "../../core/db/crypto";
import { mountAListShare } from "../../core/nas/alistClient";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const body = await readBody(event);

  if (!body || !body.url) {
    throw createError({
      statusCode: 400,
      message: "分享链接不能为空",
    });
  }

  const db = await getDatabase(event);
  const profile = await db.getNasProfile(user.id);

  if (!profile || !profile.alistUrl) {
    throw createError({
      statusCode: 400,
      message: "尚未在【我的 NAS】中配置 AList 访问地址与凭证，请先完成绑定",
    });
  }

  const masterSecret =
    process.env.APP_ENCRYPTION_SECRET ||
    (event.context?.cloudflare?.env as any)?.APP_ENCRYPTION_SECRET ||
    "panhub-taoge-nas-secret-key-2026";

  let token = "";
  if (profile.alistTokenEncrypted) {
    try {
      token = await decryptCredential(profile.alistTokenEncrypted, masterSecret);
    } catch (e) {
      console.warn("[AList Mount] 解密 token 警告:", e);
    }
  }

  // 默认挂载前缀：若用户未指定，则按用户名隔离目录，防止多租户命名冲突
  const basePrefix = (profile.alistDefaultPath || `/${user.username}/影视挂载`).replace(/\/+$/, "");
  const cleanTitle = (body.title || "未知影视")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim()
    .slice(0, 80);
  const targetMountPath = `${basePrefix}/${cleanTitle}`;

  const result = await mountAListShare(
    profile.alistUrl,
    token,
    body.url,
    body.password || "",
    targetMountPath
  );

  if (!result.success) {
    throw createError({
      statusCode: 502,
      message: result.message,
    });
  }

  return result;
});
