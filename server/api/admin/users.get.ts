import { defineEventHandler } from "h3";
import { requireAdminUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);
  const db = await getDatabase(event);

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

  return {
    users: enhancedUsers,
  };
});
