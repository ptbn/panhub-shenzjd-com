import { defineEventHandler, getCookie, getHeader } from "h3";
import { getAuthenticatedUser, getSessionToken, SESSION_COOKIE_NAME } from "../../utils/authSession";
import { verifySessionToken } from "../../core/db/crypto";

export default defineEventHandler(async (event) => {
  const cookieRaw = getCookie(event, SESSION_COOKIE_NAME);
  const authHeader = getHeader(event, "authorization");
  const cookieHeader = getHeader(event, "cookie");
  const token = getSessionToken(event);

  let signedRes: any = null;
  let verifyErr: string | null = null;
  if (token) {
    try {
      signedRes = await verifySessionToken(token);
    } catch (e: any) {
      verifyErr = e?.message || String(e);
    }
  }

  const user = await getAuthenticatedUser(event);
  return {
    user,
    _diag: {
      hasToken: Boolean(token),
      tokenLen: token ? token.length : 0,
      cookieRaw: cookieRaw ? cookieRaw.slice(0, 15) + "..." : null,
      cookieHeader: cookieHeader ? cookieHeader.slice(0, 30) + "..." : null,
      authHeader: authHeader ? authHeader.slice(0, 15) + "..." : null,
      signedRes,
      verifyErr,
    },
  };
});
