"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MenuItem } from "@/components/Popover";
import { ListControls, ListSelectionBar, type SortOption } from "@/components/library/ListControls";
import { useToast } from "@/components/Toast";
import { useShell } from "@/components/shell/AppShell";
import { PlusIcon } from "@/components/icons";
import { createMoodboard, deleteMoodboard, fetchMoodboards, type MoodboardWithItems } from "@/lib/moodboards";
import { tr, useT, type Lang } from "@/lib/i18n";
import { gridPath, signedUrls } from "@/lib/refs";

// 카드 미리보기: 보드 배치를 그대로 작게 줄여서 보여 줌
function BoardPreview({ board, urls }: { board: MoodboardWithItems; urls: Record<string, string> }) {
  const items = [...board.moodboard_items].sort((a, b) => a.z_index - b.z_index);
  if (!items.length) {
    return <div className="aspect-[4/3] border border-hairline" style={{ backgroundColor: board.background }} />;
  }
  const minX = Math.min(...items.map((i) => i.x));
  const minY = Math.min(...items.map((i) => i.y));
  const maxX = Math.max(...items.map((i) => i.x + i.width));
  const maxY = Math.max(...items.map((i) => i.y + i.height));
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  // 4:3 틀 안에 들어가도록 비율 맞춤
  const frame = 4 / 3;
  const contentRatio = w / h;
  const scaleW = contentRatio > frame ? 1 : contentRatio / frame;
  const scaleH = contentRatio > frame ? frame / contentRatio : 1;

  return (
    <div className="relative aspect-[4/3] overflow-hidden border border-hairline" style={{ backgroundColor: board.background }}>
      <div
        className="absolute"
        style={{
          left: `${(1 - scaleW * 0.86) * 50}%`,
          top: `${(1 - scaleH * 0.86) * 50}%`,
          width: `${scaleW * 86}%`,
          height: `${scaleH * 86}%`,
        }}
      >
        {items.slice(-40).map((i) => {
          const path = i.refs ? gridPath(i.refs) : null;
          return (
            <div
              key={i.id}
              className="absolute overflow-hidden"
              style={{
                left: `${((i.x - minX) / w) * 100}%`,
                top: `${((i.y - minY) / h) * 100}%`,
                width: `${(i.width / w) * 100}%`,
                height: `${(i.height / h) * 100}%`,
                backgroundColor: i.refs?.dominant_color ?? "#f4f4f2",
              }}
            >
              {path && urls[path] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[path]} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function timeAgo(iso: string, lang: Lang) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return tr("방금 고침", undefined, lang);
  if (diff < 3600) return tr("{n}분 전 고침", { n: Math.floor(diff / 60) }, lang);
  if (diff < 86400) return tr("{n}시간 전 고침", { n: Math.floor(diff / 3600) }, lang);
  const date = new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "ko-KR", { month: "short", day: "numeric" });
  return tr("{date} 고침", { date }, lang);
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

function MoodboardsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { show } = useToast();
  const { reloadCounts } = useShell();
  const { t, lang } = useT();
  const [boards, setBoards] = useState<MoodboardWithItems[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // 정렬·필터는 주소에 기록
  const sort = SORTS.some((o) => o.value === params.get("sort")) ? (params.get("sort") as string) : "recent";
  const fromCollection = params.get("from") === "collection";
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    fetchMoodboards()
      .then(async (list) => {
        setBoards(list);
        const paths = list.flatMap((b) => b.moodboard_items.slice(-40).flatMap((i) => (i.refs ? [gridPath(i.refs)] : [])));
        if (paths.length) setUrls(await signedUrls(paths));
      })
      .catch(() => setBoards([]));
  }, []);

  const shown = useMemo(() => {
    if (!boards) return null;
    const list = fromCollection ? boards.filter((b) => b.collection_id) : [...boards];
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    else if (sort === "oldest") list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    else list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return list;
  }, [boards, sort, fromCollection]);

  async function create() {
    setCreating(true);
    try {
      const board = await createMoodboard({ name: t("새 무드보드") });
      void reloadCounts();
      router.push(`/moodboards/${board.id}`);
    } catch {
      show(t("무드보드를 만들지 못했어요."));
      setCreating(false);
    }
  }

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
      for (const id of ids) await deleteMoodboard(id);
      setBoards((prev) => prev?.filter((b) => !selected.has(b.id)) ?? prev);
      void reloadCounts();
      show(t("무드보드 {n}개를 지웠어요", { n: ids.length }));
      exitSelect();
    } catch {
      show(t("무드보드를 지우지 못했어요."));
    } finally {
      setBusy(false);
    }
  }

  const newButton = (
    <button
      type="button"
      onClick={() => void create()}
      disabled={creating}
      className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-full border border-ink px-5 text-[14px] font-medium transition-colors hover:bg-ink hover:text-paper disabled:opacity-50 md:self-auto"
    >
      <PlusIcon size={16} />
      {creating ? t("만드는 중…") : t("새 무드보드")}
    </button>
  );

  return (
    <div>
      <header className="mb-10 flex flex-col gap-6 md:mb-12 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[52px] lg:text-[68px]">
            {t("무드보드@nav")}
            <sup className="ml-2 align-super text-[13px] font-normal tracking-normal text-graphite tabular-nums sm:text-[15px]">
              {boards?.length ?? ""}
            </sup>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-graphite">
            {t("레퍼런스를 캔버스 위에 자유롭게 놓고, 크기를 바꾸고, 겹쳐 보는 곳이에요. 컬렉션 화면에서 바로 만들 수도 있어요.")}
          </p>
          {boards && boards.length === 0 && <div className="mt-6">{newButton}</div>}
        </div>
        {boards && boards.length > 0 && newButton}
      </header>

      {/* 정렬 · 필터 · 선택 (그리드 바로 위 오른쪽) */}
      <div className="mb-5 flex items-center gap-3">
        <ListControls
          sort={sort}
          sortOptions={SORTS}
          onSort={(v) => setParam("sort", v === "recent" ? null : v)}
          filterActive={fromCollection}
          filter={() => (
            <MenuItem active={fromCollection} onClick={() => setParam("from", fromCollection ? null : "collection")}>
              {t("컬렉션에서 만든 보드만")}
            </MenuItem>
          )}
          selectMode={selectMode}
          onToggleSelect={() => (selectMode ? exitSelect() : setSelectMode(true))}
          selectDisabled={!shown?.length}
        />
      </div>

      {shown === null && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="aspect-[4/3] bg-haze" />
          ))}
        </div>
      )}

      {shown && shown.length === 0 && boards && boards.length > 0 && (
        <p className="max-w-md text-[15px] leading-relaxed text-graphite">{t("조건에 맞는 무드보드가 없어요. 필터를 풀어 보세요.")}</p>
      )}

      {shown && shown.length > 0 && (
        <ul className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((b) => {
            const on = selected.has(b.id);
            const inner = (
              <>
                <div className={`relative transition-[opacity,transform] duration-200 group-hover:opacity-90 ${on ? "scale-[0.96]" : ""}`}>
                  <BoardPreview board={b} urls={urls} />
                  {selectMode && <Check on={on} />}
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <p className="truncate text-[16px] font-medium tracking-[-0.01em] group-hover:underline group-hover:underline-offset-4">
                    {b.name}
                  </p>
                  <p className="shrink-0 text-[13px] tabular-nums text-graphite">{b.moodboard_items.length}</p>
                </div>
                <p className="mt-1 text-[13px] text-graphite">{timeAgo(b.updated_at, lang)}</p>
              </>
            );
            return (
              <li key={b.id}>
                {selectMode ? (
                  <button type="button" onClick={() => toggle(b.id)} aria-pressed={on} className="group block w-full text-left">
                    {inner}
                  </button>
                ) : (
                  <Link href={`/moodboards/${b.id}`} className="group block">
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
          total={shown?.length ?? 0}
          noun={t("무드보드@noun")}
          note={t("배치만 지워지고, 이미지는 라이브러리에 남아요.")}
          busy={busy}
          confirming={confirming}
          onConfirm={() => void removeSelected()}
          onCancelConfirm={() => setConfirming(false)}
          onAskDelete={() => setConfirming(true)}
          onSelectAll={() => setSelected(new Set((shown ?? []).map((b) => b.id)))}
          onClose={exitSelect}
        />
      )}
    </div>
  );
}

export default function MoodboardsPage() {
  return (
    <Suspense fallback={null}>
      <MoodboardsScreen />
    </Suspense>
  );
}
