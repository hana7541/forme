"use client";

import { MenuItem, Popover } from "@/components/Popover";
import { ChevronDownIcon, SlidersIcon } from "@/components/icons";

export type SortOption = { value: string; label: string };

type Props = {
  sort: string;
  sortOptions: SortOption[];
  onSort: (value: string) => void;
  // 필터 창 내용 (없으면 필터 버튼을 숨김)
  filter?: (close: () => void) => React.ReactNode;
  filterActive?: boolean;
  selectMode: boolean;
  onToggleSelect: () => void;
  selectDisabled?: boolean;
};

// 그리드 바로 위 오른쪽: 정렬 · 필터 · 선택 (모든 목록 화면에서 같은 자리)
export function ListControls({ sort, sortOptions, onSort, filter, filterActive, selectMode, onToggleSelect, selectDisabled }: Props) {
  const current = sortOptions.find((o) => o.value === sort) ?? sortOptions[0];

  return (
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <Popover
        label="정렬"
        align="end"
        width="w-44"
        trigger={({ toggle, open }) => (
          <button type="button" onClick={toggle} aria-expanded={open} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] hover:bg-haze">
            <span className="text-graphite">정렬</span>
            <span className="font-medium">{current.label}</span>
            <ChevronDownIcon size={14} className="text-graphite" />
          </button>
        )}
      >
        {(close) => (
          <>
            {sortOptions.map((o) => (
              <MenuItem
                key={o.value}
                active={o.value === current.value}
                onClick={() => {
                  onSort(o.value);
                  close();
                }}
              >
                {o.label}
              </MenuItem>
            ))}
          </>
        )}
      </Popover>

      {filter && (
        <Popover
          label="필터"
          align="end"
          width="w-64"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label="필터"
              className={`relative grid h-9 w-9 place-items-center rounded-full hover:bg-haze ${open ? "bg-haze" : ""}`}
            >
              <SlidersIcon size={17} />
              {filterActive && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" />}
            </button>
          )}
        >
          {filter}
        </Popover>
      )}

      <button
        type="button"
        onClick={onToggleSelect}
        disabled={selectDisabled && !selectMode}
        aria-pressed={selectMode}
        className={`ml-1 inline-flex h-9 items-center rounded-full px-3.5 text-[13px] transition-colors disabled:opacity-40 ${
          selectMode ? "bg-ink text-paper" : "border border-hairline hover:border-ink disabled:hover:border-hairline"
        }`}
      >
        {selectMode ? "선택 끝내기" : "선택"}
      </button>
    </div>
  );
}

// 목록 화면용 간단한 선택 막대: 개수 · 모두 선택 · 삭제 · 끝내기
export function ListSelectionBar({
  count,
  total,
  noun,
  note,
  busy,
  confirming,
  onConfirm,
  onCancelConfirm,
  onAskDelete,
  onSelectAll,
  onClose,
}: {
  count: number;
  total: number;
  noun: string;
  note: string;
  busy: boolean;
  confirming: boolean;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  onAskDelete: () => void;
  onSelectAll: () => void;
  onClose: () => void;
}) {
  const btn = "inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] text-paper/90 transition-colors hover:bg-paper/10 hover:text-paper disabled:opacity-40";
  return (
    <div className="fixed inset-x-0 bottom-4 z-[45] flex justify-center px-3 sm:bottom-6">
      <div role="toolbar" aria-label={`선택한 ${noun} 작업`} className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-[22px] bg-ink px-1.5 py-1.5 text-paper sm:flex-nowrap sm:pl-4">
        <p className="mr-1 shrink-0 px-2 text-[13px] tabular-nums sm:px-0" aria-live="polite">
          {count}개 선택
        </p>
        {confirming ? (
          <>
            <span className="shrink-0 px-2 text-[13px] text-paper/80">{note}</span>
            <button type="button" className={btn} onClick={onCancelConfirm}>
              취소
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="inline-flex h-9 shrink-0 items-center rounded-full bg-red-600 px-4 text-[13px] font-medium text-white disabled:opacity-50"
            >
              {busy ? "지우는 중…" : `${count}개 지우기`}
            </button>
          </>
        ) : (
          <>
            <button type="button" className={btn} disabled={!count} onClick={onAskDelete}>
              삭제
            </button>
            {count < total && (
              <button type="button" className={btn} onClick={onSelectAll}>
                모두 선택
              </button>
            )}
            <button type="button" className={btn} onClick={onClose}>
              끝내기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
