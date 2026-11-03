"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useShell } from "@/components/shell/AppShell";
import { useToast } from "@/components/Toast";
import { UploadIcon } from "@/components/icons";
import { MasonryGrid } from "@/components/library/MasonryGrid";
import { RefDetail } from "@/components/library/RefDetail";
import { onRefCreated } from "@/lib/events";
import {
  PAGE_SIZE,
  fetchRef,
  fetchRefs,
  gridPath,
  matchesFilter,
  signedUrls,
  updateRef,
  type Ref,
  type RefFilter,
} from "@/lib/refs";

// 빈 화면에 깔리는 자리 칸들의 비율 (실제 레퍼런스가 쌓일 모양을 미리 보여 줌)
const GHOST_RATIOS = [
  "3 / 4", "1 / 1", "4 / 5", "2 / 3", "5 / 4", "3 / 4", "4 / 3",
  "2 / 3", "1 / 1", "3 / 5", "4 / 5", "5 / 4", "3 / 4", "1 / 1", "2 / 3",
];

type Kind = "all" | "favorites" | "category" | "search";

function useView() {
  const params = useSearchParams();
  const { counts } = useShell();
  const view = params.get("view");
  const categoryId = params.get("category");
  const q = params.get("q");

  if (q) return { title: `‘${q}’`, count: undefined, kind: "search" as Kind, q, filter: null };
  if (view === "favorites")
    return { title: "즐겨찾기", count: counts?.favorites, kind: "favorites" as Kind, q: undefined, filter: { favorites: true } as RefFilter };
  if (categoryId) {
    const c = counts?.categories.find((x) => x.id === categoryId);
    return { title: c?.name ?? "카테고리", count: c?.count, kind: "category" as Kind, q: undefined, filter: { categoryId } as RefFilter };
  }
  return { title: "전체", count: counts?.total, kind: "all" as Kind, q: undefined, filter: {} as RefFilter };
}

function EmptyMessage({ kind, q }: { kind: Kind; q?: string }) {
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
        <p>검색은 STEP 09에서 열려요. 지금은 사이드바에서 카테고리로 찾아보세요.</p>
        {q && (
          <Link href="/" className="mt-3 inline-block text-ink underline underline-offset-4">
            검색 지우기
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <p className="text-[15px] leading-relaxed text-graphite">
        {kind === "category"
          ? "이 카테고리에 넣은 레퍼런스가 아직 없어요. 이 화면에서 올리면 바로 이 카테고리로 들어가요."
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

function GhostGrid({ animate }: { animate: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4 2xl:columns-5"
      style={{
        maskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 95%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 95%)",
      }}
    >
      {GHOST_RATIOS.map((ratio, i) => (
        <div
          key={i}
          className={`${animate ? "ghost-tile" : ""} mb-3 break-inside-avoid rounded-[3px] bg-haze sm:mb-4`}
          style={{ aspectRatio: ratio, animationDelay: animate ? `${120 + i * 45}ms` : undefined }}
        />
      ))}
    </div>
  );
}

function LibraryView() {
  const { title, count, kind, q, filter } = useView();
  const { counts, reloadCounts } = useShell();
  const { show } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openId = params.get("ref");

  const [items, setItems] = useState<Ref[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailRef, setDetailRef] = useState<Ref | null>(null);

  const filterKey = filter ? JSON.stringify(filter) : "search";
  const loadingMore = useRef(false);
  const generation = useRef(0);
  const filterRef = useRef<RefFilter | null>(filter);
  filterRef.current = filter;

  const addUrls = useCallback(async (list: Ref[]) => {
    if (!list.length) return;
    try {
      const map = await signedUrls(list.map(gridPath));
      setUrls((prev) => ({ ...prev, ...map }));
    } catch {
      // 주소를 못 받아도 대표색 칸은 보이므로 조용히 넘어감
    }
  }, []);

  // 첫 페이지 불러오기 (보는 곳이 바뀔 때마다)
  useEffect(() => {
    const gen = ++generation.current;
    setItems([]);
    setHasMore(false);
    setLoadError(null);
    if (!filter) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchRefs(filter, 0)
      .then(async (list) => {
        if (gen !== generation.current) return;
        setItems(list);
        setHasMore(list.length === PAGE_SIZE);
        await addUrls(list);
      })
      .catch((e: { message?: string }) => gen === generation.current && setLoadError(e.message ?? "불러오지 못했어요."))
      .finally(() => gen === generation.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, addUrls]);

  // 다음 페이지 (스크롤이 바닥 근처에 오면)
  const loadMore = useCallback(async () => {
    const f = filterRef.current;
    if (!f || loadingMore.current || !hasMore) return;
    loadingMore.current = true;
    const gen = generation.current;
    try {
      const list = await fetchRefs(f, items.length);
      if (gen !== generation.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...list.filter((r) => !seen.has(r.id))];
      });
      setHasMore(list.length === PAGE_SIZE);
      await addUrls(list);
    } catch {
      show("더 불러오지 못했어요. 잠시 후 다시 스크롤해 주세요.");
    } finally {
      loadingMore.current = false;
    }
  }, [hasMore, items.length, addUrls, show]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), {
      rootMargin: "800px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // 새로 올린 이미지를 맨 앞에 끼워 넣기
  useEffect(
    () =>
      onRefCreated((ref) => {
        const f = filterRef.current;
        if (!f || !matchesFilter(ref, f)) return;
        setItems((prev) => (prev.some((r) => r.id === ref.id) ? prev : [ref, ...prev]));
        void addUrls([ref]);
      }),
    [addUrls]
  );

  // 상세 화면: 주소의 ?ref= 로 열고 닫음 (뒤로 가기로도 닫힘)
  useEffect(() => {
    if (!openId) {
      setDetailRef(null);
      return;
    }
    const inList = items.find((r) => r.id === openId);
    if (inList) {
      setDetailRef(inList);
      return;
    }
    let cancelled = false;
    fetchRef(openId)
      .then((r) => !cancelled && setDetailRef(r))
      .catch(() => !cancelled && setDetailRef(null));
    return () => {
      cancelled = true;
    };
  }, [openId, items]);

  const urlWith = useCallback(
    (refId: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (refId) next.set("ref", refId);
      else next.delete("ref");
      const qs = next.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [params, pathname]
  );

  const openRef = useCallback((r: Ref) => router.push(urlWith(r.id), { scroll: false }), [router, urlWith]);
  const closeRef = useCallback(() => router.replace(urlWith(null), { scroll: false }), [router, urlWith]);
  const moveTo = useCallback((r: Ref) => router.replace(urlWith(r.id), { scroll: false }), [router, urlWith]);

  // 상세 화면에서 바꾼 내용을 그리드에도 반영
  const applyChange = useCallback(
    (updated: Ref) => {
      setItems((prev) => {
        const f = filterRef.current;
        const stillFits = f ? matchesFilter(updated, f) : true;
        return stillFits ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev.filter((r) => r.id !== updated.id);
      });
      setDetailRef((cur) => (cur && cur.id === updated.id ? updated : cur));
      void reloadCounts();
    },
    [reloadCounts]
  );

  const applyDelete = useCallback(
    (deleted: Ref) => {
      setItems((prev) => prev.filter((r) => r.id !== deleted.id));
      void reloadCounts();
    },
    [reloadCounts]
  );

  const toggleFavorite = useCallback(
    async (r: Ref) => {
      const optimistic = { ...r, is_favorite: !r.is_favorite };
      setItems((prev) => prev.map((x) => (x.id === r.id ? optimistic : x)));
      try {
        const saved = await updateRef(r.id, { is_favorite: optimistic.is_favorite });
        applyChange(saved);
      } catch {
        setItems((prev) => prev.map((x) => (x.id === r.id ? r : x)));
        show("즐겨찾기를 바꾸지 못했어요.");
      }
    },
    [applyChange, show]
  );

  const index = detailRef ? items.findIndex((r) => r.id === detailRef.id) : -1;
  const prev = index > 0 ? items[index - 1] : null;
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : null;

  const showEmpty = !loading && !loadError && items.length === 0;
  const categories = useMemo(() => counts?.categories ?? [], [counts]);

  return (
    <div>
      <header className="mb-10 md:mb-14">
        <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[52px] lg:text-[68px]">
          {title}
          <sup className="ml-2 align-super text-[13px] font-normal tracking-normal text-graphite tabular-nums sm:text-[15px]">
            {typeof count === "number" ? count : ""}
          </sup>
        </h1>
        {showEmpty && (
          <div className="mt-5">
            <EmptyMessage kind={kind} q={q} />
          </div>
        )}
        {loadError && (
          <p className="mt-5 text-[15px] text-red-600">레퍼런스를 불러오지 못했어요: {loadError}</p>
        )}
      </header>

      {(loading || showEmpty) && <GhostGrid animate={showEmpty} />}

      {items.length > 0 && (
        <MasonryGrid items={items} urls={urls} onOpen={openRef} onToggleFavorite={(r) => void toggleFavorite(r)} />
      )}

      <div ref={sentinel} className="h-px" />
      {hasMore && items.length > 0 && (
        <div className="flex justify-center py-10">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-hairline border-t-ink" />
        </div>
      )}

      {detailRef && (
        <RefDetail
          item={detailRef}
          categories={categories}
          onClose={closeRef}
          onPrev={prev ? () => moveTo(prev) : undefined}
          onNext={next ? () => moveTo(next) : undefined}
          onChange={applyChange}
          onDeleted={(r) => {
            applyDelete(r);
            closeRef();
            show("레퍼런스를 삭제했어요");
          }}
        />
      )}
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
