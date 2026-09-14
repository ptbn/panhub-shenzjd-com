import { defineEventHandler, setHeader } from "h3";
import { getAuthenticatedUser } from "../../utils/authSession";

export default defineEventHandler(async (event) => {
  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  const user = await getAuthenticatedUser(event);
  return {
    user,
  };
});
