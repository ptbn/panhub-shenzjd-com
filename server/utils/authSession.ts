// server/utils/authSession.ts
// 服务端会话提取与鉴权门禁 (Fail-Closed)

import {
  type H3Event,
  getCookie,
  setCookie,
  deleteCookie,
  getHeader,
  createError,
} from "h3";
import { getDatabase } from "../core/db/index";
import { validateSession } from "../core/services/authService";
import type { UserPublic } from "../core/db/types";

export const SESSION_COOKIE_NAME = "panhub_session";

export function getSessionToken(event: H3Event): string | null {
  const cookie = getCookie(event, SESSION_COOKIE_NAME);
  if (cookie) return cookie.trim();

  const authHeader = getHeader(event, "authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export function setSessionCookie(event: H3Event, token: string): void {
  setCookie(event, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 天
  });
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE_NAME, {
    path: "/",
  });
}

export async function getAuthenticatedUser(event: H3Event): Promise<UserPublic | null> {
  const token = getSessionToken(event);
  if (!token) return null;

  const db = await getDatabase(event);
  return await validateSession(token, db);
}

export async function requireAuthUser(event: H3Event): Promise<UserPublic> {
  const user = await getAuthenticatedUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "未登录或登录会话已过期，请重新登录",
    });
  }
  return user;
}

export async function requireAdminUser(event: H3Event): Promise<UserPublic> {
  const user = await requireAuthUser(event);
  if (user.role !== "admin") {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "权限不足：该操作仅限超级管理员执行",
    });
  }
  return user;
}
