// 暗色模式：支持跟随系统与手动切换，默认暗色
import { ref } from "vue";

const isDark = ref(true);

export function useDarkMode() {
  function applyTheme(dark: boolean) {
    isDark.value = dark;
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.classList.toggle("dark", dark);
    }
  }

  function setDark(dark: boolean) {
    applyTheme(dark);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("panhub_theme", dark ? "dark" : "light");
      }
    } catch {}
  }

  function toggle() {
    setDark(!isDark.value);
  }

  function init() {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("panhub_theme");
      if (saved === "dark" || saved === "light") {
        applyTheme(saved === "dark");
        return;
      }
    } catch {}
    if (typeof window.matchMedia === "function") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(media.matches);
      media.addEventListener("change", (e) => {
        if (!localStorage.getItem("panhub_theme")) {
          applyTheme(e.matches);
        }
      });
    }
  }

  return { isDark, toggle, setDark, init };
}