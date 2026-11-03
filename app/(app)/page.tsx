"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

type Category = { id: string; name: string; sort_order: number };

export default function HomePage() {
  const { profile, signOut } = useAuth();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()
      .from("categories")
      .select("id, name, sort_order")
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) setLoadError(error.message);
        else setCategories((data as Category[]) ?? []);
      });
  }, []);

  return (
    <div className="min-h-screen">
      <header className="flex h-16 items-center justify-between border-b border-[var(--line)] px-6">
        <span className="text-lg font-semibold tracking-[-0.04em]">FORME</span>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-[var(--muted)] sm:inline">
            {profile ? `@${profile.username}` : ""}
          </span>
          <Button variant="ghost" className="h-9 px-3 text-sm" onClick={() => void signOut()}>
            로그아웃
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-20">
        <p className="text-sm text-[var(--muted)]">STEP 04 · 로그인 완료</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          안녕하세요, {profile?.display_name ?? "디자이너"}님
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          다음 단계에서 이곳에 레퍼런스를 모을 수 있게 만들 거예요.
        </p>

        <section className="mt-12">
          <h2 className="text-sm font-medium">내 기본 카테고리</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            가입할 때 창고 도우미가 자동으로 만들어 둔 카테고리예요.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {loadError && <p className="text-sm text-red-500">불러오지 못했어요: {loadError}</p>}
            {!loadError && categories === null && (
              <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
            )}
            {categories?.map((c) => (
              <span
                key={c.id}
                className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-sm"
              >
                {c.name}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
