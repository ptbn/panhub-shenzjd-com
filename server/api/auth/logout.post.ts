import { defineEventHandler } from "h3";
import { getDatabase } from "../../core/db/index";
import { logoutUser } from "../../core/services/authService";
import { getSessionToken, clearSessionCookie } from "../../utils/authSession";

export default defineEventHandler(async (event) => {
  const token = getSessionToken(event);
  if (token) {
    const db = await getDatabase(event);
    await logoutUser(token, db);
  }
  clearSessionCookie(event);
  return {
    success: true,
  };
});
