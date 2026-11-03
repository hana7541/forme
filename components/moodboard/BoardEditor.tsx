"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { Dialog } from "@/components/Dialog";
import { Button } from "@/components/ui";
import { ChevronLeftIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { RefPicker } from "@/components/library/RefPicker";
import { onRefCreated } from "@/lib/events";
import {
  BACKGROUNDS,
  addBoardItems,
  deleteBoardItems,
  deleteMoodboard,
  saveBoardItems,
  updateMoodboard,
  type BoardItem,
  type MoodboardWithItems,
} from "@/lib/moodboards";
import { gridPath, signedUrls, type Ref } from "@/lib/refs";

type Drag =
  | { kind: "move"; id: string; sx: number; sy: number; ox: number; oy: number }
  | { kind: "resize"; id: string; sx: number; sy: number; ow: number; oh: number; ratio: number }
  | { kind: "pan"; sx: number; sy: number; px: number; py: number };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const MIN_SIZE = 40;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

const toolBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors hover:bg-haze disabled:opacity-40 disabled:hover:bg-transparent";

export function BoardEditor({ initial }: { initial: MoodboardWithItems }) {
  const router = useRouter();
  const { show } = useToast();

  const [name, setName] = useState(initial.name);
  const [background, setBackground] = useState(initial.background);
  const [items, setItems] = useState<BoardItem[]>(initial.moodboard_items);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragging, setDragging] = useState(false);
  const savedName = useRef(initial.name);

  const viewport = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const view = useRef({ zoom, pan });
  view.current = { zoom, pan };
  const drag = useRef<Drag | null>(null);
  const dirty = useRef<Set<string>>(new Set());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dark = background === "#1a1a1a";

  // ---------- 이미지 주소 ----------
  useEffect(() => {
    const paths = items.flatMap((i) => (i.refs ? [gridPath(i.refs)] : [])).filter((p) => !urls[p]);
    if (!paths.length) return;
    signedUrls(paths)
      .then((m) => setUrls((prev) => ({ ...prev, ...m })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // ---------- 저장 ----------
  const flush = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const ids = [...dirty.current];
    if (!ids.length) return;
    dirty.current.clear();
    const rows = itemsRef.current.filter((i) => ids.includes(i.id));
    setSaveState("saving");
    try {
      await saveBoardItems(rows);
      setSaveState("saved");
    } catch {
      ids.forEach((id) => dirty.current.add(id));
      setSaveState("error");
    }
  }, []);

  const markDirty = useCallback(
    (ids: string[]) => {
      ids.forEach((id) => dirty.current.add(id));
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flush(), 600);
    },
    [flush]
  );

  // 화면을 떠날 때 남은 변경 저장
  useEffect(() => () => void flush(), [flush]);

  const patchItem = useCallback(
    (id: string, patch: Partial<BoardItem>) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      markDirty([id]);
    },
    [markDirty]
  );

  // ---------- 화면 맞춤 / 확대 ----------
  const fit = useCallback((list: BoardItem[] = itemsRef.current) => {
    const el = viewport.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    if (!list.length) {
      setZoom(1);
      setPan({ x: 40, y: 40 });
      return;
    }
    const minX = Math.min(...list.map((i) => i.x));
    const minY = Math.min(...list.map((i) => i.y));
    const maxX = Math.max(...list.map((i) => i.x + i.width));
    const maxY = Math.max(...list.map((i) => i.y + i.height));
    const pad = 48;
    const z = clamp(Math.min((vw - pad * 2) / (maxX - minX || 1), (vh - pad * 2) / (maxY - minY || 1), 1.2), MIN_ZOOM, MAX_ZOOM);
    setZoom(z);
    setPan({ x: (vw - (maxX - minX) * z) / 2 - minX * z, y: (vh - (maxY - minY) * z) / 2 - minY * z });
  }, []);

  useEffect(() => {
    fit(initial.moodboard_items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomAt = useCallback((next: number, cx?: number, cy?: number) => {
    const el = viewport.current;
    if (!el) return;
    const { zoom: z, pan: p } = view.current;
    const nz = clamp(next, MIN_ZOOM, MAX_ZOOM);
    const px = cx ?? el.clientWidth / 2;
    const py = cy ?? el.clientHeight / 2;
    setZoom(nz);
    setPan({ x: px - (px - p.x) * (nz / z), y: py - (py - p.y) * (nz / z) });
  }, []);

  // 트랙패드: 두 손가락 = 이동, 핀치(또는 Cmd/Ctrl + 휠) = 확대
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(view.current.zoom * Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // 화면 가운데의 캔버스 좌표 (새 이미지를 놓을 자리)
  const centerWorld = useCallback(() => {
    const el = viewport.current;
    const { zoom: z, pan: p } = view.current;
    const w = el?.clientWidth ?? 800;
    const h = el?.clientHeight ?? 600;
    return { x: (w / 2 - p.x) / z - 260, y: (h / 2 - p.y) / z - 160 };
  }, []);

  const maxZ = () => itemsRef.current.reduce((m, i) => Math.max(m, i.z_index), 0);

  // ---------- 끌기 (이동 · 크기 · 화면 이동) ----------
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const z = view.current.zoom;
      if (d.kind === "pan") {
        setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) });
      } else if (d.kind === "move") {
        const x = d.ox + (e.clientX - d.sx) / z;
        const y = d.oy + (e.clientY - d.sy) / z;
        setItems((prev) => prev.map((i) => (i.id === d.id ? { ...i, x, y } : i)));
      } else {
        // 오른쪽 아래 손잡이: 비율 유지 (Shift를 누르면 자유롭게)
        let w = Math.max(MIN_SIZE, d.ow + (e.clientX - d.sx) / z);
        let h = Math.max(MIN_SIZE, d.oh + (e.clientY - d.sy) / z);
        if (!e.shiftKey) {
          h = w * d.ratio;
          if (h < MIN_SIZE) {
            h = MIN_SIZE;
            w = h / d.ratio;
          }
        }
        setItems((prev) => prev.map((i) => (i.id === d.id ? { ...i, width: w, height: h } : i)));
      }
    };
    const onUp = () => {
      const d = drag.current;
      drag.current = null;
      setDragging(false);
      if (d && d.kind !== "pan") markDirty([d.id]);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [markDirty]);

  function startPan(e: React.PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    setSelectedId(null);
    drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    setDragging(true);
  }

  function startMove(e: React.PointerEvent, item: BoardItem) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(item.id);
    drag.current = { kind: "move", id: item.id, sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y };
    setDragging(true);
  }

  function startResize(e: React.PointerEvent, item: BoardItem) {
    e.stopPropagation();
    e.preventDefault();
    drag.current = {
      kind: "resize",
      id: item.id,
      sx: e.clientX,
      sy: e.clientY,
      ow: item.width,
      oh: item.height,
      ratio: item.height / item.width || 1,
    };
    setDragging(true);
  }

  // ---------- 겹침 순서 · 빼기 ----------
  const restack = useCallback(
    (id: string, how: "front" | "back" | "forward" | "backward") => {
      const sorted = [...itemsRef.current].sort((a, b) => a.z_index - b.z_index);
      const idx = sorted.findIndex((i) => i.id === id);
      if (idx < 0) return;
      const [it] = sorted.splice(idx, 1);
      const to = how === "front" ? sorted.length : how === "back" ? 0 : how === "forward" ? Math.min(sorted.length, idx + 1) : Math.max(0, idx - 1);
      sorted.splice(to, 0, it);
      const z = new Map(sorted.map((i, n) => [i.id, n + 1]));
      const changed = itemsRef.current.filter((i) => z.get(i.id) !== i.z_index).map((i) => i.id);
      setItems((prev) => prev.map((i) => ({ ...i, z_index: z.get(i.id) ?? i.z_index })));
      markDirty(changed);
    },
    [markDirty]
  );

  const removeItem = useCallback(
    async (id: string) => {
      const before = itemsRef.current;
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedId(null);
      dirty.current.delete(id);
      try {
        await deleteBoardItems([id]);
      } catch {
        setItems(before);
        show("보드에서 빼지 못했어요.");
      }
    },
    [show]
  );

  // ---------- 키보드 ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const id = selectedId;
      if (e.key === "Escape") setSelectedId(null);
      if (!id) {
        if (e.key === "0" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          fit();
        }
        return;
      }
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        void removeItem(id);
      } else if (e.key === "]") {
        e.preventDefault();
        restack(id, e.metaKey || e.ctrlKey ? "front" : "forward");
      } else if (e.key === "[") {
        e.preventDefault();
        restack(id, e.metaKey || e.ctrlKey ? "back" : "backward");
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        patchItem(id, { x: item.x + dx, y: item.y + dy });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, removeItem, restack, patchItem, fit]);

  // ---------- 이미지 넣기 ----------
  const addRefs = useCallback(
    async (refs: Ref[]) => {
      if (!refs.length) return;
      try {
        const added = await addBoardItems(initial.id, refs, centerWorld(), maxZ());
        setItems((prev) => [...prev, ...added]);
        setSelectedId(added.at(-1)?.id ?? null);
        setSaveState("saved");
      } catch {
        show("보드에 넣지 못했어요.");
      }
    },
    [initial.id, centerWorld, show]
  );

  // 이 화면에서 이미지를 끌어다 놓거나 붙여넣으면: 라이브러리에 올리고 보드에도 놓음
  useEffect(() => onRefCreated((ref) => void addRefs([ref])), [addRefs]);

  // ---------- 보드 이름 · 배경 · 삭제 ----------
  async function saveName() {
    const v = name.trim() || "무드보드";
    setName(v);
    if (v === savedName.current) return;
    try {
      await updateMoodboard(initial.id, { name: v });
      savedName.current = v;
    } catch {
      show("이름을 바꾸지 못했어요.");
    }
  }

  async function changeBackground(v: string) {
    setBackground(v);
    try {
      await updateMoodboard(initial.id, { background: v });
    } catch {
      show("배경을 바꾸지 못했어요.");
    }
  }

  async function doDelete() {
    try {
      await deleteMoodboard(initial.id);
      dirty.current.clear();
      router.replace("/moodboards");
      show("무드보드를 지웠어요");
    } catch {
      show("무드보드를 지우지 못했어요.");
    }
  }

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const sortedItems = [...items].sort((a, b) => a.z_index - b.z_index);
  const saveLabel = saveState === "saving" ? "저장 중…" : saveState === "saved" ? "저장됨" : saveState === "error" ? "저장 실패" : "";

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-paper">
      {/* 위쪽 도구 막대 */}
      <div className="flex min-h-16 flex-wrap items-center gap-2 border-b border-hairline px-3 py-2 sm:px-5">
        <Link
          href="/moodboards"
          onClick={() => void flush()}
          aria-label="무드보드 목록으로"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-haze"
        >
          <ChevronLeftIcon />
        </Link>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void saveName()}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label="무드보드 이름"
          maxLength={60}
          className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-[18px] font-semibold tracking-[-0.03em] outline-none hover:bg-haze focus:bg-haze sm:max-w-sm"
        />
        <span className="hidden text-[12px] text-graphite sm:inline" role="status" aria-live="polite">
          {saveLabel}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <div className="mr-2 flex items-center gap-1.5" role="group" aria-label="배경색">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => void changeBackground(b.value)}
                aria-label={`배경 ${b.label}`}
                aria-pressed={background === b.value}
                className={`h-6 w-6 rounded-full border transition-shadow ${
                  background === b.value ? "shadow-[0_0_0_2px_var(--color-paper),0_0_0_3.5px_var(--color-ink)]" : "border-hairline"
                }`}
                style={{ backgroundColor: b.value }}
              />
            ))}
          </div>
          <button type="button" onClick={() => setPicking(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-medium text-paper hover:opacity-85">
            <PlusIcon size={15} />
            이미지 추가
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} aria-label="무드보드 지우기" className="grid h-10 w-10 place-items-center rounded-full text-graphite hover:bg-haze hover:text-red-600">
            <TrashIcon size={16} />
          </button>
        </div>
      </div>

      {/* 캔버스 */}
      <div
        ref={viewport}
        onPointerDown={startPan}
        className={`relative min-h-0 flex-1 touch-none select-none overflow-hidden ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ backgroundColor: background }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {sortedItems.map((item) => {
            const path = item.refs ? gridPath(item.refs) : null;
            const url = path ? urls[path] : undefined;
            const isSel = item.id === selectedId;
            return (
              <div
                key={item.id}
                onPointerDown={(e) => startMove(e, item)}
                className="absolute cursor-move"
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                  zIndex: item.z_index,
                  transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
                  backgroundColor: item.refs?.dominant_color ?? "#f4f4f2",
                }}
              >
                {url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={item.refs?.title ?? ""} draggable={false} className="pointer-events-none h-full w-full object-cover" />
                )}
                {isSel && (
                  <>
                    <span
                      className="pointer-events-none absolute inset-0"
                      style={{ boxShadow: `0 0 0 ${2 / zoom}px ${dark ? "#ffffff" : "#000000"}` }}
                    />
                    <span
                      onPointerDown={(e) => startResize(e, item)}
                      aria-label="크기 조절"
                      className="absolute cursor-nwse-resize rounded-full border-2 bg-white"
                      style={{
                        width: 14 / zoom,
                        height: 14 / zoom,
                        right: -7 / zoom,
                        bottom: -7 / zoom,
                        borderWidth: 2 / zoom,
                        borderColor: "#000000",
                      }}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {items.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className={`max-w-sm text-center ${dark ? "text-white/70" : "text-graphite"}`}>
              <p className={`text-[22px] font-semibold tracking-[-0.03em] ${dark ? "text-white" : "text-ink"}`}>빈 무드보드예요</p>
              <p className="mt-2 text-[14px] leading-relaxed">
                ‘이미지 추가’로 라이브러리에서 고르거나, 파일을 이 화면에 끌어다 놓으세요. 올린 이미지는 라이브러리에도 저장돼요.
              </p>
            </div>
          </div>
        )}

        {/* 고른 이미지용 작은 도구 */}
        {selected && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-1/2 top-4 z-[5] flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-hairline bg-paper p-1"
          >
            <button type="button" className={toolBtn} onClick={() => restack(selected.id, "front")}>
              맨 앞으로
            </button>
            <button type="button" className={toolBtn} onClick={() => restack(selected.id, "back")}>
              맨 뒤로
            </button>
            <button type="button" className={`${toolBtn} hover:text-red-600`} onClick={() => void removeItem(selected.id)}>
              보드에서 빼기
            </button>
          </div>
        )}

        {/* 확대 · 축소 */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-4 right-4 z-[5] flex items-center gap-0.5 rounded-full border border-hairline bg-paper p-1"
        >
          <button type="button" aria-label="축소" className={`${toolBtn} w-9 justify-center px-0 text-[16px]`} onClick={() => zoomAt(zoom / 1.25)}>
            −
          </button>
          <button type="button" className={`${toolBtn} min-w-[3.5rem] justify-center tabular-nums`} onClick={() => zoomAt(1)} aria-label="100%로 보기">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" aria-label="확대" className={`${toolBtn} w-9 justify-center px-0 text-[16px]`} onClick={() => zoomAt(zoom * 1.25)}>
            +
          </button>
          <button type="button" className={toolBtn} onClick={() => fit()}>
            맞춤
          </button>
        </div>

        <p className={`pointer-events-none absolute bottom-5 left-5 z-[5] hidden text-[12px] lg:block ${dark ? "text-white/50" : "text-graphite"}`}>
          빈 곳을 끌면 화면 이동, 핀치로 확대, Delete로 빼기, [ ]로 겹침 순서
        </p>
      </div>

      <RefPicker open={picking} onClose={() => setPicking(false)} onPick={(refs) => void addRefs(refs)} confirmLabel={(n) => `${n}개 보드에 넣기`} />

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="무드보드를 지울까요?">
        <p className="text-[15px] leading-relaxed text-graphite">
          배치만 지워지고, 보드에 있던 이미지는 라이브러리에 그대로 남아요.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
            취소
          </Button>
          <Button type="button" onClick={() => void doDelete()} className="bg-red-600! text-white!">
            지우기
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
