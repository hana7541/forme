"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BackIcon,
  BackwardIcon,
  DuplicateIcon,
  EditIcon,
  ForwardIcon,
  FrontIcon,
  TrashIcon,
} from "@/components/icons";
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHTS,
  TEXT_COLORS,
  textStyleOf,
  type BoardItem,
  type TextAlign,
} from "@/lib/moodboards";

export type Restack = "front" | "forward" | "backward" | "back";

type Props = {
  item: BoardItem;
  editing: boolean;
  onPatch: (patch: Partial<BoardItem>) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRestack: (how: Restack) => void;
};

const icon = "grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-haze";
const on = "bg-haze text-ink";
const sep = <span className="mx-1 h-5 w-px shrink-0 bg-hairline" aria-hidden="true" />;

// 글자 크기 단계 (−/+ 버튼이 이 단계를 따라 움직임)
const SIZE_STEPS = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72, 88, 104, 128, 160, 200, 256, 320, 400];

function stepSize(cur: number, dir: 1 | -1) {
  if (dir > 0) return SIZE_STEPS.find((s) => s > cur) ?? FONT_SIZE_MAX;
  return [...SIZE_STEPS].reverse().find((s) => s < cur) ?? FONT_SIZE_MIN;
}

// 버튼을 눌러도 편집 중인 입력칸이 포커스를 잃지 않게
const keepFocus = (e: React.PointerEvent) => e.preventDefault();

function SizeControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useT();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(Math.round(value))), [value]);

  function commit() {
    const n = Number(text);
    if (!Number.isFinite(n) || n <= 0) {
      setText(String(Math.round(value)));
      return;
    }
    onChange(Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(n))));
  }

  return (
    <div className="flex shrink-0 items-center" role="group" aria-label={t("글자 크기")}>
      <button type="button" onPointerDown={keepFocus} onClick={() => onChange(stepSize(value, -1))} aria-label={t("글자 작게")} className={`${icon} text-[16px]`}>
        −
      </button>
      <input
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        inputMode="numeric"
        aria-label={t("글자 크기")}
        className="h-8 w-11 rounded-md bg-haze text-center text-[13px] tabular-nums outline-none focus:shadow-[inset_0_0_0_1px_var(--color-ink)]"
      />
      <button type="button" onPointerDown={keepFocus} onClick={() => onChange(stepSize(value, 1))} aria-label={t("글자 크게")} className={`${icon} text-[16px]`}>
        +
      </button>
    </div>
  );
}

export function SelectionToolbar({ item, editing, onPatch, onEdit, onDuplicate, onDelete, onRestack }: Props) {
  const { t } = useT();
  const isText = item.kind === "text";
  const s = textStyleOf(item);

  const alignBtn = (value: TextAlign, label: string, Icon: typeof AlignLeftIcon) => (
    <button
      type="button"
      onPointerDown={keepFocus}
      onClick={() => onPatch({ align: value })}
      aria-label={label}
      aria-pressed={s.align === value}
      title={label}
      className={`${icon} ${s.align === value ? on : ""}`}
    >
      <Icon size={17} />
    </button>
  );

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute inset-x-3 top-3 z-[6] flex justify-center sm:inset-x-6"
    >
      <div
        role="toolbar"
        aria-label={isText ? t("텍스트 편집 도구") : t("이미지 도구")}
        className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-hairline bg-paper p-1 text-ink [scrollbar-width:none]"
      >
        {isText && (
          <>
            {!editing && (
              <button type="button" onClick={onEdit} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] hover:bg-haze">
                <EditIcon size={15} />
                {t("편집")}
              </button>
            )}
            <SizeControl value={s.size} onChange={(v) => onPatch({ font_size: v })} />
            <select
              value={s.weight}
              onChange={(e) => onPatch({ font_weight: Number(e.target.value) })}
              aria-label={t("글자 굵기")}
              className="h-8 shrink-0 cursor-pointer rounded-md bg-haze px-2 text-[13px] outline-none"
              style={{ fontWeight: s.weight }}
            >
              {FONT_WEIGHTS.map((w) => (
                <option key={w.value} value={w.value} style={{ fontWeight: w.value }}>
                  {w.label}
                </option>
              ))}
            </select>
            {sep}
            <div className="flex shrink-0 items-center gap-1 px-1" role="group" aria-label={t("글자 색")}>
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onPointerDown={keepFocus}
                  onClick={() => onPatch({ color: c })}
                  aria-label={t("색 {c}", { c })}
                  aria-pressed={s.color.toLowerCase() === c}
                  className={`h-6 w-6 shrink-0 rounded-full border border-hairline transition-shadow ${
                    s.color.toLowerCase() === c ? "shadow-[0_0_0_2px_var(--color-paper),0_0_0_3.5px_var(--color-ink)]" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              {/* 직접 고르기 */}
              <label
                className={`relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-full border border-hairline ${
                  TEXT_COLORS.includes(s.color.toLowerCase()) ? "" : "shadow-[0_0_0_2px_var(--color-paper),0_0_0_3.5px_var(--color-ink)]"
                }`}
                style={{ background: "conic-gradient(#e2574c, #e8b23b, #5fae6e, #3c8bd9, #8e5bd6, #e2574c)" }}
                title={t("직접 고르기")}
              >
                <input
                  type="color"
                  value={s.color}
                  onChange={(e) => onPatch({ color: e.target.value.toLowerCase() })}
                  aria-label={t("색 직접 고르기")}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>
            {sep}
            {alignBtn("left", t("왼쪽 정렬"), AlignLeftIcon)}
            {alignBtn("center", t("가운데 정렬"), AlignCenterIcon)}
            {alignBtn("right", t("오른쪽 정렬"), AlignRightIcon)}
            {sep}
          </>
        )}

        <button type="button" onPointerDown={keepFocus} onClick={() => onRestack("front")} aria-label={t("맨 앞으로")} title={t("맨 앞으로")} className={icon}>
          <FrontIcon size={17} />
        </button>
        <button type="button" onPointerDown={keepFocus} onClick={() => onRestack("forward")} aria-label={t("앞으로")} title={t("앞으로")} className={icon}>
          <ForwardIcon size={17} />
        </button>
        <button type="button" onPointerDown={keepFocus} onClick={() => onRestack("backward")} aria-label={t("뒤로")} title={t("뒤로")} className={icon}>
          <BackwardIcon size={17} />
        </button>
        <button type="button" onPointerDown={keepFocus} onClick={() => onRestack("back")} aria-label={t("맨 뒤로")} title={t("맨 뒤로")} className={icon}>
          <BackIcon size={17} />
        </button>
        {sep}
        <button type="button" onClick={onDuplicate} aria-label={t("복제")} title={t("복제 (⌘D)")} className={icon}>
          <DuplicateIcon size={17} />
        </button>
        <button type="button" onClick={onDelete} aria-label={t("삭제")} title={t("삭제 (Delete)")} className={`${icon} hover:text-red-600`}>
          <TrashIcon size={17} />
        </button>
      </div>
    </div>
  );
}
