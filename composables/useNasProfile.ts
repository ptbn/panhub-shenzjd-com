// composables/useNasProfile.ts
// NAS 与 AList 用户配置持久化管理
// 具备双轨存储（LocalStorage 本地真值 + 边缘端自动自愈与同步）

import { ref, computed } from "vue";
import { useAuth } from "./useAuth";
import type { NasProfilePublic } from "../server/core/nas/types";

const LOCAL_STORAGE_KEY = "panhub_nas_profile";
const LOCAL_CREDENTIALS_KEY = "panhub_nas_credentials";

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

export function useNasProfile() {
  const { isAuthenticated, getStoredToken } = useAuth();
  const profile = useState<NasProfilePublic | null>("nas_profile_data", () => null);
  const loading = ref(false);

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

  // 初始化尝试先从本地 LocalStorage 加载，确保 0 毫秒即刻生效
  if (import.meta.client && !profile.value) {
    const local = getLocalProfile();
    if (local && local.alistUrl) {
      profile.value = local;
    }
  }

  /**
   * 从服务端加载 NAS Profile
   * 若服务端因重新部署/边缘冷重启导致数据为空，自动从本地 LocalStorage 触发回写自愈！
   */
  async function loadProfile(force = false): Promise<NasProfilePublic | null> {
    if (!force && profile.value?.alistUrl) {
      return profile.value;
    }

    // 先用本地缓存托底
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
        return res.profile;
      }

      // 服务端返回空，但本地有已保存的凭据 -> 边缘端 Worker 重启自愈机制！
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
            return syncRes.profile;
          }
        } catch (syncErr) {
          console.warn("[NAS Profile] 自愈同步提示:", syncErr);
        }
      }

      return profile.value;
    } catch (e) {
      // 网络或离线异常，继续保持本地缓存
      return profile.value;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 保存 NAS Profile，双写本地与服务端
   */
  async function saveProfile(formData: NasFormData): Promise<NasProfilePublic> {
    loading.value = true;
    try {
      // 1. 本地存储立即更新
      setLocalProfile(formData, formData);

      // 2. 发送服务端
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
    if (!raw || raw === "/我的网盘/电影" || raw === "/我的影视挂载" || raw.startsWith("/我的网盘")) {
      return "/NAS本地盘";
    }
    return raw;
  });

  return {
    profile,
    loading,
    isAlistConfigured,
    alistDefaultPath,
    loadProfile,
    saveProfile,
    getLocalProfile,
    getLocalCredentials,
    getAuthHeaders,
  };
}
