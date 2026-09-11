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
