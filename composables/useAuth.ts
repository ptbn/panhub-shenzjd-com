// composables/useAuth.ts
// 响应式用户身份状态管理 (双通道：Cookie + LocalStorage Bearer 兜底)

import type { UserPublic } from "../server/core/db/types";

export function useAuth() {
  const user = useState<UserPublic | null>("auth_user", () => null);
  const loading = useState<boolean>("auth_loading", () => false);

  function getStoredToken(): string | null {
    if (import.meta.client) {
      try {
        return localStorage.getItem("panhub_token");
      } catch {}
    }
    return null;
  }

  function setStoredToken(token?: string | null): void {
    if (import.meta.client) {
      try {
        if (token) {
          localStorage.setItem("panhub_token", token);
        } else {
          localStorage.removeItem("panhub_token");
        }
      } catch {}
    }
  }

  async function fetchUser(): Promise<UserPublic | null> {
    loading.value = true;
    try {
      const headers: Record<string, string> = {};
      if (import.meta.server) {
        const reqHeaders = useRequestHeaders(["cookie"]);
        if (reqHeaders.cookie) {
          headers["cookie"] = reqHeaders.cookie;
        }
      } else {
        const token = getStoredToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }
      const url = import.meta.client ? `/api/auth/me?_t=${Date.now()}` : "/api/auth/me";
      const res = await $fetch<{ user: UserPublic | null }>(url, {
        headers,
      });
      user.value = res.user;
      return res.user;
    } catch {
      user.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await $fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setStoredToken(null);
      user.value = null;
      window.location.href = "/auth/login";
    }
  }

  const isAuthenticated = computed(() => Boolean(user.value));
  const isAdmin = computed(() => user.value?.role === "admin");

  return {
    user,
    loading,
    isAuthenticated,
    isAdmin,
    fetchUser,
    logout,
    setStoredToken,
    getStoredToken,
  };
}
