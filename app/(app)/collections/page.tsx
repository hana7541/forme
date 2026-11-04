"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/Toast";
import { MenuItem } from "@/components/Popover";
import { ListControls, ListSelectionBar, type SortOption } from "@/components/library/ListControls";
import { deleteCollection } from "@/lib/collections";
import { useT } from "@/lib/i18n";
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
  const frame = "grid aspect-[4/3] gap-[3px] overflow-hidden";

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

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute left-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full border-[1.5px] ${
        on ? "border-ink bg-ink text-paper" : "border-white bg-black/15"
      }`}
    >
      {on && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

const SORTS: SortOption[] = [
  { value: "recent", label: "최근 수정순" },
  { value: "oldest", label: "만든 순" },
  { value: "name", label: "이름순" },
];

function CollectionsScreen() {
  const { counts, openNewCollection, reloadCounts } = useShell();
  const { show } = useToast();
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const all = counts?.collections ?? null;
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // 정렬·필터는 주소에 기록 → 새로고침해도 유지
  const sort = SORTS.some((o) => o.value === params.get("sort")) ? (params.get("sort") as string) : "recent";
  const hideEmpty = params.get("hideEmpty") === "1";
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const collections = useMemo(() => {
    if (!all) return null;
    const list = hideEmpty ? all.filter((c) => c.ref_count > 0) : [...all];
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    else if (sort === "oldest") list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    else list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return list;
  }, [all, sort, hideEmpty]);

  useEffect(() => {
    if (!all?.length) return;
    const paths = all.flatMap((c) => c.preview_paths);
    if (!paths.length) return;
    signedUrls(paths)
      .then((m) => setUrls((prev) => ({ ...prev, ...m })))
      .catch(() => {});
  }, [all]);

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
    setConfirming(false);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function removeSelected() {
    setBusy(true);
    try {
      const ids = [...selected];
      for (const id of ids) await deleteCollection(id);
      await reloadCounts();
      show(t("컬렉션 {n}개를 지웠어요", { n: ids.length }));
      exitSelect();
    } catch {
      show(t("컬렉션을 지우지 못했어요."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="mb-10 flex flex-col gap-6 md:mb-12 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[52px] lg:text-[68px]">
            {t("컬렉션@nav")}
            <sup className="ml-2 align-super text-[13px] font-normal tracking-normal text-graphite tabular-nums sm:text-[15px]">
              {all?.length ?? ""}
            </sup>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-graphite">
            {t("프로젝트별로 레퍼런스를 묶어 두는 곳이에요. 한 이미지를 여러 컬렉션에 넣을 수 있어요.")}
          </p>
          {all && all.length === 0 && (
            <button
              type="button"
              onClick={() => openNewCollection()}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-ink px-5 text-[14px] font-medium transition-colors hover:bg-ink hover:text-paper"
            >
              <PlusIcon size={16} />
              {t("새 컬렉션")}
            </button>
          )}
        </div>
        {all && all.length > 0 && (
          <button
            type="button"
            onClick={() => openNewCollection()}
            className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-full border border-ink px-5 text-[14px] font-medium transition-colors hover:bg-ink hover:text-paper md:self-auto"
          >
            <PlusIcon size={16} />
            {t("새 컬렉션")}
          </button>
        )}
      </header>

      {/* 정렬 · 필터 · 선택 (그리드 바로 위 오른쪽) */}
      <div className="mb-5 flex items-center gap-3">
        <ListControls
          sort={sort}
          sortOptions={SORTS}
          onSort={(v) => setParam("sort", v === "recent" ? null : v)}
          filterActive={hideEmpty}
          filter={() => (
            <MenuItem active={hideEmpty} onClick={() => setParam("hideEmpty", hideEmpty ? null : "1")}>
              {t("비어 있는 컬렉션 숨기기")}
            </MenuItem>
          )}
          selectMode={selectMode}
          onToggleSelect={() => (selectMode ? exitSelect() : setSelectMode(true))}
          selectDisabled={!collections?.length}
        />
      </div>

      {collections === null && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="aspect-[4/3] bg-haze" />
          ))}
        </div>
      )}

      {collections && collections.length === 0 && all && all.length > 0 && (
        <p className="max-w-md text-[15px] leading-relaxed text-graphite">{t("조건에 맞는 컬렉션이 없어요. 필터를 풀어 보세요.")}</p>
      )}

      {collections && collections.length > 0 && (
        <ul className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {collections.map((c) => {
            const on = selected.has(c.id);
            const inner = (
              <>
                <div className={`relative transition-[opacity,transform] duration-200 group-hover:opacity-90 ${on ? "scale-[0.96]" : ""}`}>
                  <Mosaic c={c} urls={urls} />
                  {selectMode && <Check on={on} />}
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <p className="truncate text-[16px] font-medium tracking-[-0.01em] group-hover:underline group-hover:underline-offset-4">
                    {c.name}
                  </p>
                  <p className="shrink-0 text-[13px] tabular-nums text-graphite">{c.ref_count}</p>
                </div>
                {c.description && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-graphite">{c.description}</p>}
              </>
            );
            return (
              <li key={c.id}>
                {selectMode ? (
                  <button type="button" onClick={() => toggle(c.id)} aria-pressed={on} className="group block w-full text-left">
                    {inner}
                  </button>
                ) : (
                  <Link href={`/collections/${c.id}`} className="group block">
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {selectMode && (
        <ListSelectionBar
          count={selected.size}
          total={collections?.length ?? 0}
          noun={t("컬렉션@noun")}
          note={t("컬렉션만 지워지고, 안의 이미지는 라이브러리에 남아요.")}
          busy={busy}
          confirming={confirming}
          onConfirm={() => void removeSelected()}
          onCancelConfirm={() => setConfirming(false)}
          onAskDelete={() => setConfirming(true)}
          onSelectAll={() => setSelected(new Set((collections ?? []).map((c) => c.id)))}
          onClose={exitSelect}
        />
      )}
    </div>
  );
}

export default function CollectionsPage() {
  return (
    <Suspense fallback={null}>
      <CollectionsScreen />
    </Suspense>
  );
}
