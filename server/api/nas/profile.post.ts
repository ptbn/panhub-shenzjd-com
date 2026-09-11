import { defineEventHandler, readBody, createError } from "h3";
import { requireAuthUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";
import { encryptCredential } from "../../core/db/crypto";
import type { NasProfilePublic } from "../../core/nas/types";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const body = await readBody(event);
  if (!body) {
    throw createError({ statusCode: 400, message: "请求体不能为空" });
  }

  const db = await getDatabase(event);
  const masterSecret =
    process.env.APP_ENCRYPTION_SECRET ||
    (event.context?.cloudflare?.env as any)?.APP_ENCRYPTION_SECRET ||
    "panhub-taoge-nas-secret-key-2026";

  const existing = await db.getNasProfile(user.id);

  let alistTokenEncrypted = existing?.alistTokenEncrypted || "";
  if (body.alistToken && body.alistToken !== "******") {
    alistTokenEncrypted = await encryptCredential(body.alistToken, masterSecret);
  } else if (body.alistToken === "") {
    alistTokenEncrypted = "";
  }

  let torrentClientSecretEncrypted = existing?.torrentClientSecretEncrypted || "";
  if (body.torrentClientSecret && body.torrentClientSecret !== "******") {
    torrentClientSecretEncrypted = await encryptCredential(body.torrentClientSecret, masterSecret);
  } else if (body.torrentClientSecret === "") {
    torrentClientSecretEncrypted = "";
  }

  const profile = await db.upsertNasProfile({
    id: existing?.id || `nas_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: user.id,
    name: body.name || "我的家庭 NAS",
    isDefault: 1,
    cloudDriveEnabled: body.cloudDriveEnabled !== false ? 1 : 0,
    alistUrl: body.alistUrl || "",
    alistTokenEncrypted,
    alistDefaultPath: body.alistDefaultPath || "/我的网盘/电影",
    torrentClientType: body.torrentClientType === "qbittorrent" ? "qbittorrent" : "aria2",
    torrentClientUrl: body.torrentClientUrl || "",
    torrentClientSecretEncrypted,
    torrentDefaultDir: body.torrentDefaultDir || "/Media/Movies",
  });

  const publicProfile: NasProfilePublic = {
    id: profile.id,
    userId: profile.userId,
    name: profile.name,
    isDefault: Boolean(profile.isDefault),
    cloudDriveEnabled: Boolean(profile.cloudDriveEnabled),
    alistUrl: profile.alistUrl,
    alistHasToken: Boolean(profile.alistTokenEncrypted),
    alistDefaultPath: profile.alistDefaultPath,
    torrentClientType: profile.torrentClientType,
    torrentClientUrl: profile.torrentClientUrl,
    torrentHasSecret: Boolean(profile.torrentClientSecretEncrypted),
    torrentDefaultDir: profile.torrentDefaultDir,
    updatedAt: profile.updatedAt,
  };

  return {
    success: true,
    profile: publicProfile,
  };
});
