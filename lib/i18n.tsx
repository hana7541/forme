"use client";

// 한국어 · 영어 전환
// - 한국어 문장을 그대로 열쇠로 씀: t("저장했어요") → KR "저장했어요", EN "Saved"
// - 같은 한국어인데 영어가 달라야 하면 "@뜻"을 붙임: t("전체@nav") → KR "전체", EN "All References"
// - 바뀌는 부분은 {이름}: t("{n}개 선택", { n: 3 })
// - 영어 사전에 없으면 한국어를 그대로 보여 줌
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { EN } from "./i18n-en";

export type Lang = "ko" | "en";
type Vars = Record<string, string | number>;

import { LANG_KEY as KEY } from "./boot-scripts";

function readSaved(): Lang {
  if (typeof window === "undefined") return "ko";
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "ko";
  } catch {
    return "ko";
  }
}

// React 밖(오류 문구 등)에서도 지금 언어를 알 수 있게
let current: Lang = readSaved();

function fill(s: string, vars?: Vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function tr(key: string, vars?: Vars, lang: Lang = current): string {
  const at = key.indexOf("@");
  const ko = at >= 0 ? key.slice(0, at) : key;
  const text = lang === "en" ? EN[key] ?? ko : ko;
  return fill(text, vars);
}

export function getLang(): Lang {
  return current;
}

// 가입할 때 자동으로 만든 기본 카테고리는 화면에서만 영어로 보여 줌 (저장된 이름은 그대로)
const CATEGORY_EN: Record<string, string> = {
  웹사이트: "Website",
  "UI/UX": "UI/UX",
  브랜딩: "Branding",
  타이포그래피: "Typography",
  그래픽: "Graphic",
  사진: "Photography",
};

export function catLabel(name: string, lang: Lang = current) {
  return lang === "en" ? CATEGORY_EN[name] ?? name : name;
}


type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Vars) => string;
  cat: (name: string) => string;
  locale: string;
};

const Ctx = createContext<LangCtx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ko");

  useEffect(() => {
    const saved = readSaved();
    current = saved;
    setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    current = l;
    setLangState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // 저장 실패해도 이번 화면에는 적용됨
    }
  }, []);

  const t = useCallback((key: string, vars?: Vars) => tr(key, vars, lang), [lang]);
  const cat = useCallback((name: string) => catLabel(name, lang), [lang]);

  return (
    <Ctx.Provider value={{ lang, setLang, t, cat, locale: lang === "en" ? "en-US" : "ko-KR" }}>{children}</Ctx.Provider>
  );
}

export function useT() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useT must be used inside <LanguageProvider>");
  return ctx;
}
