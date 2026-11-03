"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastCtx = { show: (message: string) => void };
const Ctx = createContext<ToastCtx | null>(null);

// 화면 아래에 잠깐 떴다 사라지는 안내 한 줄
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(m);
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), 2600);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4 transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        {message && (
          <p className="rounded-full bg-ink px-5 py-2.5 text-sm text-paper">{message}</p>
        )}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
