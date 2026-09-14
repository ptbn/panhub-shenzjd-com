import { defineEventHandler } from "h3";
import { requireAuthUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";
import { decryptCredential } from "../../core/db/crypto";
import { getAListStorages } from "../../core/nas/alistClient";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const db = await getDatabase(event);

  const profile = await db.getNasProfile(user.id);
  if (!profile || !profile.alistUrl) {
    return {
      success: false,
      message: "尚未配置 AList 访问地址",
      storages: [],
    };
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
      console.warn("[AList Storages] 解密 token 警告");
    }
  }

  const result = await getAListStorages(profile.alistUrl, token);
  return result;
});
