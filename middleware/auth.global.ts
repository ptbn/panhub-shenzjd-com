// middleware/auth.global.ts
// 全站私有化封闭运行守卫 (Fail-Closed 默认私有拦截)

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchUser } = useAuth();

  // 避免在登录页死循环
  if (to.path === "/auth/login") {
    if (!user.value) {
      await fetchUser();
    }
    if (user.value) {
      return navigateTo((to.query.redirect as string) || "/");
    }
    return;
  }

  // 保证已同步用户身份
  if (!user.value) {
    await fetchUser();
  }

  // 未登录统一强制重定向至登录页
  if (!user.value) {
    return navigateTo({
      path: "/auth/login",
      query: { redirect: to.fullPath },
    });
  }

  // 管理后台路由权限门禁
  if (to.path.startsWith("/admin")) {
    if (user.value.role !== "admin") {
      return navigateTo("/");
    }
  }
});
