"use client";

import { useMemo, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { normalizeTagName, type Tag } from "@/lib/refs";

type Props = {
  tags: Tag[];
  allTags: Tag[];
  onAdd: (name: string) => void;
  onRemove: (tag: Tag) => void;
  busy?: boolean;
};

// 태그 칩 + 입력칸. Enter나 쉼표로 추가, 빈칸에서 Backspace로 마지막 태그 삭제
export function TagInput({ tags, allTags, onAdd, onRemove, busy }: Props) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const attached = useMemo(() => new Set(tags.map((t) => t.name.toLowerCase())), [tags]);
  const term = normalizeTagName(text).toLowerCase();
  const suggestions = useMemo(
    () =>
      allTags
        .filter((t) => !attached.has(t.name.toLowerCase()))
        .filter((t) => !term || t.name.toLowerCase().includes(term))
        .slice(0, 6),
    [allTags, attached, term]
  );

  function commit(raw: string) {
    const name = normalizeTagName(raw);
    if (!name || attached.has(name.toLowerCase())) {
      setText("");
      return;
    }
    // 같은 이름(대소문자만 다른) 태그가 있으면 그 이름을 그대로 씀
    const existing = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    onAdd(existing?.name ?? name);
    setText("");
  }

  return (
    <div className="relative">
      <div
        className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-hairline px-2 py-1.5 focus-within:border-ink"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((t) => (
          <span key={t.id} className="inline-flex h-7 items-center gap-1 rounded-full bg-haze pl-3 pr-1 text-[13px]">
            {t.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(t);
              }}
              aria-label={`${t.name} 태그 빼기`}
              className="grid h-5 w-5 place-items-center rounded-full text-graphite hover:bg-hairline hover:text-ink"
            >
              <CloseIcon size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) commit(v.slice(0, -1));
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              commit(text);
            } else if (e.key === "Backspace" && !text && tags.length) {
              onRemove(tags[tags.length - 1]);
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder={tags.length ? "" : "예: 미니멀, 그리드, 세리프"}
          aria-label="태그 추가"
          disabled={busy}
          className="h-7 min-w-[8rem] flex-1 bg-transparent px-1.5 text-[14px] outline-none placeholder:text-graphite"
        />
      </div>

      {focused && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 rounded-lg border border-hairline bg-paper p-1">
          {suggestions.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(t.name)}
                className="flex h-8 w-full items-center rounded-md px-2.5 text-left text-[13px] hover:bg-haze"
              >
                {t.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
