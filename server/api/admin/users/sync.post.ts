import { defineEventHandler, readBody } from "h3";
import { requireAdminUser } from "../../../utils/authSession";
import { getDatabase } from "../../../core/db/index";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);
  const db = await getDatabase(event);
  const body = await readBody(event).catch(() => ({}));
  const knownUsers = Array.isArray(body?.knownUsers) ? body.knownUsers : [];

  for (const u of knownUsers) {
    if (!u.id || !u.email || !u.username) continue;
    const existing = await db.getUserById(u.id);
    if (!existing && typeof (db as any).createUser === "function") {
      await (db as any).createUser({
        id: u.id,
        email: u.email.toLowerCase().trim(),
        username: u.username.trim(),
        passwordHash: "",
        passwordSalt: "",
        role: u.role || "user",
        status: u.status || "active",
      }).catch(() => {});
    }
  }

  const users = await db.listUsers();
  const enhancedUsers = await Promise.all(
    users.map(async (u) => {
      const nas = await db.getNasProfile(u.id);
      return {
        id: u.id,
        email: u.email,
        username: u.username,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt,
        nasConfigured: Boolean(nas),
        nasName: nas?.name || null,
        nasClientType: nas ? (nas.cloudDriveEnabled ? "AList" : nas.torrentClientType) : null,
      };
    })
  );

  const isD1 = Boolean(db && (db as any).constructor?.name === "D1DatabaseAdapter");
  return {
    success: true,
    users: enhancedUsers,
    storageType: isD1 ? "d1" : "memory",
  };
});
