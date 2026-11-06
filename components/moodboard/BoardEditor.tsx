"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useShell } from "@/components/shell/AppShell";
import { useT } from "@/lib/i18n";
import { Dialog } from "@/components/Dialog";
import { Button } from "@/components/ui";
import { ChevronLeftIcon, DownloadIcon, PlusIcon, TextIcon, TrashIcon } from "@/components/icons";
import { TextItem } from "@/components/moodboard/TextItem";
import { SelectionToolbar, type Restack } from "@/components/moodboard/SelectionToolbar";
import { MenuItem, Popover } from "@/components/Popover";
import { exportBoardPdf, exportBoardPng, type ExportProgress } from "@/lib/boardExport";
import { RefPicker } from "@/components/library/RefPicker";
import { onRefCreated } from "@/lib/events";
import {
  BACKGROUNDS,
  TEXT_DEFAULTS,
  addBoardItems,
  addTextItem,
  duplicateBoardItems,
  deleteBoardItems,
  deleteMoodboard,
  saveBoardItems,
  updateMoodboard,
  type BoardItem,
  type MoodboardWithItems,
} from "@/lib/moodboards";
import { gridPath, signedUrls, type Ref } from "@/lib/refs";

type Drag =
  | { kind: "move"; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean; wasSelected: boolean; pointer: string }
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
  const { reloadCounts } = useShell();
  const { t } = useT();

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
  // 텍스트 편집 중인 요소, 방금 만든 텍스트(전체 선택해서 바로 덮어 쓰게)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [freshTextId, setFreshTextId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<{ kind: "png" | "pdf"; progress: ExportProgress | null } | null>(null);
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
        if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
        d.moved = true;
        const x = d.ox + (e.clientX - d.sx) / z;
        const y = d.oy + (e.clientY - d.sy) / z;
        setItems((prev) => prev.map((i) => (i.id === d.id ? { ...i, x, y } : i)));
      } else if (itemsRef.current.find((i) => i.id === d.id)?.kind === "text") {
        // 텍스트: 너비만 바꾸고 높이는 글에 맞춰 저절로
        const w = Math.max(MIN_SIZE, d.ow + (e.clientX - d.sx) / z);
        setItems((prev) => prev.map((i) => (i.id === d.id ? { ...i, width: w } : i)));
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
      if (!d || d.kind === "pan") return;
      if (d.kind === "move" && !d.moved) {
        // 손가락으로 이미 고른 텍스트를 한 번 더 누르면 편집 (마우스는 더블클릭)
        const it = itemsRef.current.find((i) => i.id === d.id);
        if (it?.kind === "text" && d.wasSelected && d.pointer !== "mouse") {
          setFreshTextId(null);
          setEditingId(d.id);
        }
        return;
      }
      markDirty([d.id]);
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

  // 편집 중인 입력칸을 닫음 (닫힐 때 내용이 저장됨)
  function stopEditing() {
    if (editingId) (document.activeElement as HTMLElement | null)?.blur?.();
  }

  function startPan(e: React.PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    stopEditing();
    setSelectedId(null);
    drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    setDragging(true);
  }

  function startMove(e: React.PointerEvent, item: BoardItem) {
    if (e.button !== 0) return;
    e.stopPropagation();
    // 편집 중인 텍스트 안을 누르면 글자 선택에 맡김
    if (item.id === editingId) return;
    stopEditing();
    e.preventDefault();
    const wasSelected = selectedId === item.id;
    setSelectedId(item.id);
    drag.current = {
      kind: "move",
      id: item.id,
      sx: e.clientX,
      sy: e.clientY,
      ox: item.x,
      oy: item.y,
      moved: false,
      wasSelected,
      pointer: e.pointerType,
    };
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
    (id: string, how: Restack) => {
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
      setEditingId((cur) => (cur === id ? null : cur));
      dirty.current.delete(id);
      try {
        await deleteBoardItems([id]);
      } catch {
        setItems(before);
        show(t("보드에서 빼지 못했어요."));
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
      if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        void addTextRef.current();
        return;
      }
      if (id && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        void duplicateRef.current(id);
        return;
      }
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
        show(t("보드에 넣지 못했어요."));
      }
    },
    [initial.id, centerWorld, show]
  );

  // ---------- 텍스트 ----------
  // 화면 가운데에 새 글 상자를 만들고 바로 편집
  const addText = useCallback(async () => {
    const el = viewport.current;
    const { zoom: z, pan: p } = view.current;
    const cx = ((el?.clientWidth ?? 800) / 2 - p.x) / z;
    const cy = ((el?.clientHeight ?? 600) / 2 - p.y) / z;
    try {
      const item = await addTextItem(initial.id, {
        x: cx - TEXT_DEFAULTS.width / 2,
        y: cy - TEXT_DEFAULTS.font_size / 2,
        z_index: maxZ() + 1,
        content: t("텍스트"),
        color: background === "#1a1a1a" ? "#ffffff" : "#111111",
      });
      setItems((prev) => [...prev, item]);
      setSelectedId(item.id);
      setFreshTextId(item.id);
      setEditingId(item.id);
      setSaveState("saved");
    } catch {
      show(t("텍스트를 넣지 못했어요."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id, background, show, t]);

  const duplicate = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      await flush();
      try {
        const [copy] = await duplicateBoardItems([item], maxZ());
        if (!copy) return;
        setItems((prev) => [...prev, copy]);
        setSelectedId(copy.id);
        setSaveState("saved");
      } catch {
        show(t("복제하지 못했어요."));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flush, show, t]
  );

  // 키보드 처리에서 최신 함수를 쓰도록
  const addTextRef = useRef(addText);
  addTextRef.current = addText;
  const duplicateRef = useRef(duplicate);
  duplicateRef.current = duplicate;

  // 편집 끝: 비었으면 지우고, 아니면 저장
  const endEdit = useCallback(
    (id: string) => {
      setEditingId((cur) => (cur === id ? null : cur));
      setFreshTextId(null);
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      if (!(item.content ?? "").trim()) void removeItem(id);
      else void flush();
    },
    [removeItem, flush]
  );

  // 글 상자 높이가 바뀌면 기록 (내보내기·화면 맞춤에 씀)
  const measureText = useCallback(
    (id: string, height: number) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item || !height || Math.abs(item.height - height) < 0.5) return;
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, height } : i)));
      markDirty([id]);
    },
    [markDirty]
  );

  // 이 화면에서 이미지를 끌어다 놓거나 붙여넣으면: 라이브러리에 올리고 보드에도 놓음
  useEffect(() => onRefCreated((ref) => void addRefs([ref])), [addRefs]);

  // ---------- 보드 이름 · 배경 · 삭제 ----------
  async function saveName() {
    const v = name.trim() || t("무드보드");
    setName(v);
    if (v === savedName.current) return;
    try {
      await updateMoodboard(initial.id, { name: v });
      savedName.current = v;
    } catch {
      show(t("이름을 바꾸지 못했어요."));
    }
  }

  async function changeBackground(v: string) {
    setBackground(v);
    try {
      await updateMoodboard(initial.id, { background: v });
    } catch {
      show(t("배경을 바꾸지 못했어요."));
    }
  }

  // 내보내기: 지금 보이는 배치를 그대로 PNG 또는 PDF로
  async function doExport(kind: "png" | "pdf") {
    if (!items.length) {
      show(t("보드가 비어 있어요. 이미지를 먼저 넣어 주세요."));
      return;
    }
    await flush();
    setSelectedId(null);
    setExporting({ kind, progress: null });
    try {
      const run = kind === "png" ? exportBoardPng : exportBoardPdf;
      await run(name, itemsRef.current, background, (progress) => setExporting({ kind, progress }));
      show(kind === "png" ? t("이미지로 내려받았어요") : t("PDF로 내려받았어요"));
    } catch (e) {
      show(e instanceof Error && e.message ? t(e.message) : t("내보내지 못했어요. 잠시 후 다시 시도해 주세요."));
    } finally {
      setExporting(null);
    }
  }

  async function doDelete() {
    try {
      await deleteMoodboard(initial.id);
      dirty.current.clear();
      void reloadCounts();
      router.replace("/moodboards");
      show(t("무드보드를 지웠어요"));
    } catch {
      show(t("무드보드를 지우지 못했어요."));
    }
  }

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const sortedItems = [...items].sort((a, b) => a.z_index - b.z_index);
  const saveLabel = saveState === "saving" ? t("저장 중…") : saveState === "saved" ? t("저장됨") : saveState === "error" ? t("저장 실패") : "";

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-paper">
      {/* 위쪽 도구 막대 */}
      <div className="flex min-h-16 flex-wrap items-center gap-2 border-b border-hairline px-3 py-2 sm:px-5">
        <Link
          href="/moodboards"
          onClick={() => void flush()}
          aria-label={t("무드보드 목록으로")}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-haze"
        >
          <ChevronLeftIcon />
        </Link>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void saveName()}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label={t("무드보드 이름")}
          maxLength={60}
          className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-[18px] font-semibold tracking-[-0.03em] outline-none hover:bg-haze focus:bg-haze sm:max-w-sm"
        />
        <span className="hidden text-[12px] text-graphite sm:inline" role="status" aria-live="polite">
          {saveLabel}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <div className="mr-2 flex items-center gap-1.5" role="group" aria-label={t("배경색")}>
            {BACKGROUNDS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => void changeBackground(b.value)}
                aria-label={t("배경 {name}", { name: t(b.label) })}
                aria-pressed={background === b.value}
                className={`h-6 w-6 rounded-full border transition-shadow ${
                  background === b.value ? "shadow-[0_0_0_2px_var(--color-paper),0_0_0_3.5px_var(--color-ink)]" : "border-hairline"
                }`}
                style={{ backgroundColor: b.value }}
              />
            ))}
          </div>
          <Popover
            label={t("내보내기")}
            align="end"
            width="w-64"
            trigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                disabled={!!exporting}
                aria-expanded={open}
                className={`inline-flex h-10 items-center gap-2 rounded-full border border-hairline px-4 text-[13px] font-medium transition-colors hover:border-ink disabled:opacity-60 ${open ? "border-ink" : ""}`}
              >
                {exporting ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-hairline border-t-ink" aria-hidden="true" />
                ) : (
                  <DownloadIcon size={15} />
                )}
                <span className="hidden sm:inline">
                  {exporting
                    ? exporting.progress && exporting.progress.done < exporting.progress.total
                      ? t("이미지 받는 중 {done}/{total}", { done: exporting.progress.done, total: exporting.progress.total })
                      : t("만드는 중…")
                    : t("내보내기")}
                </span>
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  onClick={() => {
                    close();
                    void doExport("png");
                  }}
                >
                  <span className="block">{t("이미지 (PNG)")}</span>
                  <span className="block whitespace-normal text-[12px] font-normal leading-snug text-graphite">{t("보드 그대로 한 장, 화면의 2배 선명도")}</span>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    close();
                    void doExport("pdf");
                  }}
                >
                  <span className="block">{t("PDF")}</span>
                  <span className="block whitespace-normal text-[12px] font-normal leading-snug text-graphite">{t("보드 크기에 맞춘 한 페이지")}</span>
                </MenuItem>
              </>
            )}
          </Popover>
          <button
            type="button"
            onClick={() => void addText()}
            aria-label={t("텍스트 추가 (T)")}
            title={t("텍스트 추가 (T)")}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline px-3 text-[13px] font-medium transition-colors hover:border-ink sm:px-4"
          >
            <TextIcon size={16} />
            <span className="hidden sm:inline">{t("텍스트")}</span>
          </button>
          <button type="button" onClick={() => setPicking(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-medium text-paper hover:opacity-85">
            <PlusIcon size={15} />
            {t("이미지 추가")}
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} aria-label={t("무드보드 지우기")} className="grid h-10 w-10 place-items-center rounded-full text-graphite hover:bg-haze hover:text-red-600">
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
            if (item.kind === "text") {
              return (
                <TextItem
                  key={item.id}
                  item={item}
                  selected={item.id === selectedId}
                  editing={item.id === editingId}
                  selectAllOnEdit={item.id === freshTextId}
                  zoom={zoom}
                  outline={dark ? "#ffffff" : "#000000"}
                  onPointerDown={(e) => startMove(e, item)}
                  onDoubleClick={() => {
                    setSelectedId(item.id);
                    setFreshTextId(null);
                    setEditingId(item.id);
                  }}
                  onResizeStart={(e) => startResize(e, item)}
                  onMeasure={(h) => measureText(item.id, h)}
                  onChange={(content) => patchItem(item.id, { content })}
                  onEditEnd={() => endEdit(item.id)}
                />
              );
            }
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
                      aria-label={t("크기 조절")}
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
              <p className={`text-[22px] font-semibold tracking-[-0.03em] ${dark ? "text-white" : "text-ink"}`}>{t("빈 무드보드예요")}</p>
              <p className="mt-2 text-[14px] leading-relaxed">
                {t("‘이미지 추가’로 라이브러리에서 고르거나, 파일을 이 화면에 끌어다 놓으세요. ‘텍스트’로 글도 쓸 수 있어요.")}
              </p>
            </div>
          </div>
        )}

        {/* 고른 요소용 도구 (고른 것이 있을 때만) */}
        {selected && (
          <SelectionToolbar
            item={selected}
            editing={selected.id === editingId}
            onPatch={(patch) => patchItem(selected.id, patch)}
            onEdit={() => {
              setFreshTextId(null);
              setEditingId(selected.id);
            }}
            onDuplicate={() => void duplicate(selected.id)}
            onDelete={() => void removeItem(selected.id)}
            onRestack={(how) => restack(selected.id, how)}
          />
        )}

        {/* 확대 · 축소 */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-4 right-4 z-[5] flex items-center gap-0.5 rounded-full border border-hairline bg-paper p-1"
        >
          <button type="button" aria-label={t("축소")} className={`${toolBtn} w-9 justify-center px-0 text-[16px]`} onClick={() => zoomAt(zoom / 1.25)}>
            −
          </button>
          <button type="button" className={`${toolBtn} min-w-[3.5rem] justify-center tabular-nums`} onClick={() => zoomAt(1)} aria-label={t("100%로 보기")}>
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" aria-label={t("확대")} className={`${toolBtn} w-9 justify-center px-0 text-[16px]`} onClick={() => zoomAt(zoom * 1.25)}>
            +
          </button>
          <button type="button" className={toolBtn} onClick={() => fit()}>
            {t("맞춤")}
          </button>
        </div>

        <p className={`pointer-events-none absolute bottom-5 left-5 z-[5] hidden text-[12px] lg:block ${dark ? "text-white/50" : "text-graphite"}`}>
          {t("빈 곳을 끌면 화면 이동 · 핀치로 확대 · T 텍스트 · 더블클릭 편집 · ⌘D 복제 · Delete 빼기 · [ ] 겹침 순서")}
        </p>
      </div>

      <RefPicker open={picking} onClose={() => setPicking(false)} onPick={(refs) => void addRefs(refs)} confirmLabel={(n) => t("{n}개 보드에 넣기", { n })} />

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t("무드보드를 지울까요?")}>
        <p className="text-[15px] leading-relaxed text-graphite">
          {t("배치만 지워지고, 보드에 있던 이미지는 라이브러리에 그대로 남아요.")}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
            {t("취소")}
          </Button>
          <Button type="button" onClick={() => void doDelete()} className="bg-red-600! text-white!">
            {t("지우기")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
