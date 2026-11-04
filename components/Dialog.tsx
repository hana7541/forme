"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
};

// 화면 가운데 뜨는 작은 창 (모바일에서는 아래에서 올라옴)
export function Dialog({ open, title, onClose, children, width = "max-w-[440px]" }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { t } = useT();

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>("input, textarea, select, button[data-autofocus]");
      (first ?? panelRef.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey, true);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative max-h-[90vh] w-full ${width} overflow-y-auto rounded-t-2xl bg-paper p-6 outline-none sm:rounded-2xl sm:p-7`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-[20px] font-semibold tracking-[-0.03em]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("닫기")}
            className="-mr-2 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-graphite hover:bg-haze hover:text-ink"
          >
            <CloseIcon size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
