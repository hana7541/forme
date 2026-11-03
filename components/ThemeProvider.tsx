"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "forme-theme";

type ThemeCtx = { theme: ThemeChoice; setTheme: (t: ThemeChoice) => void };
const Ctx = createContext<ThemeCtx | null>(null);

// 화면이 그려지기 전에 테마를 정하는 짧은 스크립트 (깜빡임 방지)
export const themeScript = `(function(){try{var t=localStorage.getItem('${KEY}')||'light';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})();`;

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as ThemeChoice | null;
      if (saved === "light" || saved === "dark" || saved === "system") setThemeState(saved);
    } catch {
      // 저장소를 못 쓰는 브라우저면 라이트로
    }
  }, []);

  // '시스템 설정 따르기'일 때 OS 설정이 바뀌면 따라감
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: ThemeChoice) => {
    setThemeState(t);
    apply(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // 저장 실패해도 이번 화면에는 적용됨
    }
  }, []);

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
