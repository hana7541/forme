"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useTheme, type ThemeChoice } from "@/components/ThemeProvider";
import { CloseIcon, LogoutIcon, MenuIcon, PlusIcon, SearchIcon, SettingsIcon } from "@/components/icons";
import { useShell } from "./AppShell";
import { useT, type Lang } from "@/lib/i18n";

const iconBtn = "grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-haze";

// 검색: 아이콘을 누르거나 Cmd/Ctrl + K 를 누르면 헤더 안에서 펼쳐짐 (화면 전체에 검색창은 이것 하나)
function HeaderSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useT();
  const current = params.get("q") ?? "";
  const [open, setOpen] = useState(!!current);
  const [q, setQ] = useState(current);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQ(current);
    if (current) setOpen(true);
  }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/?q=${encodeURIComponent(term)}` : "/");
    inputRef.current?.blur();
  }

  function close() {
    setOpen(false);
    setQ("");
    if (current) router.push("/");
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-label={t("검색 (⌘K)")}
        className={iconBtn}
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <SearchIcon />
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className="absolute inset-x-0 top-0 z-10 flex h-16 items-center gap-2 bg-paper px-4 sm:static sm:h-auto sm:w-[min(360px,40vw)] sm:bg-transparent sm:px-0"
    >
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-graphite" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && !q && close()}
          onBlur={() => !q.trim() && !current && setOpen(false)}
          placeholder={t("제목, 메모, 출처, 태그로 찾기")}
          aria-label={t("레퍼런스 검색")}
          className="h-10 w-full rounded-full bg-haze pl-10 pr-4 text-[14px] outline-none placeholder:text-graphite focus:shadow-[inset_0_0_0_1px_var(--color-ink)] [&::-webkit-search-cancel-button]:hidden"
        />
      </div>
      <button type="button" aria-label={t("검색 닫기")} onClick={close} className={iconBtn}>
        <CloseIcon size={16} />
      </button>
    </form>
  );
}

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
  { value: "system", label: "시스템" },
];

const LANGS: { value: Lang; label: string }[] = [
  { value: "ko", label: "KR" },
  { value: "en", label: "EN" },
];

// 설정: 프로필, 테마, 설정 페이지, 로그아웃
function SettingsMenu() {
  const { profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t, lang, setLang } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("설정")}
        className={`${iconBtn} ${open ? "bg-haze" : ""}`}
      >
        <SettingsIcon />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-[10px] border border-hairline bg-paper p-1.5">
          <div className="px-3 pb-3 pt-2.5">
            <p className="truncate text-[14px] font-medium">{profile?.display_name}</p>
            <p className="truncate text-[13px] text-graphite">@{profile?.username}</p>
          </div>
          <div className="h-px bg-hairline" />
          <div className="px-3 pb-2 pt-3">
            <p className="mb-2 text-[12px] text-graphite">{t("화면 모드")}</p>
            <div role="radiogroup" aria-label={t("화면 모드")} className="grid grid-cols-3 rounded-full bg-haze p-0.5">
              {THEMES.map((th) => (
                <button
                  key={th.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === th.value}
                  onClick={() => setTheme(th.value)}
                  className={`h-8 rounded-full text-[12px] transition-colors ${
                    theme === th.value ? "bg-paper font-medium text-ink shadow-[0_0_0_1px_var(--color-hairline)]" : "text-graphite hover:text-ink"
                  }`}
                >
                  {t(th.label)}
                </button>
              ))}
            </div>
          </div>
          <div className="px-3 pb-2 pt-1">
            <p className="mb-2 text-[12px] text-graphite">{t("언어")}</p>
            <div role="radiogroup" aria-label={t("언어")} className="grid grid-cols-2 rounded-full bg-haze p-0.5">
              {LANGS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  role="radio"
                  aria-checked={lang === l.value}
                  onClick={() => setLang(l.value)}
                  className={`h-8 rounded-full text-[12px] tracking-[0.04em] transition-colors ${
                    lang === l.value ? "bg-paper font-medium text-ink shadow-[0_0_0_1px_var(--color-hairline)]" : "text-graphite hover:text-ink"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="my-1 h-px bg-hairline" />
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/settings");
            }}
            className="flex h-9 w-full items-center gap-3 rounded-[6px] px-3 text-[14px] hover:bg-haze"
          >
            <SettingsIcon size={16} />
            {t("설정과 백업")}
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex h-9 w-full items-center gap-3 rounded-[6px] px-3 text-[14px] hover:bg-haze"
          >
            <LogoutIcon size={16} />
            {t("로그아웃")}
          </button>
        </div>
      )}
    </div>
  );
}

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { openUpload } = useShell();
  const { t } = useT();

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-paper/90 backdrop-blur-md">
      <div className="relative flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-7">
        <button type="button" onClick={onOpenMenu} aria-label={t("메뉴 열기")} className={`${iconBtn} -ml-2 lg:hidden`}>
          <MenuIcon />
        </button>
        <Link href="/" className="text-[20px] font-bold leading-none tracking-[-0.05em]" aria-label={t("FORME 홈")}>
          FORME.
        </Link>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <HeaderSearch />
          <SettingsMenu />
          <button
            type="button"
            onClick={openUpload}
            className="ml-1 inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-3 text-[14px] font-medium text-paper transition-opacity hover:opacity-85 sm:px-4"
          >
            <PlusIcon size={16} />
            <span className="hidden sm:inline">{t("추가하기@add")}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
