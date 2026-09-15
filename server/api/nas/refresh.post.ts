import { defineEventHandler, readBody, createError } from "h3";
import { requireAuthUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";
import { decryptCredential } from "../../core/db/crypto";
import { refreshAListPath, getAListStorages } from "../../core/nas/alistClient";
import { resolveNetdiskMountPath } from "../../core/nas/storageResolver";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const body = await readBody(event);
  const targetUrl = body?.url || "";
  let targetPath = body?.path || "";

  const db = await getDatabase(event);
  const profile = await db.getNasProfile(user.id);
  if (!profile || !profile.alistUrl) {
    throw createError({
      statusCode: 400,
      message: "您尚未在【我的 NAS】中配置 AList 访问地址",
    });
  }

  const masterSecret =
    process.env.APP_ENCRYPTION_SECRET ||
    (event.context?.cloudflare?.env as any)?.APP_ENCRYPTION_SECRET ||
    "panhub-taoge-nas-secret-key-2026";

  let token = "";
  if (profile.alistTokenEncrypted) {
    try {
      token = await decryptCredential(profile.alistTokenEncrypted, masterSecret);
    } catch (e) {
      console.warn("[AList Refresh] 解密 token 警告");
    }
  }

  // 1. 获取用户已配置的真实 AList 存储挂载列表
  let storages: any[] = [];
  try {
    const storagesRes = await getAListStorages(profile.alistUrl, token);
    if (storagesRes.success && storagesRes.storages) {
      storages = storagesRes.storages;
    }
  } catch (e) {
    console.warn("[AList Refresh] 获取 storages 列表提示:", e);
  }

  // 2. 动态智能解析挂载路径
  let resolvedInfo: any = null;
  if (targetUrl) {
    resolvedInfo = resolveNetdiskMountPath(targetUrl, storages);
    if (
      resolvedInfo.matched &&
      (!targetPath ||
        targetPath === "/" ||
        targetPath.startsWith("/我的网盘") ||
        targetPath.startsWith("/我的影视挂载"))
    ) {
      targetPath = resolvedInfo.targetPath;
    }
  }

  if (
    !targetPath ||
    targetPath.startsWith("/我的网盘") ||
    targetPath.startsWith("/我的影视挂载")
  ) {
    targetPath = "/";
  }

  // 3. 执行穿透刷新
  let result = await refreshAListPath(profile.alistUrl, token, targetPath);

  // 4. 容错降级：若特定子目录报 storage not found，自动尝试降级刷新根目录
  if (!result.success && targetPath !== "/") {
    const rootRes = await refreshAListPath(profile.alistUrl, token, "/");
    if (rootRes.success) {
      return {
        success: true,
        message: `未能精准定位 [${targetPath}] 专属挂载点，已自动穿透刷新 AList 根目录，海报墙与影视列表已同步！`,
        path: "/",
        fallback: true,
      };
    }
  }

  if (!result.success) {
    throw createError({
      statusCode: 502,
      message: result.message,
    });
  }

  return {
    ...result,
    path: targetPath,
    resolvedDriver: resolvedInfo?.driver,
  };
});
