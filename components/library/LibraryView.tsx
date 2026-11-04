"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useShell } from "@/components/shell/AppShell";
import { useToast } from "@/components/Toast";
import { MenuItem, Popover } from "@/components/Popover";
import { ChevronDownIcon, CloseIcon, HeartIcon, SlidersIcon } from "@/components/icons";
import { MasonryGrid, type TileActions } from "@/components/library/MasonryGrid";
import { ListControls } from "@/components/library/ListControls";
import { tr, useT } from "@/lib/i18n";
import { RefDetail } from "@/components/library/RefDetail";
import { SelectionBar } from "@/components/library/SelectionBar";
import { onRefCreated } from "@/lib/events";
import {
  PAGE_SIZE,
  addRefsToCollection,
  addTagToRefs,
  countRefs,
  deleteRefs,
  fetchRef,
  fetchRefs,
  gridPath,
  matchesFilter,
  removeRefsFromCollection,
  signedUrls,
  updateRef,
  updateRefs,
  type Ref,
  type RefFilter,
} from "@/lib/refs";

// 빈 화면에 깔리는 자리 칸들의 비율 (실제 레퍼런스가 쌓일 모양을 미리 보여 줌)
const GHOST_RATIOS = [
  "3 / 4", "1 / 1", "4 / 5", "2 / 3", "5 / 4", "3 / 4", "4 / 3",
  "2 / 3", "1 / 1", "3 / 5", "4 / 5", "5 / 4", "3 / 4", "1 / 1", "2 / 3",
];

export function GhostGrid({ animate }: { animate: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="columns-2 gap-4 md:columns-3 xl:columns-4"
      style={{
        maskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 95%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 95%)",
      }}
    >
      {GHOST_RATIOS.map((ratio, i) => (
        <div
          key={i}
          className={`${animate ? "ghost-tile" : ""} mb-4 break-inside-avoid bg-haze`}
          style={{ aspectRatio: ratio, animationDelay: animate ? `${120 + i * 45}ms` : undefined }}
        />
      ))}
    </div>
  );
}

type Props = {
  base: RefFilter;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  // 걸러낸 게 없는데 비어 있을 때
  empty: React.ReactNode;
  collectionId?: string;
  // 태그 페이지처럼 이미 태그로 걸러진 화면이면 태그 필터를 숨김
  lockTag?: boolean;
  // 제목 아래 카테고리 칩으로 걸러내기 (주소의 ?category= 사용)
  categoryFilter?: boolean;
};

// 수정 후에도 이 목록에 남아 있어야 하는지 (즐겨찾기·카테고리 화면에서 조건이 바뀐 경우)
function stillBelongs(ref: Ref, f: RefFilter) {
  if (f.favorites && !ref.is_favorite) return false;
  if (f.categoryId && ref.category_id !== f.categoryId) return false;
  return true;
}

const chip =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors";
const chipOn = "border-ink bg-ink text-paper";
const chipOff = "border-hairline text-ink hover:border-ink";

export function LibraryView({ base, title, description, actions, empty, collectionId, lockTag, categoryFilter }: Props) {
  const { counts, reloadCounts, openNewCollection } = useShell();
  const { show } = useToast();
  const { t, cat: catName } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openId = params.get("ref");

  // 화면 위쪽 걸러내기(태그, 즐겨찾기만, 정렬)는 주소에 기록 → 새로고침해도 유지
  const tagParam = lockTag ? null : params.get("tag");
  const favParam = params.get("fav") === "1";
  const oldest = params.get("sort") === "oldest";
  const catParam = categoryFilter ? params.get("category") : null;

  const filter = useMemo<RefFilter>(
    () => ({
      ...base,
      categoryId: base.categoryId ?? catParam,
      tagId: base.tagId ?? tagParam,
      favorites: base.favorites || favParam,
      oldestFirst: oldest,
    }),
    [base, catParam, tagParam, favParam, oldest]
  );
  const filterKey = JSON.stringify(filter);
  // 컬렉션 안에서 카테고리로 거른 경우도 '걸러낸 상태'로 봄
  const refining = !!(tagParam || (favParam && !base.favorites) || (catParam && base.collectionId));

  const [items, setItems] = useState<Ref[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailRef, setDetailRef] = useState<Ref | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const lastPicked = useRef<string | null>(null);

  const loadingMore = useRef(false);
  const generation = useRef(0);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null) next.delete(key);
      else next.set(key, value);
      next.delete("ref");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  const addUrls = useCallback(async (list: Ref[]) => {
    if (!list.length) return;
    try {
      const map = await signedUrls(list.map(gridPath));
      setUrls((prev) => ({ ...prev, ...map }));
    } catch {
      // 주소를 못 받아도 대표색 칸은 보이므로 조용히 넘어감
    }
  }, []);

  const loadFirst = useCallback(() => {
    const gen = ++generation.current;
    const f = filterRef.current;
    setLoading(true);
    setLoadError(null);
    countRefs(f)
      .then((n) => gen === generation.current && setTotal(n))
      .catch(() => {});
    fetchRefs(f, 0)
      .then(async (list) => {
        if (gen !== generation.current) return;
        setItems(list);
        setHasMore(list.length === PAGE_SIZE);
        await addUrls(list);
      })
      .catch((e: { message?: string }) => gen === generation.current && setLoadError(e.message ?? tr("불러오지 못했어요.")))
      .finally(() => gen === generation.current && setLoading(false));
  }, [addUrls]);

  // 보는 곳이나 거름망이 바뀌면 처음부터
  useEffect(() => {
    setItems([]);
    setTotal(null);
    setHasMore(false);
    setSelectMode(false);
    setSelected(new Set());
    loadFirst();
  }, [filterKey, loadFirst]);

  // 다음 페이지
  const loadMore = useCallback(async () => {
    if (loadingMore.current || !hasMore) return;
    loadingMore.current = true;
    const gen = generation.current;
    try {
      const list = await fetchRefs(filterRef.current, items.length);
      if (gen !== generation.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...list.filter((r) => !seen.has(r.id))];
      });
      setHasMore(list.length === PAGE_SIZE);
      await addUrls(list);
    } catch {
      show(t("더 불러오지 못했어요. 잠시 후 다시 스크롤해 주세요."));
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

  // 새로 올린 이미지
  useEffect(
    () =>
      onRefCreated((ref) => {
        const f = filterRef.current;
        if (f.oldestFirst) return;
        if (f.collectionId) {
          // 컬렉션 화면에서 올린 건 컬렉션에 들어가므로 바로 보여 줌
          if (f.q || f.tagId || (f.favorites && !ref.is_favorite)) return;
        } else if (!matchesFilter(ref, f)) {
          return;
        }
        setItems((prev) => (prev.some((r) => r.id === ref.id) ? prev : [ref, ...prev]));
        setTotal((n) => (n === null ? n : n + 1));
        void addUrls([ref]);
      }),
    [addUrls]
  );

  // 상세 화면: 주소의 ?ref= 로 열고 닫음
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

  const applyChanges = useCallback(
    (updated: Ref[]) => {
      const byId = new Map(updated.map((r) => [r.id, r]));
      const f = filterRef.current;
      let removed = 0;
      setItems((prev) =>
        prev.flatMap((r) => {
          const u = byId.get(r.id);
          if (!u) return [r];
          if (!stillBelongs(u, f)) {
            removed++;
            return [];
          }
          return [u];
        })
      );
      if (removed) setTotal((n) => (n === null ? n : Math.max(0, n - removed)));
      setDetailRef((cur) => (cur && byId.has(cur.id) ? byId.get(cur.id)! : cur));
      void reloadCounts();
    },
    [reloadCounts]
  );

  const removeLocal = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setItems((prev) => prev.filter((r) => !set.has(r.id)));
    setTotal((n) => (n === null ? n : Math.max(0, n - ids.length)));
    setSelected((prev) => new Set([...prev].filter((id) => !set.has(id))));
  }, []);

  const toggleFavorite = useCallback(
    async (r: Ref) => {
      const optimistic = { ...r, is_favorite: !r.is_favorite };
      setItems((prev) => prev.map((x) => (x.id === r.id ? optimistic : x)));
      try {
        applyChanges([await updateRef(r.id, { is_favorite: optimistic.is_favorite })]);
      } catch {
        setItems((prev) => prev.map((x) => (x.id === r.id ? r : x)));
        show(t("즐겨찾기를 바꾸지 못했어요."));
      }
    },
    [applyChanges, show]
  );

  // ---------- 여러 장 선택 ----------

  const toggleSelect = useCallback(
    (r: Ref, range: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (range && lastPicked.current) {
          // Shift + 클릭: 사이에 있는 것까지 한꺼번에
          const a = items.findIndex((x) => x.id === lastPicked.current);
          const b = items.findIndex((x) => x.id === r.id);
          if (a >= 0 && b >= 0) {
            const [from, to] = a < b ? [a, b] : [b, a];
            items.slice(from, to + 1).forEach((x) => next.add(x.id));
            return next;
          }
        }
        if (next.has(r.id)) next.delete(r.id);
        else next.add(r.id);
        return next;
      });
      lastPicked.current = r.id;
    },
    [items]
  );

  const exitSelect = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
    lastPicked.current = null;
  }, []);

  useEffect(() => {
    if (!selectMode) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") exitSelect();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(items.map((r) => r.id)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectMode, exitSelect, items]);

  const selectedRefs = useMemo(() => items.filter((r) => selected.has(r.id)), [items, selected]);
  const ids = useMemo(() => selectedRefs.map((r) => r.id), [selectedRefs]);

  async function runBulk(work: () => Promise<void>, failMessage: string) {
    setBusy(true);
    try {
      await work();
    } catch {
      show(failMessage);
    } finally {
      setBusy(false);
    }
  }

  // ---------- 카드 위 버튼 ----------

  const tileActions: TileActions = {
    collections: counts?.collections ?? [],
    onToggleFavorite: (r) => void toggleFavorite(r),
    onAddToCollection: (r, cid) =>
      void addRefsToCollection(cid, [r.id])
        .then(() => {
          void reloadCounts();
          const name = counts?.collections.find((c) => c.id === cid)?.name ?? "";
          show(t("‘{name}’ 컬렉션에 넣었어요", { name }));
        })
        .catch(() => show(t("컬렉션에 넣지 못했어요."))),
    onNewCollection: (r) => openNewCollection({ refIds: [r.id], stay: true }),
    onOpenOriginal: (r) => {
      // 팝업 차단을 피하려고 창을 먼저 열고, 주소를 받은 뒤 채움
      const w = window.open("about:blank", "_blank");
      signedUrls([r.storage_path])
        .then((m) => {
          const url = m[r.storage_path];
          if (!url) throw new Error();
          if (w) {
            w.opener = null;
            w.location.href = url;
          } else window.location.href = url;
        })
        .catch(() => {
          w?.close();
          show(t("원본을 열지 못했어요."));
        });
    },
    onDelete: (r) =>
      void deleteRefs([r])
        .then(() => {
          removeLocal([r.id]);
          void reloadCounts();
          show(t("레퍼런스를 삭제했어요"));
        })
        .catch(() => show(t("삭제하지 못했어요."))),
  };

  // ---------- 화면 ----------

  const tags = counts?.tags ?? [];
  const activeTag = tagParam ? tags.find((tg) => tg.id === tagParam) : null;
  const showEmpty = !loading && !loadError && items.length === 0;
  const index = detailRef ? items.findIndex((r) => r.id === detailRef.id) : -1;
  const prev = index > 0 ? items[index - 1] : null;
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : null;

  return (
    <div>
      <header className="mb-10 flex flex-col gap-6 md:mb-12 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="break-keep text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[52px] lg:text-[68px]">
            {title}
            <sup className="ml-2 align-super text-[13px] font-normal tracking-normal text-graphite tabular-nums sm:text-[15px]">{total ?? ""}</sup>
          </h1>
          {description && <div className="mt-4 max-w-xl text-[15px] leading-relaxed text-graphite">{description}</div>}
          {/* 비어 있을 때 안내(이미지 올리기 버튼 등)는 서브카피 바로 아래 */}
          {showEmpty && !refining && <div className="mt-6 max-w-md">{empty}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </header>

      {/* 카테고리 칩 + 정렬 · 필터 · 선택 (비어 있어도 같은 자리에 고정) */}
      {
        <div className="mb-5 flex items-center gap-3">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] lg:flex-wrap lg:overflow-visible">
            {/* 카테고리를 고르면 제목·사이드바가 이미 보여 주므로 칩 줄은 숨김 */}
            {categoryFilter && !catParam && (
              <>
                <button type="button" onClick={() => setParam("category", null)} aria-pressed className={`${chip} ${chipOn} max-md:hidden`}>
                  {t("전체@chip")}
                </button>
                {(counts?.categories ?? []).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setParam("category", c.id === catParam ? null : c.id)}
                    aria-pressed={c.id === catParam}
                    className={`${chip} ${c.id === catParam ? chipOn : chipOff} max-md:hidden`}
                  >
                    {catName(c.name)}
                  </button>
                ))}
              </>
            )}
            {/* 컬렉션 안에서는 제목이 컬렉션 이름이라, 고른 카테고리를 지울 수 있게 하나만 보여 줌 */}
            {categoryFilter && catParam && base.collectionId && (
              <span className={`${chip} ${chipOn} pr-1.5`}>
                {catName(counts?.categories.find((c) => c.id === catParam)?.name ?? "") || t("카테고리")}
                <button
                  type="button"
                  onClick={() => setParam("category", null)}
                  aria-label={t("카테고리 거름망 지우기")}
                  className="grid h-6 w-6 place-items-center rounded-full hover:bg-paper/15"
                >
                  <CloseIcon size={12} />
                </button>
              </span>
            )}
            {activeTag && (
              <span className={`${chip} ${chipOn} pr-1.5`}>
                {activeTag.name}
                <button
                  type="button"
                  onClick={() => setParam("tag", null)}
                  aria-label={t("태그 거름망 지우기")}
                  className="grid h-6 w-6 place-items-center rounded-full hover:bg-paper/15"
                >
                  <CloseIcon size={12} />
                </button>
              </span>
            )}
            {favParam && !base.favorites && (
              <span className={`${chip} ${chipOn} pr-1.5`}>
                <HeartIcon size={13} className="fill-current" />
                {t("즐겨찾기만")}
                <button
                  type="button"
                  onClick={() => setParam("fav", null)}
                  aria-label={t("즐겨찾기 거름망 지우기")}
                  className="grid h-6 w-6 place-items-center rounded-full hover:bg-paper/15"
                >
                  <CloseIcon size={12} />
                </button>
              </span>
            )}
          </div>

          <ListControls
            sort={oldest ? "oldest" : "newest"}
            sortOptions={[
              { value: "newest", label: "최신순" },
              { value: "oldest", label: "오래된순" },
            ]}
            onSort={(v) => setParam("sort", v === "oldest" ? "oldest" : null)}
            filterActive={!!(tagParam || (favParam && !base.favorites))}
            filter={(close) => (
              <div>
                {!base.favorites && (
                  <>
                    <MenuItem active={favParam} onClick={() => setParam("fav", favParam ? null : "1")}>
                      <span className="inline-flex items-center gap-2">
                        <HeartIcon size={14} /> {t("즐겨찾기만 보기")}
                      </span>
                    </MenuItem>
                    <div className="my-1 h-px bg-hairline" />
                  </>
                )}
                {!lockTag && (
                  <>
                    <p className="px-3 pb-1 pt-1.5 text-[12px] text-graphite">{t("태그")}</p>
                    {tags.filter((tg) => tg.ref_count > 0).length === 0 ? (
                      <p className="px-3 pb-2.5 text-[13px] leading-relaxed text-graphite">
                        {t("아직 태그가 없어요. 이미지를 열어 태그를 붙여 보세요.")}
                      </p>
                    ) : (
                      <div className="max-h-64 overflow-y-auto">
                        {tags
                          .filter((tg) => tg.ref_count > 0)
                          .map((tg) => (
                            <MenuItem
                              key={tg.id}
                              active={tg.id === tagParam}
                              onClick={() => {
                                setParam("tag", tg.id === tagParam ? null : tg.id);
                                close();
                              }}
                            >
                              {tg.name} <span className="text-graphite">{tg.ref_count}</span>
                            </MenuItem>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            selectMode={selectMode}
            onToggleSelect={() => (selectMode ? exitSelect() : setSelectMode(true))}
            selectDisabled={items.length === 0}
          />
        </div>
      }

      {showEmpty && refining && (
        <p className="mb-10 max-w-md text-[15px] leading-relaxed text-graphite">
          {t("조건에 맞는 레퍼런스가 없어요. 위의 거름망을 풀어 보세요.")}
        </p>
      )}
      {loadError && <p className="mb-8 text-[15px] text-red-600">{t("레퍼런스를 불러오지 못했어요: {msg}", { msg: loadError })}</p>}

      {(loading && items.length === 0) || (showEmpty && !refining) ? <GhostGrid animate={showEmpty} /> : null}

      {items.length > 0 && (
        <MasonryGrid
          items={items}
          urls={urls}
          onOpen={openRef}
          actions={tileActions}
          selectMode={selectMode}
          selected={selected}
          onToggleSelect={toggleSelect}
        />
      )}

      <div ref={sentinel} className="h-px" />
      {hasMore && items.length > 0 && (
        <div className="flex justify-center py-10">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-hairline border-t-ink" />
        </div>
      )}

      {selectMode && (
        <SelectionBar
          count={selected.size}
          total={items.length}
          allFavorite={selectedRefs.length > 0 && selectedRefs.every((r) => r.is_favorite)}
          categories={counts?.categories ?? []}
          collections={counts?.collections ?? []}
          tags={tags}
          inCollectionId={collectionId}
          busy={busy}
          onSelectAll={() => setSelected(new Set(items.map((r) => r.id)))}
          onCancel={exitSelect}
          onFavorite={(v) =>
            void runBulk(async () => {
              applyChanges(await updateRefs(ids, { is_favorite: v }));
              show(v ? t("{n}개를 즐겨찾기에 넣었어요", { n: ids.length }) : t("{n}개를 즐겨찾기에서 뺐어요", { n: ids.length }));
            }, t("즐겨찾기를 바꾸지 못했어요."))
          }
          onCategory={(cat) =>
            void runBulk(async () => {
              applyChanges(await updateRefs(ids, { category_id: cat }));
              const name = counts?.categories.find((c) => c.id === cat)?.name;
              show(name ? t("{n}개를 ‘{name}’로 옮겼어요", { n: ids.length, name: catName(name) }) : t("{n}개의 카테고리를 뺐어요", { n: ids.length }));
            }, t("카테고리를 바꾸지 못했어요."))
          }
          onTag={(name) =>
            void runBulk(async () => {
              const tag = await addTagToRefs(ids, name);
              void reloadCounts();
              show(t("{n}개에 ‘{name}’ 태그를 붙였어요", { n: ids.length, name: tag.name }));
            }, t("태그를 붙이지 못했어요."))
          }
          onAddToCollection={(cid) =>
            void runBulk(async () => {
              await addRefsToCollection(cid, ids);
              void reloadCounts();
              const name = counts?.collections.find((c) => c.id === cid)?.name ?? "";
              show(t("{n}개를 ‘{name}’에 넣었어요", { n: ids.length, name }));
            }, t("컬렉션에 넣지 못했어요."))
          }
          onNewCollection={() => openNewCollection({ refIds: ids, stay: true })}
          onRemoveFromCollection={() =>
            void runBulk(async () => {
              if (!collectionId) return;
              await removeRefsFromCollection(collectionId, ids);
              removeLocal(ids);
              void reloadCounts();
              show(t("{n}개를 컬렉션에서 뺐어요", { n: ids.length }));
            }, t("컬렉션에서 빼지 못했어요."))
          }
          onDelete={() =>
            void runBulk(async () => {
              const n = selectedRefs.length;
              await deleteRefs(selectedRefs);
              removeLocal(selectedRefs.map((r) => r.id));
              void reloadCounts();
              show(t("{n}개를 삭제했어요", { n }));
            }, t("삭제하지 못했어요."))
          }
        />
      )}

      {detailRef && (
        <RefDetail
          item={detailRef}
          categories={counts?.categories ?? []}
          collections={counts?.collections ?? []}
          onClose={closeRef}
          onPrev={prev ? () => moveTo(prev) : undefined}
          onNext={next ? () => moveTo(next) : undefined}
          onChange={(r) => applyChanges([r])}
          onCollectionsChanged={(inCurrent) => {
            void reloadCounts();
            if (collectionId && !inCurrent) removeLocal([detailRef.id]);
          }}
          currentCollectionId={collectionId}
          onDeleted={(r) => {
            removeLocal([r.id]);
            void reloadCounts();
            closeRef();
            show(t("레퍼런스를 삭제했어요"));
          }}
        />
      )}
    </div>
  );
}
