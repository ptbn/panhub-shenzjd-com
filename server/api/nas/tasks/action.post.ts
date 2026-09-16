import { defineEventHandler, readBody, createError } from "h3";
import { requireAuthUser } from "../../../utils/authSession";
import { getDatabase } from "../../../core/db/index";
import { decryptCredential } from "../../../core/db/crypto";
import { controlQBittorrentTorrents } from "../../../core/nas/qbittorrentClient";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const body = await readBody(event);

  if (!body || !body.action || !body.hashes) {
    throw createError({ statusCode: 400, message: "参数不完整：缺少 action 或 hashes" });
  }

  const action = body.action as "pause" | "resume" | "delete";
  if (!["pause", "resume", "delete"].includes(action)) {
    throw createError({ statusCode: 400, message: "无效的 action 类型" });
  }

  const hashes = Array.isArray(body.hashes) ? body.hashes : [body.hashes];
  const db = await getDatabase(event);
  const profile = await db.getNasProfile(user.id);

  if (!profile) {
    throw createError({ statusCode: 400, message: "尚未配置 NAS 节点" });
  }

  const masterSecret =
    process.env.APP_ENCRYPTION_SECRET ||
    (event.context?.cloudflare?.env as any)?.APP_ENCRYPTION_SECRET ||
    "panhub-taoge-nas-secret-key-2026";

  let qbUrl = profile.torrentClientUrl;
  let qbPassword = "";

  if (profile.torrentClientSecretEncrypted) {
    try {
      qbPassword = await decryptCredential(profile.torrentClientSecretEncrypted, masterSecret);
    } catch {}
  }

  if (!qbUrl) {
    if (profile.alistUrl && profile.alistUrl.includes("taogehome.cloud")) {
      qbUrl = "https://qb.taogehome.cloud";
    } else {
      qbUrl = "http://192.168.1.110:8080";
    }
  }

  const res = await controlQBittorrentTorrents(
    qbUrl,
    action,
    hashes,
    !!body.deleteFiles,
    "admin",
    qbPassword || undefined,
    true
  );

  return res;
});
