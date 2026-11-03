"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CloseIcon, MenuIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { ProfileMenu } from "./ProfileMenu";
import { useShell } from "./AppShell";

function SearchField({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [params]);

  // Cmd/Ctrl + K 로 검색창 바로가기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/?q=${encodeURIComponent(term)}` : "/");
    inputRef.current?.blur();
    onDone?.();
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative w-full">
      <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-graphite" />
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="제목, 메모, 태그로 찾기"
        aria-label="레퍼런스 검색"
        className="h-11 w-full rounded-full bg-haze pl-11 pr-14 text-[14px] outline-none transition-shadow placeholder:text-graphite focus:bg-paper focus:shadow-[inset_0_0_0_1px_var(--color-ink)] [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 text-[12px] text-graphite md:block">
        ⌘K
      </kbd>
    </form>
  );
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { openUpload } = useShell();
  const [mobileSearch, setMobileSearch] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
      <div className="flex h-[72px] items-center gap-3 px-5 sm:px-8 lg:px-12">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="메뉴 열기"
          className="-ml-2 grid h-10 w-10 place-items-center rounded-full hover:bg-haze lg:hidden"
        >
          <MenuIcon />
        </button>
        <Link href="/" className="text-[20px] font-bold leading-none tracking-[-0.05em] md:hidden">
          FORME
        </Link>

        <div className="hidden max-w-[440px] flex-1 md:block">
          <SearchField />
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setMobileSearch((v) => !v)}
            aria-label={mobileSearch ? "검색 닫기" : "검색"}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-haze md:hidden"
          >
            {mobileSearch ? <CloseIcon /> : <SearchIcon />}
          </button>
          <button
            type="button"
            onClick={openUpload}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-3 text-[14px] font-medium text-paper transition-opacity hover:opacity-85 sm:px-4"
          >
            <PlusIcon size={16} />
            <span className="hidden sm:inline">업로드</span>
          </button>
          <ProfileMenu />
        </div>
      </div>

      {mobileSearch && (
        <div className="px-5 pb-4 md:hidden">
          <SearchField autoFocus onDone={() => setMobileSearch(false)} />
        </div>
      )}
    </header>
  );
}
