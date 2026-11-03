"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { LogoutIcon, SettingsIcon } from "@/components/icons";

export function ProfileMenu() {
  const { profile, signOut } = useAuth();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 바깥을 누르거나 Esc를 누르면 닫기
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

  const name = profile?.display_name ?? "";
  const initial = name.trim().charAt(0).toUpperCase() || "F";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="내 계정 메뉴"
        className="grid h-10 w-10 place-items-center rounded-full border border-hairline text-[15px] font-semibold transition-colors hover:border-ink"
      >
        {initial}
      </button>

      <div
        role="menu"
        className={`absolute right-0 top-[calc(100%+8px)] z-40 w-60 origin-top-right rounded-xl border border-hairline bg-paper p-1.5 transition duration-150 ${
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="px-3 pb-3 pt-2.5">
          <p className="truncate text-[14px] font-medium">{name}</p>
          <p className="truncate text-[13px] text-graphite">@{profile?.username}</p>
        </div>
        <div className="mb-1 h-px bg-hairline" />
        <button
          role="menuitem"
          type="button"
          onClick={() => {
            setOpen(false);
            show("설정은 STEP 12에서 열려요");
          }}
          className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[14px] text-graphite hover:bg-haze hover:text-ink"
        >
          <SettingsIcon size={16} />
          설정
        </button>
        <button
          role="menuitem"
          type="button"
          onClick={() => {
            setOpen(false);
            void signOut();
          }}
          className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[14px] text-graphite hover:bg-haze hover:text-ink"
        >
          <LogoutIcon size={16} />
          로그아웃
        </button>
      </div>
    </div>
  );
}
