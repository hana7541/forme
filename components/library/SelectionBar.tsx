"use client";

import { useState, type FormEvent } from "react";
import { MenuItem, Popover } from "@/components/Popover";
import { CloseIcon, FolderIcon, HeartIcon, TrashIcon } from "@/components/icons";
import type { CategoryWithCount } from "@/lib/library";
import type { CollectionPreview } from "@/lib/collections";
import type { TagWithCount } from "@/lib/refs";

type Props = {
  count: number;
  total: number;
  allFavorite: boolean;
  categories: CategoryWithCount[];
  collections: CollectionPreview[];
  tags: TagWithCount[];
  inCollectionId?: string;
  busy: boolean;
  onSelectAll: () => void;
  onCancel: () => void;
  onFavorite: (value: boolean) => void;
  onCategory: (id: string | null) => void;
  onTag: (name: string) => void;
  onAddToCollection: (id: string) => void;
  onNewCollection: () => void;
  onRemoveFromCollection: () => void;
  onDelete: () => void;
};

const barBtn =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] text-paper/90 transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-40";

// 여러 장을 고른 뒤 아래에 뜨는 검은 막대
export function SelectionBar(p: Props) {
  const [confirming, setConfirming] = useState(false);
  const [tagText, setTagText] = useState("");
  const none = p.count === 0;

  function submitTag(e: FormEvent, close: () => void) {
    e.preventDefault();
    if (!tagText.trim()) return;
    p.onTag(tagText);
    setTagText("");
    close();
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-[45] flex justify-center px-3 sm:bottom-6">
      <div
        role="toolbar"
        aria-label="선택한 레퍼런스 작업"
        className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-[22px] bg-ink px-1.5 py-1.5 text-paper sm:flex-nowrap sm:pl-4"
      >
        <p className="mr-1 shrink-0 px-2 text-[13px] tabular-nums sm:mr-2 sm:px-0" aria-live="polite">
          {p.count}개 선택
        </p>

        {confirming ? (
          <>
            <span className="shrink-0 px-2 text-[13px] text-paper/80">이미지와 메모가 함께 지워져요.</span>
            <button type="button" className={barBtn} onClick={() => setConfirming(false)}>
              취소
            </button>
            <button
              type="button"
              disabled={p.busy}
              onClick={() => {
                p.onDelete();
                setConfirming(false);
              }}
              className="inline-flex h-9 shrink-0 items-center rounded-full bg-red-600 px-4 text-[13px] font-medium text-white disabled:opacity-50"
            >
              {p.count}개 삭제
            </button>
          </>
        ) : (
          <>
            <button type="button" className={barBtn} disabled={none || p.busy} onClick={() => p.onFavorite(!p.allFavorite)}>
              <HeartIcon size={15} className={p.allFavorite && !none ? "fill-current" : ""} />
              {p.allFavorite && !none ? "즐겨찾기 빼기" : "즐겨찾기"}
            </button>

            <Popover
              side="top"
              label="카테고리 바꾸기"
              trigger={({ toggle }) => (
                <button type="button" className={barBtn} disabled={none || p.busy} onClick={toggle}>
                  카테고리
                </button>
              )}
            >
              {(close) => (
                <div className="text-ink">
                  {p.categories.map((c) => (
                    <MenuItem
                      key={c.id}
                      onClick={() => {
                        p.onCategory(c.id);
                        close();
                      }}
                    >
                      {c.name}
                    </MenuItem>
                  ))}
                  <div className="my-1 h-px bg-hairline" />
                  <MenuItem
                    onClick={() => {
                      p.onCategory(null);
                      close();
                    }}
                  >
                    카테고리 없음
                  </MenuItem>
                </div>
              )}
            </Popover>

            <Popover
              side="top"
              label="태그 붙이기"
              width="w-72"
              trigger={({ toggle }) => (
                <button type="button" className={barBtn} disabled={none || p.busy} onClick={toggle}>
                  태그
                </button>
              )}
            >
              {(close) => (
                <div className="p-1.5 text-ink">
                  <form onSubmit={(e) => submitTag(e, close)} className="flex gap-2">
                    <input
                      autoFocus
                      value={tagText}
                      onChange={(e) => setTagText(e.target.value)}
                      placeholder="붙일 태그 이름"
                      aria-label="붙일 태그 이름"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-hairline px-3 text-[14px] outline-none focus:border-ink"
                    />
                    <button type="submit" className="h-9 rounded-full bg-ink px-3.5 text-[13px] text-paper">
                      붙이기
                    </button>
                  </form>
                  {p.tags.length > 0 && (
                    <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                      {p.tags
                        .filter((t) => !tagText.trim() || t.name.toLowerCase().includes(tagText.trim().toLowerCase()))
                        .slice(0, 20)
                        .map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              p.onTag(t.name);
                              setTagText("");
                              close();
                            }}
                            className="h-7 rounded-full border border-hairline px-2.5 text-[12px] hover:border-ink"
                          >
                            {t.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </Popover>

            <Popover
              side="top"
              label="컬렉션에 넣기"
              trigger={({ toggle }) => (
                <button type="button" className={barBtn} disabled={none || p.busy} onClick={toggle}>
                  <FolderIcon size={15} />
                  컬렉션에 넣기
                </button>
              )}
            >
              {(close) => (
                <div className="max-h-72 overflow-y-auto text-ink">
                  {p.collections
                    .filter((c) => c.id !== p.inCollectionId)
                    .map((c) => (
                      <MenuItem
                        key={c.id}
                        onClick={() => {
                          p.onAddToCollection(c.id);
                          close();
                        }}
                      >
                        {c.name}
                      </MenuItem>
                    ))}
                  {p.collections.length > 0 && <div className="my-1 h-px bg-hairline" />}
                  <MenuItem
                    onClick={() => {
                      p.onNewCollection();
                      close();
                    }}
                  >
                    + 새 컬렉션 만들어 넣기
                  </MenuItem>
                </div>
              )}
            </Popover>

            {p.inCollectionId && (
              <button type="button" className={barBtn} disabled={none || p.busy} onClick={p.onRemoveFromCollection}>
                컬렉션에서 빼기
              </button>
            )}

            <button type="button" className={barBtn} disabled={none || p.busy} onClick={() => setConfirming(true)}>
              <TrashIcon size={15} />
              삭제
            </button>

            <span className="mx-1 h-5 w-px shrink-0 bg-white/20" aria-hidden="true" />

            {p.count < p.total && (
              <button type="button" className={barBtn} onClick={p.onSelectAll}>
                모두 선택
              </button>
            )}
            <button type="button" onClick={p.onCancel} aria-label="선택 끝내기" className={`${barBtn} w-9 justify-center px-0`}>
              <CloseIcon size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
