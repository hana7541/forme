"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useShell } from "@/components/shell/AppShell";
import { UploadIcon } from "@/components/icons";
import { LibraryView } from "@/components/library/LibraryView";
import type { RefFilter } from "@/lib/refs";

function UploadCta({ text }: { text: string }) {
  const { openUpload } = useShell();
  return (
    <div>
      <p className="text-[15px] leading-relaxed text-graphite">{text}</p>
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

function Home() {
  const params = useSearchParams();
  const { counts } = useShell();
  const view = params.get("view");
  const categoryId = params.get("category");
  const q = params.get("q")?.trim() || null;
  const tagId = params.get("tag");
  // 사이드바에서 태그만 눌렀을 때는 그 태그가 화면의 주제
  const tagIsTopic = !!tagId && !categoryId && !q && view !== "favorites";

  const base = useMemo<RefFilter>(
    () => ({
      q,
      favorites: view === "favorites",
      categoryId,
      tagId: tagIsTopic ? tagId : null,
    }),
    [q, view, categoryId, tagId, tagIsTopic]
  );

  let title: React.ReactNode = "전체";
  let empty: React.ReactNode = (
    <UploadCta text="웹사이트, 브랜딩, 타이포그래피처럼 눈에 들어온 이미지를 이곳에 모아 두세요. 파일을 끌어다 놓거나, 복사한 이미지나 주소를 붙여넣어도 돼요." />
  );

  if (q) {
    title = `‘${q}’`;
    empty = (
      <div className="text-[15px] leading-relaxed text-graphite">
        <p>제목, 메모, 출처, 태그에서 ‘{q}’를 찾지 못했어요. 다른 단어로 찾아보세요.</p>
        <Link href="/" className="mt-3 inline-block text-ink underline underline-offset-4">
          검색 지우기
        </Link>
      </div>
    );
  } else if (tagIsTopic) {
    title = counts?.tags.find((t) => t.id === tagId)?.name ?? "태그";
    empty = <p className="text-[15px] leading-relaxed text-graphite">이 태그가 붙은 레퍼런스가 없어요.</p>;
  } else if (view === "favorites") {
    title = "즐겨찾기";
    empty = (
      <p className="text-[15px] leading-relaxed text-graphite">마음에 드는 레퍼런스에 하트를 누르면 여기에 모여요.</p>
    );
  } else if (categoryId) {
    title = counts?.categories.find((c) => c.id === categoryId)?.name ?? "카테고리";
    empty = <UploadCta text="이 카테고리에 넣은 레퍼런스가 아직 없어요. 이 화면에서 올리면 바로 이 카테고리로 들어가요." />;
  }

  return (
    <LibraryView
      base={base}
      title={title}
      description={q ? "제목, 메모, 출처, 태그에서 찾은 결과예요." : undefined}
      empty={empty}
      lockTag={tagIsTopic}
    />
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}
