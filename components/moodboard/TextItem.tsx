"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { useT } from "@/lib/i18n";
import {
  TEXT_FONT_FAMILY,
  TEXT_LINE_HEIGHT,
  TEXT_TRACKING_EM,
  textStyleOf,
  type BoardItem,
} from "@/lib/moodboards";

type Props = {
  item: BoardItem;
  selected: boolean;
  editing: boolean;
  selectAllOnEdit: boolean;
  zoom: number;
  outline: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onMeasure: (height: number) => void;
  onChange: (content: string) => void;
  onEditEnd: () => void;
};

// 보드 위 텍스트 하나. 평소엔 글자만, 편집할 때는 같은 모양의 입력칸으로 바뀜
export function TextItem({
  item,
  selected,
  editing,
  selectAllOnEdit,
  zoom,
  outline,
  onPointerDown,
  onDoubleClick,
  onResizeStart,
  onMeasure,
  onChange,
  onEditEnd,
}: Props) {
  const { t } = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const s = textStyleOf(item);

  const textStyle: CSSProperties = {
    fontFamily: TEXT_FONT_FAMILY,
    fontSize: s.size,
    fontWeight: s.weight,
    color: s.color,
    textAlign: s.align,
    lineHeight: TEXT_LINE_HEIGHT,
    letterSpacing: `${TEXT_TRACKING_EM}em`,
    whiteSpace: "pre-wrap",
    wordBreak: "keep-all",
    overflowWrap: "anywhere",
  };

  // 글이 늘거나 줄면 높이를 재서 알려 줌 (화면 확대와 상관없는 보드 단위)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onMeasure(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onMeasure]);

  // 입력칸 높이를 내용에 맞춤
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = "0px";
    area.style.height = `${area.scrollHeight}px`;
  }, [editing, item.content, item.width, s.size, s.weight]);

  // 편집 시작: 커서 놓기 (새 텍스트면 전체 선택해서 바로 덮어 쓰게)
  useEffect(() => {
    if (!editing) return;
    const area = areaRef.current;
    if (!area) return;
    area.focus({ preventScroll: true });
    if (selectAllOnEdit) area.select();
    else area.setSelectionRange(area.value.length, area.value.length);
  }, [editing, selectAllOnEdit]);

  const handle = 12 / zoom;

  return (
    <div
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className={`absolute ${editing ? "cursor-text" : "cursor-move"}`}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        zIndex: item.z_index,
        transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
      }}
    >
      {editing ? (
        <textarea
          ref={areaRef}
          value={item.content ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onEditEnd}
          onKeyDown={(e) => {
            if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          placeholder={t("텍스트 입력")}
          aria-label={t("텍스트 내용")}
          rows={1}
          maxLength={5000}
          spellCheck={false}
          className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none select-text placeholder:opacity-40"
          style={textStyle}
        />
      ) : (
        <div style={textStyle} className="min-h-[1em]">
          {/* 줄 끝 빈 줄도 높이를 갖도록 */}
          {(item.content ?? "") + ((item.content ?? "").endsWith("\n") ? " " : "")}
        </div>
      )}

      {(selected || editing) && (
        <>
          <span
            className="pointer-events-none absolute inset-0"
            style={{ boxShadow: `0 0 0 ${1.5 / zoom}px ${outline}`, outlineOffset: 0 }}
          />
          {!editing && (
            <span
              onPointerDown={onResizeStart}
              role="slider"
              aria-label={t("글 상자 너비")}
              aria-valuenow={Math.round(item.width)}
              className="absolute cursor-ew-resize rounded-full bg-white"
              style={{
                width: handle,
                height: handle * 2,
                right: -handle / 2,
                top: `calc(50% - ${handle}px)`,
                border: `${2 / zoom}px solid #000000`,
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
