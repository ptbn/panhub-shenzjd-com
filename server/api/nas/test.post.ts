import { defineEventHandler, readBody, createError } from "h3";
import { requireAuthUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";
import { decryptCredential } from "../../core/db/crypto";
import { testAListConnection } from "../../core/nas/alistClient";
import { testAria2Connection } from "../../core/nas/aria2Client";
import { testQBittorrentConnection } from "../../core/nas/qbittorrentClient";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const body = await readBody(event);
  if (!body || !body.type || !body.url) {
    throw createError({ statusCode: 400, message: "参数不完整：需要 type 与 url" });
  }

  const db = await getDatabase(event);
  const masterSecret =
    process.env.APP_ENCRYPTION_SECRET ||
    (event.context?.cloudflare?.env as any)?.APP_ENCRYPTION_SECRET ||
    "panhub-taoge-nas-secret-key-2026";

  const profile = await db.getNasProfile(user.id);

  if (body.type === "alist") {
    let token = body.token || "";
    if (token === "******" && profile?.alistTokenEncrypted) {
      try {
        token = await decryptCredential(profile.alistTokenEncrypted, masterSecret);
      } catch {}
    }
    const res = await testAListConnection(body.url, token);
    return res;
  } else if (body.type === "aria2") {
    let secret = body.secret || "";
    if (secret === "******" && profile?.torrentClientSecretEncrypted) {
      try {
        secret = await decryptCredential(profile.torrentClientSecretEncrypted, masterSecret);
      } catch {}
    }
    const res = await testAria2Connection(body.url, secret || undefined);
    return res;
  } else if (body.type === "qbittorrent") {
    let password = body.password || "";
    if (password === "******" && profile?.torrentClientSecretEncrypted) {
      try {
        password = await decryptCredential(profile.torrentClientSecretEncrypted, masterSecret);
      } catch {}
    }
    const res = await testQBittorrentConnection(body.url, body.username || "admin", password || undefined);
    return res;
  }

  throw createError({ statusCode: 400, message: `不支持的测试类型: ${body.type}` });
});
