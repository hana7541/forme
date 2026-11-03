"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

// 로그인·가입 화면 공통 틀. 이미 로그인한 사람은 홈으로 보냄
// PC: 왼쪽에 큰 워드마크, 오른쪽에 입력 폼 / 모바일: 위아래로 쌓임
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) router.replace("/");
  }, [loading, session, router]);

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="flex flex-col justify-between border-hairline px-6 pb-10 pt-8 sm:px-10 lg:border-r lg:px-14 lg:pb-14 lg:pt-12">
        <p className="text-[13px] text-graphite">디자이너를 위한 개인 레퍼런스 아카이브</p>
        <h1 className="mt-16 text-[64px] font-bold leading-[0.9] tracking-[-0.06em] sm:text-[96px] lg:mt-0 lg:text-[clamp(96px,11vw,176px)]">
          FORME
        </h1>
        <p className="mt-6 hidden max-w-sm text-[15px] leading-relaxed text-graphite lg:block">
          작업하다 발견한 이미지를 모으고, 찾고, 프로젝트별로 묶어 두는 나만의 라이브러리.
        </p>
      </section>

      <section className="flex items-start justify-center px-6 pb-16 pt-4 sm:px-10 lg:items-center lg:py-12">
        <div className="w-full max-w-[380px]">{children}</div>
      </section>
    </main>
  );
}
