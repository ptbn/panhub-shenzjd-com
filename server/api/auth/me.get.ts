import { defineEventHandler } from "h3";
import { getAuthenticatedUser } from "../../utils/authSession";

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event);
  return {
    user,
  };
});
