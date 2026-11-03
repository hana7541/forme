"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PlusIcon, UploadIcon } from "@/components/icons";
import { looksLikeUrl, useUpload } from "./UploadManager";

// 위쪽 바의 "업로드" 버튼: 파일 고르기 + 주소로 저장
export function UploadButton() {
  const { openPicker, saveUrls } = useUpload();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = url.trim();
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    if (!v || !looksLikeUrl(withScheme)) {
      setError("이미지나 웹페이지 주소를 넣어 주세요.");
      return;
    }
    saveUrls([withScheme]);
    setUrl("");
    setError(null);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-3 text-[14px] font-medium text-paper transition-opacity hover:opacity-85 sm:px-4"
      >
        <PlusIcon size={16} />
        <span className="hidden sm:inline">업로드</span>
      </button>

      <div
        role="dialog"
        aria-label="레퍼런스 추가"
        className={`absolute right-0 top-[calc(100%+8px)] z-40 w-[min(360px,calc(100vw-2.5rem))] origin-top-right rounded-xl border border-hairline bg-paper p-2 transition duration-150 ${
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            openPicker();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-haze"
        >
          <UploadIcon />
          <span>
            <span className="block text-[14px] font-medium">내 컴퓨터에서 고르기</span>
            <span className="block text-[12px] text-graphite">여러 장 선택 가능, 최대 20MB</span>
          </span>
        </button>

        <div className="my-2 h-px bg-hairline" />

        <form onSubmit={submit} className="px-3 pb-2 pt-1">
          <label htmlFor="upload-url" className="text-[14px] font-medium">
            주소로 저장
          </label>
          <p className="mt-0.5 text-[12px] leading-relaxed text-graphite">
            이미지 주소나 웹페이지 주소를 넣으면, 웹페이지의 대표 이미지를 찾아 저장해요.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              ref={inputRef}
              id="upload-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://"
              aria-invalid={!!error}
              className={`h-10 min-w-0 flex-1 rounded-lg border px-3 text-[14px] outline-none placeholder:text-graphite focus:border-ink ${
                error ? "border-red-500" : "border-hairline"
              }`}
            />
            <button type="submit" className="h-10 shrink-0 rounded-full bg-ink px-4 text-[13px] font-medium text-paper hover:opacity-85">
              저장
            </button>
          </div>
          {error && <p className="mt-1.5 text-[12px] text-red-600">{error}</p>}
          <p className="mt-3 text-[12px] text-graphite">화면 아무 곳에서나 주소를 Cmd + V 해도 저장돼요.</p>
        </form>
      </div>
    </div>
  );
}
