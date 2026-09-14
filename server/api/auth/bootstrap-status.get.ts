import { defineEventHandler, setHeader } from "h3";
import { getDatabase } from "../../core/db/index";
import { isBootstrapMode } from "../../core/services/authService";

export default defineEventHandler(async (event) => {
  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  const db = await getDatabase(event);
  const isBootstrap = await isBootstrapMode(db);
  return {
    isBootstrap,
  };
});
