"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/shell/AppShell";
import { PlusIcon } from "@/components/icons";
import { signedUrls } from "@/lib/refs";
import type { CollectionPreview } from "@/lib/collections";

function Cell({ path, color, urls, className = "" }: { path?: string; color?: string; urls: Record<string, string>; className?: string }) {
  return (
    <div className={`overflow-hidden bg-haze ${className}`} style={{ backgroundColor: path ? color : undefined }}>
      {path && urls[path] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={urls[path]} alt="" loading="lazy" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

// 카드 미리보기: 1장이면 꽉 차게, 2장이면 반반, 3장 이상이면 왼쪽 크게 + 오른쪽 두 칸
function Mosaic({ c, urls }: { c: CollectionPreview; urls: Record<string, string> }) {
  const p = c.preview_paths;
  const col = c.preview_colors;
  const frame = "grid aspect-[4/3] gap-[3px] overflow-hidden rounded-[3px]";

  if (p.length <= 1) return <div className={frame}><Cell path={p[0]} color={col[0]} urls={urls} /></div>;
  if (p.length === 2)
    return (
      <div className={`${frame} grid-cols-2`}>
        <Cell path={p[0]} color={col[0]} urls={urls} />
        <Cell path={p[1]} color={col[1]} urls={urls} />
      </div>
    );
  return (
    <div className={`${frame} grid-cols-[2fr_1fr] grid-rows-2`}>
      <Cell path={p[0]} color={col[0]} urls={urls} className="row-span-2" />
      <Cell path={p[1]} color={col[1]} urls={urls} />
      <Cell path={p[2]} color={col[2]} urls={urls} />
    </div>
  );
}

export default function CollectionsPage() {
  const { counts, openNewCollection } = useShell();
  const collections = counts?.collections ?? null;
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!collections?.length) return;
    const paths = collections.flatMap((c) => c.preview_paths);
    if (!paths.length) return;
    signedUrls(paths)
      .then((m) => setUrls((prev) => ({ ...prev, ...m })))
      .catch(() => {});
  }, [collections]);

  return (
    <div>
      <header className="mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[52px] lg:text-[68px]">
            컬렉션
            <sup className="ml-2 align-super text-[13px] font-normal tracking-normal text-graphite tabular-nums sm:text-[15px]">
              {collections?.length ?? ""}
            </sup>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-graphite">
            프로젝트별로 레퍼런스를 묶어 두는 곳이에요. 한 이미지를 여러 컬렉션에 넣을 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openNewCollection()}
          className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-full border border-ink px-5 text-[14px] font-medium transition-colors hover:bg-ink hover:text-paper md:self-auto"
        >
          <PlusIcon size={16} />새 컬렉션
        </button>
      </header>

      {collections === null && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="aspect-[4/3] rounded-[3px] bg-haze" />
          ))}
        </div>
      )}

      {collections && collections.length === 0 && (
        <div className="max-w-md">
          <p className="text-[15px] leading-relaxed text-graphite">
            아직 컬렉션이 없어요. 새 컬렉션을 만든 뒤, 라이브러리에서 ‘선택’으로 여러 장을 골라 넣어 보세요.
          </p>
        </div>
      )}

      {collections && collections.length > 0 && (
        <ul className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {collections.map((c) => (
            <li key={c.id}>
              <Link href={`/collections/${c.id}`} className="group block">
                <div className="transition-opacity duration-200 group-hover:opacity-90">
                  <Mosaic c={c} urls={urls} />
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <p className="truncate text-[16px] font-medium tracking-[-0.01em] group-hover:underline group-hover:underline-offset-4">
                    {c.name}
                  </p>
                  <p className="shrink-0 text-[13px] tabular-nums text-graphite">{c.ref_count}</p>
                </div>
                {c.description && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-graphite">{c.description}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
