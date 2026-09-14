import { defineEventHandler, readBody, createError } from "h3";
import { requireAdminUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";
import { generateSalt, hashPassword } from "../../core/db/crypto";
import { syncEdgeUserRecord } from "../../core/db/edgeRegistry";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);
  const db = await getDatabase(event);
  const body = await readBody(event);

  const cleanEmail = (body?.email || "").toLowerCase().trim();
  const cleanUsername = (body?.username || "").trim();
  const rawPassword = (body?.password || "").trim();
  const role = body?.role === "admin" ? "admin" : "user";

  if (!cleanEmail || !cleanUsername) {
    throw createError({ statusCode: 400, message: "邮箱与用户名不能为空" });
  }

  const existing = await db.getUserByEmail(cleanEmail);
  if (existing) {
    throw createError({ statusCode: 400, message: "该邮箱用户已存在" });
  }

  const finalPassword = rawPassword || Math.random().toString(36).slice(2, 10);
  const salt = generateSalt(16);
  const hash = await hashPassword(finalPassword, salt);
  const userId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const newUser = await db.createUser({
    id: userId,
    email: cleanEmail,
    username: cleanUsername,
    passwordHash: hash,
    passwordSalt: salt,
    role,
    status: "active",
  });

  await syncEdgeUserRecord(newUser).catch(() => {});

  return {
    success: true,
    user: {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      role: newUser.role,
      status: newUser.status,
      createdAt: newUser.createdAt,
      lastActiveAt: newUser.lastActiveAt,
      nasConfigured: false,
      nasName: null,
      nasClientType: null,
    },
    password: finalPassword,
  };
});
