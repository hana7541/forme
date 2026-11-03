"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

// 로그인·가입 화면 공통 틀. 이미 로그인한 사람은 홈으로 보냄
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) router.replace("/");
  }, [loading, session, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px]">
        <p className="mb-10 text-center text-2xl font-semibold tracking-[-0.04em]">FORME</p>
        {children}
      </div>
    </main>
  );
}
