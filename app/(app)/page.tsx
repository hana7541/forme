"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useShell } from "@/components/shell/AppShell";
import { UploadIcon } from "@/components/icons";

// 빈 화면에 깔리는 자리 칸들의 비율 (실제 레퍼런스가 쌓일 모양을 미리 보여 줌)
const GHOST_RATIOS = [
  "3 / 4", "1 / 1", "4 / 5", "2 / 3", "5 / 4", "3 / 4", "4 / 3",
  "2 / 3", "1 / 1", "3 / 5", "4 / 5", "5 / 4", "3 / 4", "1 / 1", "2 / 3",
];

function useViewTitle() {
  const params = useSearchParams();
  const { counts } = useShell();
  const view = params.get("view");
  const categoryId = params.get("category");
  const q = params.get("q");

  if (q) return { title: `‘${q}’`, count: 0, kind: "search" as const, q };
  if (view === "favorites") return { title: "즐겨찾기", count: counts?.favorites, kind: "favorites" as const, q: undefined };
  if (categoryId) {
    const c = counts?.categories.find((x) => x.id === categoryId);
    return { title: c?.name ?? "카테고리", count: c?.count, kind: "category" as const, q: undefined };
  }
  return { title: "전체", count: counts?.total, kind: "all" as const, q: undefined };
}

function EmptyMessage({ kind, q }: { kind: "all" | "favorites" | "category" | "search"; q?: string }) {
  const { openUpload } = useShell();

  if (kind === "favorites") {
    return (
      <p className="max-w-md text-[15px] leading-relaxed text-graphite">
        마음에 드는 레퍼런스에 하트를 누르면 여기에 모여요.
      </p>
    );
  }
  if (kind === "search") {
    return (
      <div className="max-w-md text-[15px] leading-relaxed text-graphite">
        <p>‘{q}’와 맞는 레퍼런스가 없어요. 다른 단어로 찾아보세요.</p>
        <Link href="/" className="mt-3 inline-block text-ink underline underline-offset-4">
          검색 지우기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <p className="text-[15px] leading-relaxed text-graphite">
        {kind === "category"
          ? "이 카테고리에 넣은 레퍼런스가 아직 없어요."
          : "웹사이트, 브랜딩, 타이포그래피처럼 눈에 들어온 이미지를 이곳에 모아 두세요. 파일을 끌어다 놓거나, 복사한 이미지를 붙여넣어도 돼요."}
      </p>
      <button
        type="button"
        onClick={openUpload}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-ink px-5 text-[14px] font-medium transition-colors hover:bg-ink hover:text-paper"
      >
        <UploadIcon size={16} />
        이미지 올리기
      </button>
    </div>
  );
}

function LibraryView() {
  const { title, count, kind, q } = useViewTitle();

  return (
    <div>
      <header className="mb-10 md:mb-14">
        <h1 className="font-display text-[44px] leading-[1.05] tracking-[-0.02em] sm:text-[56px] lg:text-[72px]">
          {title}
          <sup className="ml-2 align-super font-sans text-[13px] font-normal tracking-normal text-graphite tabular-nums sm:text-[15px]">
            {typeof count === "number" ? count : ""}
          </sup>
        </h1>
        <div className="mt-5">
          <EmptyMessage kind={kind} q={q} />
        </div>
      </header>

      {/* 아직 비어 있는 그리드: 레퍼런스가 쌓일 자리 */}
      <div
        aria-hidden="true"
        className="relative columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4 2xl:columns-5"
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 95%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 95%)",
        }}
      >
        {GHOST_RATIOS.map((ratio, i) => (
          <div
            key={i}
            className="ghost-tile mb-3 break-inside-avoid rounded-[3px] bg-haze sm:mb-4"
            style={{ aspectRatio: ratio, animationDelay: `${120 + i * 45}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryView />
    </Suspense>
  );
}
