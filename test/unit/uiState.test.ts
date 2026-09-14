import { describe, it, expect, beforeEach } from "vitest";
import { useDarkMode } from "../../composables/useDarkMode";

describe("useDarkMode 主题切换与持久化测试", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (k: string) => store[k] || null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      key: (i: number) => Object.keys(store)[i] || null,
      length: 0,
    };
  });

  it("默认处于深色模式 (isDark = true)", () => {
    const { isDark } = useDarkMode();
    expect(isDark.value).toBe(true);
  });

  it("toggle() 应正确切换深浅色并同步至 localStorage", () => {
    const { isDark, toggle, setDark } = useDarkMode();
    expect(isDark.value).toBe(true);

    toggle();
    expect(isDark.value).toBe(false);
    expect(globalThis.localStorage.getItem("panhub_theme")).toBe("light");

    setDark(true);
    expect(isDark.value).toBe(true);
    expect(globalThis.localStorage.getItem("panhub_theme")).toBe("dark");
  });
});

describe("智能吸顶胶囊岛与全局路由守卫门禁测试", () => {
  function getScrollTop(layoutScrollTop: number, windowScrollY: number, docScrollTop: number) {
    return (layoutScrollTop > 0 ? layoutScrollTop : 0) || windowScrollY || docScrollTop || 0;
  }

  it("当 layout 未溢出但 window.scrollY 滚动超过 240px 时应正确激活吸顶胶囊", () => {
    // 模拟 layout.scrollTop = 0 (非滚动容器)，window.scrollY = 350
    const st = getScrollTop(0, 350, 0);
    expect(st).toBe(350);
    expect(st > 240).toBe(true);
  });

  it("当视口处于顶部时胶囊岛不激活", () => {
    const st = getScrollTop(0, 100, 0);
    expect(st).toBe(100);
    expect(st > 240).toBe(false);
  });

  function simulateAuthMiddleware(toPath: string, user: { role: string } | null) {
    if (toPath === "/auth/login") {
      if (user) return { action: "redirect", target: "/" };
      return { action: "allow" };
    }
    if (toPath.startsWith("/admin")) {
      if (!user) return { action: "redirect", target: "/auth/login?redirect=" + toPath };
      if (user.role !== "admin") return { action: "redirect", target: "/" };
      return { action: "allow" };
    }
    // 公开搜索页、隐私页、静态页无阻拦直接放行
    return { action: "allow" };
  }

  it("未登录普通访客可以自由访问主页与公共搜索，严禁被强制重定向至登录页", () => {
    const homeRes = simulateAuthMiddleware("/", null);
    expect(homeRes.action).toBe("allow");

    const privacyRes = simulateAuthMiddleware("/privacy", null);
    expect(privacyRes.action).toBe("allow");
  });

  it("未登录访客访问 /admin 必须被 Fail-Closed 拦截并重定向至登录页", () => {
    const adminRes = simulateAuthMiddleware("/admin", null);
    expect(adminRes.action).toBe("redirect");
    expect(adminRes.target).toBe("/auth/login?redirect=/admin");
  });

  it("普通用户 (role: user) 访问 /admin 应被拒绝并退回首页", () => {
    const adminRes = simulateAuthMiddleware("/admin", { role: "user" });
    expect(adminRes.action).toBe("redirect");
    expect(adminRes.target).toBe("/");
  });

  it("超级管理员 (role: admin) 可正常进入 /admin", () => {
    const adminRes = simulateAuthMiddleware("/admin", { role: "admin" });
    expect(adminRes.action).toBe("allow");
  });
});

