import { defineEventHandler, readBody, createError } from "h3";
import { getDatabase } from "../../core/db/index";
import { registerUser } from "../../core/services/authService";
import { setSessionCookie } from "../../utils/authSession";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body) {
    throw createError({ statusCode: 400, message: "请求体不能为空" });
  }

  const db = await getDatabase(event);
  const adminEmail = process.env.ADMIN_EMAIL || (event.context?.cloudflare?.env as any)?.ADMIN_EMAIL;

  try {
    const { user, session } = await registerUser(body, db, adminEmail);
    setSessionCookie(event, session.token);
    return {
      success: true,
      user,
      token: session.token,
    };
  } catch (err: any) {
    throw createError({
      statusCode: 400,
      message: err.message || "注册失败",
    });
  }
});
