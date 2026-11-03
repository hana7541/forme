"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HeartIcon } from "@/components/icons";
import { gridPath, type Ref } from "@/lib/refs";

// 화면 너비에 따라 기둥(열) 수 정하기
function columnsFor(width: number) {
  if (width < 560) return 2;
  if (width < 900) return 3;
  if (width < 1400) return 4;
  return 5;
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

// 새 이미지가 왼쪽 위부터 줄 순서대로 채워지도록, 가장 짧은 기둥에 하나씩 넣음
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

type GridProps = {
  items: Ref[];
  urls: Record<string, string>;
  onOpen: (ref: Ref) => void;
  onToggleFavorite: (ref: Ref) => void;
  selectMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (ref: Ref, range: boolean) => void;
};

export function MasonryGrid({ items, urls, onOpen, onToggleFavorite, selectMode, selected, onToggleSelect }: GridProps) {
  const { ref, cols } = useColumnCount();
  const columns = useMemo(() => distribute(items, cols), [items, cols]);

  return (
    <div ref={ref} className="flex items-start gap-3 sm:gap-4">
      {columns.map((col, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
          {col.map((item) => (
            <RefTile
              key={item.id}
              item={item}
              url={urls[gridPath(item)]}
              onOpen={onOpen}
              onToggleFavorite={onToggleFavorite}
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

function RefTile({
  item,
  url,
  onOpen,
  onToggleFavorite,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  item: Ref;
  url?: string;
  onOpen: (ref: Ref) => void;
  onToggleFavorite: (ref: Ref) => void;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect?: (ref: Ref, range: boolean) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const ratio = item.width && item.height ? `${item.width} / ${item.height}` : "1 / 1";
  const label = item.title || "제목 없는 레퍼런스";

  return (
    <div
      className={`group relative overflow-hidden rounded-[3px] transition-[transform,box-shadow] duration-150 ${
        isSelected ? "scale-[0.96] shadow-[0_0_0_2px_var(--color-paper),0_0_0_4px_var(--color-ink)]" : ""
      }`}
      style={{ backgroundColor: item.dominant_color ?? "var(--color-haze)" }}
    >
      <button
        type="button"
        onClick={(e) => (selectMode ? onToggleSelect?.(item, e.shiftKey) : onOpen(item))}
        aria-label={selectMode ? `${label} ${isSelected ? "선택 해제" : "선택"}` : `${label} 열기`}
        aria-pressed={selectMode ? isSelected : undefined}
        className="block w-full focus-visible:outline-offset-[-2px]"
        style={{ aspectRatio: ratio }}
      >
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={item.title || ""}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {/* 호버: 아래쪽에 제목 */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/55 to-transparent px-3 pb-2.5 pt-10 text-left opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          {item.title && <span className="line-clamp-2 text-[13px] font-medium text-white">{item.title}</span>}
        </span>
      </button>

      {selectMode && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full border-[1.5px] transition-colors ${
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

      {!selectMode && (
      <button
        type="button"
        onClick={() => onToggleFavorite(item)}
        aria-pressed={item.is_favorite}
        aria-label={item.is_favorite ? "즐겨찾기에서 빼기" : "즐겨찾기에 넣기"}
        className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-ink backdrop-blur transition-opacity duration-200 hover:bg-white ${
          item.is_favorite ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        }`}
      >
        <HeartIcon size={16} className={item.is_favorite ? "fill-current" : ""} />
      </button>
      )}
    </div>
  );
}
