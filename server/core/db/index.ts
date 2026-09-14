// server/core/db/index.ts
// 数据库统一分发与生命周期管理

import type { DatabaseAdapter } from "./types";
import { MemoryDatabaseAdapter } from "./memoryAdapter";
import { D1DatabaseAdapter, type D1Database } from "./d1Adapter";

let memoryDbInstance: MemoryDatabaseAdapter | null = null;
let d1DbInstance: D1DatabaseAdapter | null = null;

export function getMemoryDatabase(): MemoryDatabaseAdapter {
  if (!memoryDbInstance) {
    memoryDbInstance = new MemoryDatabaseAdapter();
  }
  return memoryDbInstance;
}

export async function getDatabase(event?: any): Promise<DatabaseAdapter> {
  const d1: D1Database | undefined =
    event?.context?.cloudflare?.env?.DB || (process.env as any)?.DB;

  if (d1 && typeof d1.prepare === "function") {
    if (!d1DbInstance) {
      d1DbInstance = new D1DatabaseAdapter(d1);
      await d1DbInstance.init();
    }
    return d1DbInstance;
  }

  // 本地开发 / 测试环境降级为纯 TS 内存驱动
  const mem = getMemoryDatabase();
  await mem.init();
  return mem;
}

export * from "./types";
export * from "./crypto";
