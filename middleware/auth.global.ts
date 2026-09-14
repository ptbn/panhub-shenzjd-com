// middleware/auth.global.ts
// 全局路由守卫：保障管理后台安全拦截，开放公开搜索主页与体验

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchUser } = useAuth();

  // 尝试非阻塞同步用户身份（客户端 Cookie / Token 恢复）
  if (!user.value) {
    await fetchUser().catch(() => {});
  }

  // 登录页处理：已登录用户重定向到目标页或主页
  if (to.path === "/auth/login") {
    if (user.value) {
      return navigateTo((to.query.redirect as string) || "/");
    }
    return;
  }

  // 管理后台路由硬门禁 (Fail-Closed：必须登录且拥有 admin 角色)
  if (to.path.startsWith("/admin")) {
    if (!user.value) {
      return navigateTo({
        path: "/auth/login",
        query: { redirect: to.fullPath },
      });
    }
    if (user.value.role !== "admin") {
      return navigateTo("/");
    }
  }
});
