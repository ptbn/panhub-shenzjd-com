// composables/useNasProfile.ts
// NAS 与 AList 用户配置持久化管理
// 具备双存储：LocalStorage 本地优先缓存 + 边缘 D1 远端同步

import { ref, computed, watch } from "vue";
import { useAuth } from "./useAuth";

export interface NasProfilePublic {
  name: string;
  cloudDriveEnabled: boolean;
  alistUrl: string;
  alistHasToken: boolean;
  alistDefaultPath: string;
  torrentClientType: "aria2" | "qbittorrent";
  torrentClientUrl: string;
  torrentHasSecret: boolean;
  torrentDefaultDir: string;
  updatedAt?: number;
}

export interface NasFormData {
  name: string;
  cloudDriveEnabled: boolean;
  alistUrl: string;
  alistToken: string;
  alistHasToken: boolean;
  alistDefaultPath: string;
  torrentClientType: "aria2" | "qbittorrent";
  torrentClientUrl: string;
  torrentClientSecret: string;
  torrentHasSecret: boolean;
  torrentDefaultDir: string;
}

const LOCAL_STORAGE_KEY = "panhub_nas_profile";
const LOCAL_CREDENTIALS_KEY = "panhub_nas_credentials";

export function useNasProfile() {
  const { isAuthenticated, getStoredToken, user } = useAuth();
  const profile = useState<NasProfilePublic | null>("nas_profile_data", () => null);
  const loading = ref(false);
  const profileLoaded = useState<boolean>("nas_profile_loaded", () => false);

  function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = getStoredToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  function getLocalProfile(): any | null {
    if (import.meta.client) {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return null;
  }

  function getLocalCredentials(): any | null {
    if (import.meta.client) {
      try {
        const raw = localStorage.getItem(LOCAL_CREDENTIALS_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return null;
  }

  function setLocalProfile(p: any, creds?: any): void {
    if (import.meta.client) {
      try {
        if (p) {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(p));
        }
        if (creds) {
          localStorage.setItem(LOCAL_CREDENTIALS_KEY, JSON.stringify(creds));
        }
      } catch {}
    }
  }

  // 客户端响应式联动：当用户登录、登出或通过 Session 恢复会话时，主动静默从 D1 拉取最新配置
  if (import.meta.client) {
    watch(
      () => user.value?.id,
      (newUserId) => {
        if (newUserId) {
          loadProfile(true).catch(() => {});
        } else if (!isAuthenticated.value) {
          // 用户未登录且无会话，清理内存状态
          profile.value = null;
        }
      },
      { immediate: true }
    );
  }

  // 初始化优先从本地 LocalStorage 加载，确保 0 秒即刻生效
  if (import.meta.client && !profile.value) {
    const local = getLocalProfile();
    if (local && local.alistUrl) {
      profile.value = local;
      profileLoaded.value = true;
    }
  }

  /**
   * 从服务端加载 NAS Profile
   * 若底层/边缘为空，自动从本地 LocalStorage 中回写
   */
  async function loadProfile(force = false): Promise<NasProfilePublic | null> {
    if (!force && profile.value?.alistUrl) {
      profileLoaded.value = true;
      return profile.value;
    }

    // 先用本地缓存垫底
    const localCached = getLocalProfile();
    if (localCached && localCached.alistUrl && !profile.value) {
      profile.value = localCached;
    }

    loading.value = true;
    try {
      const res = await $fetch<{ profile: NasProfilePublic | null }>("/api/nas/profile", {
        headers: getAuthHeaders(),
      });

      if (res.profile && res.profile.alistUrl) {
        profile.value = res.profile;
        setLocalProfile(res.profile);
        profileLoaded.value = true;
        return res.profile;
      }

      // 若服务端返回空，尝试拿本地凭据 -> 向边缘 Worker 自动同步恢复
      const localCreds = getLocalCredentials();
      if (localCreds && localCreds.alistUrl && isAuthenticated.value) {
        try {
          const syncRes = await $fetch<{ success: boolean; profile: NasProfilePublic }>("/api/nas/profile", {
            method: "POST",
            headers: getAuthHeaders(),
            body: localCreds,
          });
          if (syncRes.profile) {
            profile.value = syncRes.profile;
            setLocalProfile(syncRes.profile);
            profileLoaded.value = true;
            return syncRes.profile;
          }
        } catch (syncErr) {
          console.warn("[NAS Profile] 自动同步提示:", syncErr);
        }
      }

      profileLoaded.value = true;
      return profile.value;
    } catch (e) {
      // 异常时保持本地缓存
      return profile.value;
    } finally {
      loading.value = false;
      profileLoaded.value = true;
    }
  }

  /**
   * 保存 NAS Profile，双写保证
   */
  async function saveProfile(formData: NasFormData): Promise<NasProfilePublic> {
    loading.value = true;
    try {
      // 1. 本地存储保底
      setLocalProfile(formData, formData);

      // 2. 同步服务端
      const res = await $fetch<{ success: boolean; profile: NasProfilePublic }>("/api/nas/profile", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      if (res.profile) {
        profile.value = res.profile;
        setLocalProfile(res.profile, formData);
        return res.profile;
      }
      throw new Error("服务端未返回有效配置");
    } finally {
      loading.value = false;
    }
  }

  const isAlistConfigured = computed(() => {
    return Boolean(profile.value?.alistUrl);
  });

  const alistDefaultPath = computed(() => {
    const raw = profile.value?.alistDefaultPath;
    if (!raw || raw.startsWith("/我的影视挂载") || raw.startsWith("/我的NAS")) {
      return raw || "/NAS本地盘";
    }
    return raw;
  });

  return {
    profile,
    loading,
    profileLoaded,
    isAlistConfigured,
    alistDefaultPath,
    loadProfile,
    saveProfile,
    getLocalProfile,
    getLocalCredentials,
    getAuthHeaders,
  };
}
