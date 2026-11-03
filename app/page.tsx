"use client";

import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase/config";

type Status = "checking" | "ok" | "fail";

const LABEL: Record<Status, string> = {
  checking: "창고 연결 확인 중…",
  ok: "Supabase 연결 성공",
  fail: "Supabase 연결 실패",
};

const DOT: Record<Status, string> = {
  checking: "bg-amber-400 animate-pulse",
  ok: "bg-emerald-500",
  fail: "bg-red-500",
};

export default function Home() {
  const [status, setStatus] = useState<Status>("checking");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    })
      .then((res) => {
        setStatus(res.ok ? "ok" : "fail");
        if (!res.ok) setDetail(`응답 코드 ${res.status}`);
      })
      .catch(() => {
        setStatus("fail");
        setDetail("네트워크 오류");
      });
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-6xl font-semibold tracking-[-0.04em]">FORME</h1>
      <p className="text-[var(--muted)]">디자이너를 위한 개인 레퍼런스 아카이브</p>

      <div className="flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm">
        <span className={`h-2 w-2 rounded-full ${DOT[status]}`} />
        <span>{LABEL[status]}</span>
        {detail && <span className="text-[var(--muted)]">· {detail}</span>}
      </div>

      <p className="text-xs text-[var(--muted)]">STEP 02 · 웹앱 뼈대</p>
    </main>
  );
}
