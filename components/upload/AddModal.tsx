"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Dialog } from "@/components/Dialog";
import { UploadIcon } from "@/components/icons";
import { looksLikeUrl, useUpload } from "./UploadManager";

type Props = {
  open: boolean;
  onClose: () => void;
  // 올린 이미지가 들어갈 곳 안내 (예: "‘브랜딩’ 카테고리에 들어가요")
  destination?: string | null;
};

// Add New: 끌어다 놓기 · 파일 고르기 · 주소로 저장을 한 곳에
export function AddModal({ open, onClose, destination }: Props) {
  const { openPicker, saveUrls } = useUpload();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    if (open) return;
    setUrl("");
    setError(null);
    setOver(false);
    depth.current = 0;
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
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="레퍼런스 추가" width="max-w-[520px]">
      {destination && <p className="-mt-3 mb-5 text-[13px] text-graphite">{destination}</p>}

      {/* 파일은 화면 어디에 놓아도 올라가므로, 여기서는 보이는 안내와 닫기만 담당 */}
      <button
        type="button"
        data-autofocus
        onClick={() => {
          onClose();
          openPicker();
        }}
        onDragEnter={() => {
          depth.current++;
          setOver(true);
        }}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (!depth.current) setOver(false);
        }}
        onDrop={() => setTimeout(onClose, 0)}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-[10px] border-[1.5px] border-dashed px-6 py-12 text-center transition-colors ${
          over ? "border-ink bg-haze" : "border-hairline hover:border-ink hover:bg-haze/60"
        }`}
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-haze text-ink">
          <UploadIcon />
        </span>
        <span className="text-[15px] font-medium">이미지를 끌어다 놓거나 눌러서 고르세요</span>
        <span className="text-[13px] text-graphite">PNG, JPG, WEBP, GIF, AVIF, 여러 장 가능, 한 장에 20MB까지</span>
      </button>

      <div className="my-6 flex items-center gap-3 text-[12px] text-graphite">
        <span className="h-px flex-1 bg-hairline" />
        또는 주소로 저장
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <form onSubmit={submit}>
        <div className="flex gap-2">
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            placeholder="이미지 또는 웹페이지 주소"
            aria-label="이미지 또는 웹페이지 주소"
            aria-invalid={!!error}
            className={`h-11 min-w-0 flex-1 rounded-[8px] border px-3.5 text-[14px] outline-none placeholder:text-graphite focus:border-ink ${
              error ? "border-red-500" : "border-hairline"
            }`}
          />
          <button type="submit" className="h-11 shrink-0 rounded-full bg-ink px-5 text-[14px] font-medium text-paper hover:opacity-85">
            저장
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-[12px] text-red-600">{error}</p>
        ) : (
          <p className="mt-2 text-[12px] leading-relaxed text-graphite">
            웹페이지 주소를 넣으면 대표 이미지를 찾아 저장하고, 출처도 함께 적어 둬요.
          </p>
        )}
      </form>

      <p className="mt-6 border-t border-hairline pt-4 text-[12px] text-graphite">
        이 창을 열지 않아도 화면 어디서나 Cmd + V로 이미지나 주소를 붙여넣을 수 있어요.
      </p>
    </Dialog>
  );
}
