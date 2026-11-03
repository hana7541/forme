"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  // 위로 열지(아래쪽 바에서), 아래로 열지
  side?: "top" | "bottom";
  align?: "start" | "end";
  width?: string;
  label: string;
};

// 버튼을 누르면 옆에 뜨는 작은 목록 창
export function Popover({ trigger, children, side = "bottom", align = "start", width = "w-64", label }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative" data-open={open}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute z-[65] ${width} max-w-[calc(100vw-2rem)] rounded-xl border border-hairline bg-paper p-1.5 ${
            side === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
          } ${align === "end" ? "right-0" : "left-0"}`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  active,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[14px] hover:bg-haze ${
        danger ? "text-red-600" : ""
      } ${active ? "font-medium" : ""}`}
    >
      <span className="flex-1 truncate">{children}</span>
      {active && (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
