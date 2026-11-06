// 무드보드: 레퍼런스를 자유롭게 배치하는 캔버스
import { getSupabase } from "@/lib/supabase/client";
import { fetchRefs, type Ref } from "@/lib/refs";
import { tr } from "@/lib/i18n";

export type Moodboard = {
  id: string;
  name: string;
  background: string;
  collection_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BoardRefInfo = Pick<Ref, "id" | "title" | "storage_path" | "thumb_path" | "width" | "height" | "dominant_color">;

export type TextAlign = "left" | "center" | "right";

// 보드 위 요소 하나: 이미지(ref 있음) 또는 텍스트(ref 없음, content 있음)
export type BoardItem = {
  id: string;
  moodboard_id: string;
  kind: "image" | "text";
  ref_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  content: string | null;
  font_size: number | null;
  font_weight: number | null;
  color: string | null;
  align: TextAlign | null;
  refs: BoardRefInfo | null;
};

// 텍스트 기본값과 고를 수 있는 값
export const TEXT_DEFAULTS = { font_size: 40, font_weight: 600, align: "left" as TextAlign, width: 360 };
export const FONT_WEIGHTS: { value: number; label: string }[] = [
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "SemiBold" },
  { value: 700, label: "Bold" },
];
export const TEXT_COLORS = ["#111111", "#ffffff", "#6e6e6a", "#9b3d2e", "#2f4a3a", "#1f3a5f"];
export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 400;
export const TEXT_LINE_HEIGHT = 1.2;
export const TEXT_TRACKING_EM = -0.02;

// 화면·내보내기·미리보기가 같은 글꼴을 쓰도록
export const TEXT_FONT_FAMILY = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

export function textStyleOf(item: Pick<BoardItem, "font_size" | "font_weight" | "color" | "align">) {
  return {
    size: item.font_size ?? TEXT_DEFAULTS.font_size,
    weight: item.font_weight ?? TEXT_DEFAULTS.font_weight,
    color: item.color ?? "#111111",
    align: item.align ?? TEXT_DEFAULTS.align,
  };
}

export type MoodboardWithItems = Moodboard & { moodboard_items: BoardItem[] };

export const BACKGROUNDS = [
  { value: "#ffffff", label: "흰색" },
  { value: "#f4f4f2", label: "안개" },
  { value: "#e9e4da", label: "종이" },
  { value: "#1a1a1a", label: "먹" },
];

const BOARD_COLUMNS = "id, name, background, collection_id, created_at, updated_at";
const ITEM_COLUMNS =
  "id, moodboard_id, kind, ref_id, x, y, width, height, rotation, z_index, content, font_size, font_weight, color, align, refs(id, title, storage_path, thumb_path, width, height, dominant_color)";

function normalizeItems(rows: unknown): BoardItem[] {
  return ((rows ?? []) as (Omit<BoardItem, "refs"> & { refs: BoardRefInfo | BoardRefInfo[] | null })[]).map((r) => ({
    ...r,
    kind: r.kind === "text" ? "text" : "image",
    refs: Array.isArray(r.refs) ? r.refs[0] ?? null : r.refs,
  }));
}

export async function fetchMoodboards(): Promise<MoodboardWithItems[]> {
  const { data, error } = await getSupabase()
    .from("moodboards")
    .select(`${BOARD_COLUMNS}, moodboard_items(${ITEM_COLUMNS})`)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as (Moodboard & { moodboard_items: unknown })[]).map((b) => ({
    ...b,
    moodboard_items: normalizeItems(b.moodboard_items),
  }));
}

export async function fetchMoodboard(id: string): Promise<MoodboardWithItems | null> {
  const { data, error } = await getSupabase()
    .from("moodboards")
    .select(`${BOARD_COLUMNS}, moodboard_items(${ITEM_COLUMNS})`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const b = data as unknown as Moodboard & { moodboard_items: unknown };
  return { ...b, moodboard_items: normalizeItems(b.moodboard_items) };
}

// 처음 넣을 때 자리: 4줄 기둥에 차곡차곡 (나중에 자유롭게 옮김)
export function autoLayout(refs: Pick<Ref, "width" | "height">[], start = { x: 80, y: 80 }, columnWidth = 280, gap = 28, columns = 4) {
  const heights = new Array<number>(columns).fill(start.y);
  return refs.map((r) => {
    const ratio = r.width && r.height ? r.height / r.width : 1;
    const h = Math.round(columnWidth * ratio);
    let col = 0;
    for (let i = 1; i < columns; i++) if (heights[i] < heights[col]) col = i;
    const pos = { x: start.x + col * (columnWidth + gap), y: heights[col], width: columnWidth, height: h };
    heights[col] += h + gap;
    return pos;
  });
}

export async function createMoodboard(opts: { name: string; collectionId?: string | null }): Promise<Moodboard> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("moodboards")
    .insert({ name: opts.name.trim().slice(0, 60) || tr("새 무드보드"), collection_id: opts.collectionId ?? null })
    .select(BOARD_COLUMNS)
    .single();
  if (error) throw error;
  const board = data as Moodboard;

  // 컬렉션에서 만들면 그 안의 이미지(최대 60장)를 미리 깔아 둠
  if (opts.collectionId) {
    const refs = await fetchRefs({ collectionId: opts.collectionId }, 0, 60);
    if (refs.length) {
      const spots = autoLayout(refs);
      const { error: itemErr } = await supabase.from("moodboard_items").insert(
        refs.map((r, i) => ({ moodboard_id: board.id, ref_id: r.id, ...spots[i], z_index: i + 1 }))
      );
      if (itemErr) throw itemErr;
    }
  }
  return board;
}

export async function updateMoodboard(id: string, patch: Partial<Pick<Moodboard, "name" | "background">>): Promise<Moodboard> {
  const clean = { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 60) || tr("무드보드") } : {}) };
  const { data, error } = await getSupabase().from("moodboards").update(clean).eq("id", id).select(BOARD_COLUMNS).single();
  if (error) throw error;
  return data as Moodboard;
}

export async function touchMoodboard(id: string) {
  await getSupabase().from("moodboards").update({ updated_at: new Date().toISOString() }).eq("id", id);
}

export async function deleteMoodboard(id: string): Promise<void> {
  const { error } = await getSupabase().from("moodboards").delete().eq("id", id);
  if (error) throw error;
}

export async function addBoardItems(
  boardId: string,
  refs: Ref[],
  start: { x: number; y: number },
  zStart: number
): Promise<BoardItem[]> {
  if (!refs.length) return [];
  const spots = autoLayout(refs, start, 260, 24, Math.min(4, refs.length));
  const { data, error } = await getSupabase()
    .from("moodboard_items")
    .insert(refs.map((r, i) => ({ moodboard_id: boardId, ref_id: r.id, ...spots[i], z_index: zStart + i + 1 })))
    .select(ITEM_COLUMNS);
  if (error) throw error;
  return normalizeItems(data);
}

// 저장할 칸만 골라서 (refs 같은 함께 불러온 정보는 빼고)
function toRow(i: BoardItem) {
  const base = {
    id: i.id,
    moodboard_id: i.moodboard_id,
    kind: i.kind,
    ref_id: i.kind === "text" ? null : i.ref_id,
    x: Math.round(i.x),
    y: Math.round(i.y),
    width: Math.max(1, Math.round(i.width)),
    height: Math.max(1, Math.round(i.height)),
    rotation: i.rotation,
    z_index: i.z_index,
  };
  if (i.kind !== "text") return { ...base, content: null, font_size: null, font_weight: null, color: null, align: null };
  const s = textStyleOf(i);
  return {
    ...base,
    content: (i.content ?? "").slice(0, 5000),
    font_size: Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(s.size))),
    font_weight: s.weight,
    color: s.color.toLowerCase(),
    align: s.align,
  };
}

export async function saveBoardItems(items: BoardItem[]): Promise<void> {
  if (!items.length) return;
  const { error } = await getSupabase().from("moodboard_items").upsert(items.map(toRow), { onConflict: "id" });
  if (error) throw error;
}

export async function addTextItem(
  boardId: string,
  fields: { x: number; y: number; z_index: number; content: string; color: string }
): Promise<BoardItem> {
  const { data, error } = await getSupabase()
    .from("moodboard_items")
    .insert({
      moodboard_id: boardId,
      kind: "text",
      ref_id: null,
      x: Math.round(fields.x),
      y: Math.round(fields.y),
      width: TEXT_DEFAULTS.width,
      height: Math.round(TEXT_DEFAULTS.font_size * TEXT_LINE_HEIGHT),
      z_index: fields.z_index,
      content: fields.content,
      font_size: TEXT_DEFAULTS.font_size,
      font_weight: TEXT_DEFAULTS.font_weight,
      color: fields.color.toLowerCase(),
      align: TEXT_DEFAULTS.align,
    })
    .select(ITEM_COLUMNS)
    .single();
  if (error) throw error;
  return normalizeItems([data])[0];
}

// 복제: 같은 내용·모양을 살짝 비켜서, 맨 앞에
export async function duplicateBoardItems(items: BoardItem[], zStart: number, offset = 24): Promise<BoardItem[]> {
  if (!items.length) return [];
  const rows = items.map((i, n) => {
    const { id: _id, ...rest } = toRow({ ...i, x: i.x + offset, y: i.y + offset, z_index: zStart + n + 1 });
    void _id;
    return rest;
  });
  const { data, error } = await getSupabase().from("moodboard_items").insert(rows).select(ITEM_COLUMNS);
  if (error) throw error;
  return normalizeItems(data);
}

export async function deleteBoardItems(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await getSupabase().from("moodboard_items").delete().in("id", ids);
  if (error) throw error;
}
