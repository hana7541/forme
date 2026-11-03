"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { AppShell } from "@/components/shell/AppShell";

function Spinner() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-hairline border-t-ink" />
    </main>
  );
}

// 문지기: 로그인하지 않은 사람은 로그인 화면으로 보냄
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading || !session) return <Spinner />;

  return (
    <Suspense fallback={<Spinner />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
