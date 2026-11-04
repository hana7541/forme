"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { Button } from "@/components/ui";
import { SearchIcon } from "@/components/icons";
import { fetchRefs, gridPath, signedUrls, type Ref } from "@/lib/refs";
import { useT } from "@/lib/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (refs: Ref[]) => void;
  confirmLabel?: (n: number) => string;
  title?: string;
};

const PICK_PAGE = 60;

// 라이브러리에서 여러 장 골라 오기 (무드보드에 넣을 때 등)
export function RefPicker({ open, onClose, onPick, confirmLabel, title }: Props) {
  const { t } = useT();
  const label = confirmLabel ?? ((n: number) => t("{n}개 넣기", { n }));
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [items, setItems] = useState<Ref[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Map<string, Ref>>(new Map());
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const gen = useRef(0);

  // 입력을 잠깐 멈추면 검색
  useEffect(() => {
    const timer = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(async (offset: number) => {
    const g = ++gen.current;
    setLoading(true);
    try {
      const list = await fetchRefs({ q: term || null }, offset, PICK_PAGE);
      if (g !== gen.current) return;
      setItems((prev) => (offset === 0 ? list : [...prev, ...list]));
      setHasMore(list.length === PICK_PAGE);
      const map = await signedUrls(list.map(gridPath)).catch(() => ({}));
      setUrls((prev) => ({ ...prev, ...map }));
    } finally {
      if (g === gen.current) setLoading(false);
    }
  }, [term]);

  useEffect(() => {
    if (!open) return;
    void load(0);
  }, [open, load]);

  useEffect(() => {
    if (open) return;
    setPicked(new Map());
    setQ("");
    setTerm("");
  }, [open]);

  function toggle(r: Ref) {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(r.id)) next.delete(r.id);
      else next.set(r.id, r);
      return next;
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={title ?? t("라이브러리에서 고르기")} width="max-w-[880px]">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-graphite" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("제목, 메모, 태그로 찾기")}
          aria-label={t("레퍼런스 검색")}
          className="h-11 w-full rounded-full bg-haze pl-11 pr-4 text-[14px] outline-none placeholder:text-graphite focus:bg-paper focus:shadow-[inset_0_0_0_1px_var(--color-ink)]"
        />
      </div>

      <div className="mt-5 max-h-[52vh] overflow-y-auto">
        {!loading && items.length === 0 && (
          <p className="py-10 text-center text-[14px] text-graphite">
            {term ? t("‘{term}’와 맞는 레퍼런스가 없어요.", { term }) : t("라이브러리가 비어 있어요. 먼저 이미지를 올려 주세요.")}
          </p>
        )}
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {items.map((r) => {
            const on = picked.has(r.id);
            const url = urls[gridPath(r)];
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  aria-pressed={on}
                  aria-label={r.title || t("제목 없는 레퍼런스")}
                  className={`relative block aspect-square w-full overflow-hidden transition-transform ${on ? "scale-[0.94]" : ""}`}
                  style={{ backgroundColor: r.dominant_color ?? "var(--color-haze)" }}
                >
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                  <span
                    className={`absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full border-[1.5px] ${
                      on ? "border-ink bg-ink text-paper" : "border-white bg-black/15"
                    }`}
                  >
                    {on && (
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {on && <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_2px_var(--color-ink)]" />}
                </button>
              </li>
            );
          })}
        </ul>
        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Button type="button" variant="ghost" loading={loading} onClick={() => void load(items.length)}>
              {t("더 보기")}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-[13px] text-graphite tabular-nums">{picked.size ? t("{n}개 고름", { n: picked.size }) : t("넣을 이미지를 눌러 고르세요")}</p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("취소")}
          </Button>
          <Button
            type="button"
            disabled={!picked.size}
            onClick={() => {
              onPick([...picked.values()]);
              onClose();
            }}
          >
            {label(picked.size)}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
