import { defineEventHandler } from "h3";
import { getDatabase } from "../../core/db/index";
import { isBootstrapMode } from "../../core/services/authService";

export default defineEventHandler(async (event) => {
  const db = await getDatabase(event);
  const isBootstrap = await isBootstrapMode(db);
  return {
    isBootstrap,
  };
});
