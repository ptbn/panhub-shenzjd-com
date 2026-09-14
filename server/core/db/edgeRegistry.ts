// server/core/db/edgeRegistry.ts
// 跨 Isolate 全局边缘缓存注册表 (基于 Cloudflare Cache API 与合法域名匹配)

import type { UserRecord, InviteRecord } from "./types";

const memoryUsersIndex = new Map<string, UserRecord>();
const memoryInvitesIndex = new Map<string, InviteRecord>();

export function getZoneOrigin(event?: any): string {
  if (event) {
    const cfUrl = event.context?.cloudflare?.request?.url;
    if (cfUrl) {
      try {
        return new URL(cfUrl).origin;
      } catch {}
    }
    const host =
      event.node?.req?.headers?.host ||
      event.headers?.get?.("host") ||
      event.headers?.["host"];
    if (host && typeof host === "string") {
      const proto =
        event.node?.req?.headers?.["x-forwarded-proto"] ||
        event.headers?.get?.("x-forwarded-proto") ||
        "https";
      return `${proto}://${host}`;
    }
  }
  return "https://pan.taogehome.cloud";
}

function getEdgeCache(): any {
  return (globalThis as any).caches?.default || null;
}

export async function syncEdgeUserRecord(user: UserRecord, event?: any): Promise<void> {
  memoryUsersIndex.set(user.id, { ...user });

  const cache = getEdgeCache();
  if (!cache) return;

  try {
    const origin = getZoneOrigin(event);
    // 1. 缓存单用户
    const singleUrl = `${origin}/_cf_cache_sys/user_${encodeURIComponent(user.email.toLowerCase().trim())}.json`;
    await cache.put(
      new Request(singleUrl),
      new Response(JSON.stringify(user), {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=31536000, s-maxage=31536000",
        },
      })
    );

    // 2. 更新全量用户索引
    const listUrl = `${origin}/_cf_cache_sys/users_index.json`;
    let currentList: UserRecord[] = [];
    try {
      const matched = await cache.match(new Request(listUrl));
      if (matched) {
        currentList = (await matched.json()) || [];
      }
    } catch {}

    const map = new Map<string, UserRecord>();
    for (const u of currentList) {
      map.set(u.id, u);
    }
    map.set(user.id, { ...user });

    await cache.put(
      new Request(listUrl),
      new Response(JSON.stringify(Array.from(map.values())), {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=31536000, s-maxage=31536000",
        },
      })
    );
  } catch (err) {
    // 忽略特定非关键缓存异常
  }
}

export async function getEdgeUserByEmail(email: string, event?: any): Promise<UserRecord | null> {
  const lower = email.toLowerCase().trim();
  for (const u of memoryUsersIndex.values()) {
    if (u.email.toLowerCase().trim() === lower) {
      return { ...u };
    }
  }

  const cache = getEdgeCache();
  if (!cache) return null;

  try {
    const origin = getZoneOrigin(event);
    const singleUrl = `${origin}/_cf_cache_sys/user_${encodeURIComponent(lower)}.json`;
    const matched = await cache.match(new Request(singleUrl));
    if (matched) {
      const u = (await matched.json()) as UserRecord;
      memoryUsersIndex.set(u.id, u);
      return u;
    }
  } catch {}

  return null;
}

export async function getEdgeUsersList(event?: any): Promise<UserRecord[]> {
  const cache = getEdgeCache();
  if (cache) {
    try {
      const origin = getZoneOrigin(event);
      const listUrl = `${origin}/_cf_cache_sys/users_index.json`;
      const matched = await cache.match(new Request(listUrl));
      if (matched) {
        const list = ((await matched.json()) as UserRecord[]) || [];
        for (const u of list) {
          memoryUsersIndex.set(u.id, u);
        }
      }
    } catch {}
  }
  return Array.from(memoryUsersIndex.values()).map((u) => ({ ...u }));
}

export async function syncEdgeInviteRecord(invite: InviteRecord, event?: any): Promise<void> {
  memoryInvitesIndex.set(invite.code.toUpperCase().trim(), { ...invite });

  const cache = getEdgeCache();
  if (!cache) return;

  try {
    const origin = getZoneOrigin(event);
    const codeKey = encodeURIComponent(invite.code.toUpperCase().trim());
    const singleUrl = `${origin}/_cf_cache_sys/invite_${codeKey}.json`;
    await cache.put(
      new Request(singleUrl),
      new Response(JSON.stringify(invite), {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=31536000, s-maxage=31536000",
        },
      })
    );

    // 2. 更新全量邀请码索引
    const listUrl = `${origin}/_cf_cache_sys/invites_index.json`;
    let currentList: InviteRecord[] = [];
    try {
      const matched = await cache.match(new Request(listUrl));
      if (matched) {
        currentList = (await matched.json()) || [];
      }
    } catch {}

    const map = new Map<string, InviteRecord>();
    for (const inv of currentList) {
      map.set(inv.code.toUpperCase().trim(), inv);
    }
    map.set(invite.code.toUpperCase().trim(), { ...invite });

    await cache.put(
      new Request(listUrl),
      new Response(JSON.stringify(Array.from(map.values())), {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=31536000, s-maxage=31536000",
        },
      })
    );
  } catch {}
}

export async function getEdgeInviteByCode(code: string, event?: any): Promise<InviteRecord | null> {
  const upper = code.toUpperCase().trim();
  const mem = memoryInvitesIndex.get(upper);
  if (mem) return { ...mem };

  const cache = getEdgeCache();
  if (!cache) return null;

  try {
    const origin = getZoneOrigin(event);
    const singleUrl = `${origin}/_cf_cache_sys/invite_${encodeURIComponent(upper)}.json`;
    const matched = await cache.match(new Request(singleUrl));
    if (matched) {
      const inv = (await matched.json()) as InviteRecord;
      memoryInvitesIndex.set(upper, inv);
      return inv;
    }
  } catch {}

  return null;
}

export async function getEdgeInvitesList(event?: any): Promise<InviteRecord[]> {
  const cache = getEdgeCache();
  if (cache) {
    try {
      const origin = getZoneOrigin(event);
      const listUrl = `${origin}/_cf_cache_sys/invites_index.json`;
      const matched = await cache.match(new Request(listUrl));
      if (matched) {
        const list = ((await matched.json()) as InviteRecord[]) || [];
        for (const inv of list) {
          memoryInvitesIndex.set(inv.code.toUpperCase().trim(), inv);
        }
      }
    } catch {}
  }
  return Array.from(memoryInvitesIndex.values()).map((i) => ({ ...i }));
}

export function resetEdgeRegistry(): void {
  memoryUsersIndex.clear();
  memoryInvitesIndex.clear();
}
