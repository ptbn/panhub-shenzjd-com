// composables/useAuth.ts
// 响应式用户身份状态管理

import type { UserPublic } from "../server/core/db/types";

export function useAuth() {
  const user = useState<UserPublic | null>("auth_user", () => null);
  const loading = useState<boolean>("auth_loading", () => false);

  async function fetchUser(): Promise<UserPublic | null> {
    loading.value = true;
    try {
      const res = await $fetch<{ user: UserPublic | null }>("/api/auth/me");
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
      user.value = null;
      navigateTo("/auth/login");
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
  };
}
