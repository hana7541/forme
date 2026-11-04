"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MenuItem, Popover } from "@/components/Popover";
import { ExternalIcon, FolderIcon, HeartIcon } from "@/components/icons";
import type { CollectionPreview } from "@/lib/collections";
import { gridPath, type Ref } from "@/lib/refs";
import { useT } from "@/lib/i18n";

// 본문 너비에 따라 열 수: 모바일 2 · 태블릿 3 · 데스크톱 4
function columnsFor(width: number) {
  if (width < 560) return 2;
  if (width < 860) return 3;
  return 4;
}

function useColumnCount() {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setCols(columnsFor(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, cols };
}

// 가장 짧은 열에 하나씩 넣어 빈틈 없이 + 왼쪽 위부터 순서대로
function distribute(items: Ref[], cols: number) {
  const columns: Ref[][] = Array.from({ length: cols }, () => []);
  const heights = new Array<number>(cols).fill(0);
  for (const item of items) {
    const ratio = item.width && item.height ? item.height / item.width : 1;
    let shortest = 0;
    for (let i = 1; i < cols; i++) if (heights[i] < heights[shortest] - 0.0001) shortest = i;
    columns[shortest].push(item);
    heights[shortest] += ratio;
  }
  return columns;
}

export type TileActions = {
  collections: CollectionPreview[];
  onToggleFavorite: (ref: Ref) => void;
  onAddToCollection: (ref: Ref, collectionId: string) => void;
  onNewCollection: (ref: Ref) => void;
  onOpenOriginal: (ref: Ref) => void;
  onDelete: (ref: Ref) => void;
};

type GridProps = {
  items: Ref[];
  urls: Record<string, string>;
  onOpen: (ref: Ref) => void;
  actions: TileActions;
  selectMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (ref: Ref, range: boolean) => void;
};

export function MasonryGrid({ items, urls, onOpen, actions, selectMode, selected, onToggleSelect }: GridProps) {
  const { ref, cols } = useColumnCount();
  const columns = useMemo(() => distribute(items, cols), [items, cols]);

  return (
    <div ref={ref} className="flex items-start gap-4">
      {columns.map((col, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-4">
          {col.map((item) => (
            <RefTile
              key={item.id}
              item={item}
              url={urls[gridPath(item)]}
              onOpen={onOpen}
              actions={actions}
              selectMode={!!selectMode}
              isSelected={!!selected?.has(item.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const actionBtn =
  "grid h-8 w-8 place-items-center rounded-full bg-paper/92 text-ink backdrop-blur transition-colors hover:bg-paper";

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <circle cx="4.5" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="15.5" cy="10" r="1.5" />
    </svg>
  );
}

function RefTile({
  item,
  url,
  onOpen,
  actions,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  item: Ref;
  url?: string;
  onOpen: (ref: Ref) => void;
  actions: TileActions;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect?: (ref: Ref, range: boolean) => void;
}) {
  const { t } = useT();
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ratio = item.width && item.height ? `${item.width} / ${item.height}` : "1 / 1";
  const label = item.title || t("제목 없는 레퍼런스");

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={(e) => (selectMode ? onToggleSelect?.(item, e.shiftKey) : onOpen(item))}
        aria-label={selectMode ? `${label} ${isSelected ? t("선택 해제") : t("선택")}` : t("{name} 열기", { name: label })}
        aria-pressed={selectMode ? isSelected : undefined}
        className={`relative block w-full overflow-hidden transition-transform duration-150 focus-visible:outline-offset-2 ${
          isSelected ? "scale-[0.96]" : ""
        }`}
        style={{ aspectRatio: ratio, backgroundColor: item.dominant_color ?? "var(--color-haze)" }}
      >
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={item.title || ""}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {/* 호버: 아주 옅은 어둠만 */}
        {!selectMode && (
          <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10" />
        )}
        {isSelected && <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_2px_var(--color-ink)]" />}
      </button>

      {selectMode && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full border-[1.5px] transition-colors ${
            isSelected ? "border-ink bg-ink text-paper" : "border-white bg-black/15"
          }`}
        >
          {isSelected && (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      )}

      {/* 호버하면 나타나는 버튼: 오른쪽 위 즐겨찾기·컬렉션, 오른쪽 아래 더보기 */}
      {!selectMode && (
        <>
          <div className="absolute right-2.5 top-2.5 flex gap-1.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-open=true]]:opacity-100">
            <Popover
              label={t("컬렉션에 넣기")}
              align="end"
              width="w-56"
              trigger={({ toggle }) => (
                <button type="button" onClick={toggle} aria-label={t("컬렉션에 넣기")} className={actionBtn}>
                  <FolderIcon size={15} />
                </button>
              )}
            >
              {(close) => (
                <div className="max-h-64 overflow-y-auto">
                  <p className="px-3 pb-1 pt-1.5 text-[12px] text-graphite">{t("컬렉션에 넣기")}</p>
                  {actions.collections.map((c) => (
                    <MenuItem
                      key={c.id}
                      onClick={() => {
                        actions.onAddToCollection(item, c.id);
                        close();
                      }}
                    >
                      {c.name}
                    </MenuItem>
                  ))}
                  {actions.collections.length > 0 && <div className="my-1 h-px bg-hairline" />}
                  <MenuItem
                    onClick={() => {
                      actions.onNewCollection(item);
                      close();
                    }}
                  >
                    {t("+ 새 컬렉션")}
                  </MenuItem>
                </div>
              )}
            </Popover>
            <button
              type="button"
              onClick={() => actions.onToggleFavorite(item)}
              aria-pressed={item.is_favorite}
              aria-label={item.is_favorite ? t("즐겨찾기에서 빼기") : t("즐겨찾기에 넣기")}
              className={actionBtn}
            >
              <HeartIcon size={15} className={item.is_favorite ? "fill-current" : ""} />
            </button>
          </div>

          <div className="absolute bottom-2.5 right-2.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-open=true]]:opacity-100">
            <Popover
              label={t("더보기")}
              side="top"
              align="end"
              width="w-48"
              trigger={({ toggle }) => (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    toggle();
                  }}
                  aria-label={t("더보기")}
                  className={actionBtn}
                >
                  <DotsIcon />
                </button>
              )}
            >
              {(close) =>
                confirmDelete ? (
                  <div className="p-1.5">
                    <p className="px-1.5 pb-2 pt-1 text-[13px] leading-relaxed">{t("이미지와 메모가 함께 지워져요.")}</p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="h-8 flex-1 rounded-full text-[13px] hover:bg-haze"
                      >
                        {t("취소")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          actions.onDelete(item);
                          close();
                        }}
                        className="h-8 flex-1 rounded-full bg-red-600 text-[13px] font-medium text-white"
                      >
                        {t("삭제")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <MenuItem
                      onClick={() => {
                        close();
                        onOpen(item);
                      }}
                    >
                      {t("자세히 보기")}
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        close();
                        actions.onOpenOriginal(item);
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        {t("원본 열기")} <ExternalIcon size={13} />
                      </span>
                    </MenuItem>
                    <div className="my-1 h-px bg-hairline" />
                    <MenuItem danger onClick={() => setConfirmDelete(true)}>
                      {t("삭제")}
                    </MenuItem>
                  </>
                )
              }
            </Popover>
          </div>
        </>
      )}
    </div>
  );
}
