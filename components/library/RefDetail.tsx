"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  ExternalIcon,
  HeartIcon,
  TrashIcon,
} from "@/components/icons";
import { useToast } from "@/components/Toast";
import { TagInput } from "@/components/library/TagInput";
import { formatBytes } from "@/lib/image";
import type { CategoryWithCount } from "@/lib/library";
import {
  addTagToRef,
  deleteRef,
  fetchAllTags,
  fetchRefTags,
  gridPath,
  removeTagFromRef,
  signedUrls,
  updateRef,
  type Ref,
  type RefPatch,
  type Tag,
} from "@/lib/refs";

type Props = {
  item: Ref;
  categories: CategoryWithCount[];
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onChange: (ref: Ref) => void;
  onDeleted: (ref: Ref) => void;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function normalizeUrl(raw: string): { value: string | null; error: string | null } {
  const v = raw.trim();
  if (!v) return { value: null, error: null };
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) throw new Error();
    return { value: u.toString(), error: null };
  } catch {
    return { value: null, error: "주소 형식이 맞지 않아요. 예: https://example.com" };
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const MIME_LABEL: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
  "image/gif": "GIF",
  "image/avif": "AVIF",
};

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export function RefDetail({ item, categories, onClose, onPrev, onNext, onChange, onDeleted }: Props) {
  const { show } = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);

  // 편집 중인 값들
  const [title, setTitle] = useState(item.title);
  const [memo, setMemo] = useState(item.memo);
  const [source, setSource] = useState(item.source_url ?? "");
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagBusy, setTagBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [fullLoaded, setFullLoaded] = useState(false);

  const itemRef = useRef(item);
  itemRef.current = item;

  // 다른 레퍼런스로 넘어가면 입력칸을 그 내용으로 다시 채움
  useEffect(() => {
    setTitle(item.title);
    setMemo(item.memo);
    setSource(item.source_url ?? "");
    setSourceError(null);
    setSaveState("idle");
    setConfirmDelete(false);
    setFullLoaded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // 이미지: 작은 썸네일을 먼저 보여 주고 원본으로 교체
  useEffect(() => {
    let cancelled = false;
    setImgUrl(null);
    signedUrls([gridPath(item), item.storage_path])
      .then((map) => {
        if (cancelled) return;
        setImgUrl(map[item.storage_path] ?? map[gridPath(item)] ?? null);
      })
      .catch(() => !cancelled && setImgUrl(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // 태그
  useEffect(() => {
    let cancelled = false;
    setTags([]);
    fetchRefTags(item.id)
      .then((t) => !cancelled && setTags(t))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  useEffect(() => {
    fetchAllTags().then(setAllTags).catch(() => {});
  }, []);

  // 저장
  const save = useCallback(
    async (patch: RefPatch) => {
      setSaveState("saving");
      try {
        const saved = await updateRef(itemRef.current.id, patch);
        onChange(saved);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [onChange]
  );

  // 글자 입력은 잠깐 멈추면 자동 저장
  const pendingPatch = useCallback((): RefPatch | null => {
    const cur = itemRef.current;
    const patch: RefPatch = {};
    const t = title.trim().slice(0, 120);
    if (t !== cur.title) patch.title = t;
    if (memo !== cur.memo) patch.memo = memo.slice(0, 5000);
    const src = normalizeUrl(source);
    if (!src.error && src.value !== (cur.source_url ?? null)) patch.source_url = src.value;
    return Object.keys(patch).length ? patch : null;
  }, [title, memo, source]);

  useEffect(() => {
    const src = normalizeUrl(source);
    setSourceError(src.error);
    const patch = pendingPatch();
    if (!patch) return;
    const t = setTimeout(() => void save(patch), 700);
    return () => clearTimeout(t);
  }, [title, memo, source, pendingPatch, save]);

  const flush = useCallback(async () => {
    const patch = pendingPatch();
    if (patch) await save(patch);
  }, [pendingPatch, save]);

  const close = useCallback(async () => {
    await flush();
    onClose();
  }, [flush, onClose]);

  const go = useCallback(
    async (fn?: () => void) => {
      if (!fn) return;
      await flush();
      fn();
    },
    [flush]
  );

  // 키보드: Esc 닫기, ←/→ 이동 (글 쓰는 중에는 이동 안 함)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void close();
      } else if (!isTyping(e.target)) {
        if (e.key === "ArrowLeft" && onPrev) void go(onPrev);
        if (e.key === "ArrowRight" && onNext) void go(onNext);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, go, onPrev, onNext]);

  // 열려 있는 동안 뒤 화면 스크롤 막기
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function toggleFavorite() {
    await save({ is_favorite: !itemRef.current.is_favorite });
  }

  async function setCategory(id: string | null) {
    if (id === itemRef.current.category_id) return;
    await save({ category_id: id });
  }

  async function addTag(name: string) {
    setTagBusy(true);
    try {
      const tag = await addTagToRef(item.id, name);
      setTags((prev) =>
        prev.some((t) => t.id === tag.id) ? prev : [...prev, tag].sort((a, b) => a.name.localeCompare(b.name, "ko"))
      );
      setAllTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
    } catch {
      show("태그를 추가하지 못했어요.");
    } finally {
      setTagBusy(false);
    }
  }

  async function removeTag(tag: Tag) {
    const before = tags;
    setTags((prev) => prev.filter((t) => t.id !== tag.id));
    try {
      await removeTagFromRef(item.id, tag.id);
    } catch {
      setTags(before);
      show("태그를 빼지 못했어요.");
    }
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await deleteRef(item);
      onDeleted(item);
    } catch {
      setDeleting(false);
      show("삭제하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }

  async function openOriginal() {
    try {
      const map = await signedUrls([item.storage_path]);
      const url = map[item.storage_path];
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      show("원본을 열지 못했어요.");
    }
  }

  const ratio = item.width && item.height ? `${item.width} / ${item.height}` : undefined;
  const saveLabel =
    saveState === "saving" ? "저장 중…" : saveState === "saved" ? "저장됨" : saveState === "error" ? "저장하지 못했어요" : "";

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={item.title || "레퍼런스 상세"}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-paper outline-none"
    >
      {/* 위쪽 바 */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-hairline px-3 sm:px-5">
        <button
          type="button"
          onClick={() => void close()}
          className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-[14px] hover:bg-haze"
        >
          <CloseIcon size={16} />
          닫기
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void go(onPrev)}
            disabled={!onPrev}
            aria-label="이전 레퍼런스"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-haze disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={() => void go(onNext)}
            disabled={!onNext}
            aria-label="다음 레퍼런스"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-haze disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden">
        {/* 이미지 */}
        <div className="flex items-center justify-center bg-paper p-4 sm:p-8 lg:h-full lg:min-h-0 lg:p-12">
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={item.id}
              src={imgUrl}
              alt={item.title || ""}
              width={item.width ?? undefined}
              height={item.height ?? undefined}
              onLoad={() => setFullLoaded(true)}
              style={{ backgroundColor: item.dominant_color ?? "var(--color-haze)" }}
              className={`h-auto max-h-[62vh] w-auto max-w-full rounded-[3px] object-contain transition-opacity duration-300 lg:max-h-full ${
                fullLoaded ? "opacity-100" : "opacity-60"
              }`}
            />
          ) : (
            <div
              className="max-h-[62vh] w-full max-w-md rounded-[3px] lg:max-h-full"
              style={{ aspectRatio: ratio ?? "1 / 1", backgroundColor: item.dominant_color ?? "var(--color-haze)" }}
            />
          )}
        </div>

        {/* 정보 패널 */}
        <aside className="border-t border-hairline px-5 pb-16 pt-6 sm:px-8 lg:h-full lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pt-8">
          <div className="flex items-start justify-between gap-3">
            <label className="sr-only" htmlFor="ref-title">
              제목
            </label>
            <textarea
              id="ref-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
              placeholder="제목 없음"
              rows={1}
              maxLength={120}
              className="field-sizing-content min-h-[34px] flex-1 resize-none bg-transparent text-[24px] font-semibold leading-tight tracking-[-0.03em] outline-none placeholder:text-graphite/60"
            />
            <button
              type="button"
              onClick={() => void toggleFavorite()}
              aria-pressed={item.is_favorite}
              aria-label={item.is_favorite ? "즐겨찾기에서 빼기" : "즐겨찾기에 넣기"}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors ${
                item.is_favorite ? "border-ink bg-ink text-paper" : "border-hairline hover:border-ink"
              }`}
            >
              <HeartIcon size={17} className={item.is_favorite ? "fill-current" : ""} />
            </button>
          </div>
          <p className="mt-1 h-5 text-[12px] text-graphite" role="status" aria-live="polite">
            {saveState === "error" ? <span className="text-red-600">{saveLabel}</span> : saveLabel}
          </p>

          <div className="mt-6 flex flex-col gap-7">
            <div>
              <label htmlFor="ref-memo" className="mb-2 block text-[13px] text-graphite">
                메모
              </label>
              <textarea
                id="ref-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="왜 저장했는지, 어디에 쓰고 싶은지 적어 두세요."
                rows={4}
                className="field-sizing-content min-h-[104px] w-full resize-none rounded-lg border border-hairline px-3.5 py-3 text-[14px] leading-relaxed outline-none placeholder:text-graphite focus:border-ink"
              />
            </div>

            <div>
              <label htmlFor="ref-source" className="mb-2 block text-[13px] text-graphite">
                출처
              </label>
              <div className="flex gap-2">
                <input
                  id="ref-source"
                  type="url"
                  inputMode="url"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="https://"
                  aria-invalid={!!sourceError}
                  className={`h-11 min-w-0 flex-1 rounded-lg border px-3.5 text-[14px] outline-none placeholder:text-graphite focus:border-ink ${
                    sourceError ? "border-red-500" : "border-hairline"
                  }`}
                />
                {item.source_url && !sourceError && (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="출처 열기"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-hairline hover:border-ink"
                  >
                    <ExternalIcon size={16} />
                  </a>
                )}
              </div>
              {sourceError && <p className="mt-1.5 text-[12px] text-red-600">{sourceError}</p>}
            </div>

            <div>
              <p className="mb-2 text-[13px] text-graphite">카테고리</p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const on = item.category_id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => void setCategory(on ? null : c.id)}
                      aria-pressed={on}
                      className={`h-8 rounded-full border px-3.5 text-[13px] transition-colors ${
                        on ? "border-ink bg-ink text-paper" : "border-hairline hover:border-ink"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[12px] text-graphite">한 번 더 누르면 카테고리가 빠져요.</p>
            </div>

            <div>
              <p className="mb-2 text-[13px] text-graphite">태그</p>
              <TagInput tags={tags} allTags={allTags} onAdd={(n) => void addTag(n)} onRemove={(t) => void removeTag(t)} busy={tagBusy} />
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-hairline pt-6 text-[13px]">
              <dt className="text-graphite">크기</dt>
              <dd className="tabular-nums">{item.width && item.height ? `${item.width} × ${item.height}px` : "-"}</dd>
              <dt className="text-graphite">용량</dt>
              <dd className="tabular-nums">{formatBytes(item.file_size)}</dd>
              <dt className="text-graphite">형식</dt>
              <dd>{(item.mime_type && MIME_LABEL[item.mime_type]) ?? "-"}</dd>
              <dt className="text-graphite">추가한 날</dt>
              <dd className="tabular-nums">{formatDate(item.created_at)}</dd>
            </dl>

            <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-6">
              <button
                type="button"
                onClick={() => void openOriginal()}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline px-4 text-[13px] hover:border-ink"
              >
                <ExternalIcon size={15} />
                원본 보기
              </button>

              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] text-graphite hover:bg-haze hover:text-red-600"
                >
                  <TrashIcon size={15} />
                  삭제
                </button>
              ) : (
                <div className="flex w-full items-center gap-2 rounded-xl bg-haze p-2 pl-4 sm:w-auto">
                  <p className="flex-1 text-[13px]">이미지와 메모, 태그 연결이 함께 지워져요.</p>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="h-9 rounded-full px-3 text-[13px] hover:bg-paper"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => void doDelete()}
                    disabled={deleting}
                    className="h-9 rounded-full bg-red-600 px-4 text-[13px] font-medium text-white disabled:opacity-50"
                  >
                    {deleting ? "삭제 중…" : "삭제하기"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
