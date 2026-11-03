// 레퍼런스(이미지 1장)를 창고에서 꺼내고, 넣고, 고치고, 지우는 도구 모음
import { getSupabase } from "@/lib/supabase/client";
import { fileExtension, prepareImage } from "@/lib/image";

export const BUCKET = "refs";
export const PAGE_SIZE = 40;

export type Ref = {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  memo: string;
  source_url: string | null;
  storage_path: string;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  mime_type: string | null;
  is_favorite: boolean;
  dominant_color: string | null;
  created_at: string;
  updated_at: string;
};

export type Tag = { id: string; name: string };

export type RefFilter = {
  favorites?: boolean;
  categoryId?: string | null;
};

const REF_COLUMNS =
  "id, user_id, category_id, title, memo, source_url, storage_path, thumb_path, width, height, file_size, mime_type, is_favorite, dominant_color, created_at, updated_at";

export function matchesFilter(ref: Ref, f: RefFilter) {
  if (f.favorites && !ref.is_favorite) return false;
  if (f.categoryId && ref.category_id !== f.categoryId) return false;
  return true;
}

// ---------- 목록 ----------

export async function fetchRefs(filter: RefFilter, offset: number): Promise<Ref[]> {
  let query = getSupabase()
    .from("refs")
    .select(REF_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (filter.favorites) query = query.eq("is_favorite", true);
  if (filter.categoryId) query = query.eq("category_id", filter.categoryId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Ref[];
}

export async function fetchRef(id: string): Promise<Ref | null> {
  const { data, error } = await getSupabase().from("refs").select(REF_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Ref | null) ?? null;
}

// ---------- 이미지 주소 (비공개 상자라 1시간짜리 임시 주소를 받아 씀) ----------

const urlCache = new Map<string, { url: string; expires: number }>();
const URL_TTL_SECONDS = 60 * 60;

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const result: Record<string, string> = {};
  const missing: string[] = [];

  for (const p of paths) {
    const hit = urlCache.get(p);
    if (hit && hit.expires > now + 60_000) result[p] = hit.url;
    else missing.push(p);
  }

  if (missing.length) {
    const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrls(missing, URL_TTL_SECONDS);
    if (error) throw error;
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) {
        urlCache.set(item.path, { url: item.signedUrl, expires: now + URL_TTL_SECONDS * 1000 });
        result[item.path] = item.signedUrl;
      }
    }
  }
  return result;
}

export function gridPath(ref: Ref) {
  return ref.thumb_path ?? ref.storage_path;
}

// ---------- 올리기 ----------

function titleFromFile(file: File, pasted: boolean) {
  if (pasted) return "";
  const base = file.name.replace(/\.[^.]+$/, "").trim();
  return base.slice(0, 120);
}

export async function uploadRef(
  file: File,
  opts: { userId: string; categoryId?: string | null; pasted?: boolean }
): Promise<Ref> {
  const supabase = getSupabase();
  const storage = supabase.storage.from(BUCKET);
  const id = crypto.randomUUID();
  const ext = fileExtension(file);
  const originalPath = `${opts.userId}/${id}.${ext}`;

  const prepared = await prepareImage(file);

  const { error: upErr } = await storage.upload(originalPath, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (upErr) throw upErr;

  let thumbPath: string | null = null;
  if (prepared.thumb && prepared.thumbExt) {
    const p = `${opts.userId}/thumbs/${id}.${prepared.thumbExt}`;
    const { error: thErr } = await storage.upload(p, prepared.thumb, {
      contentType: prepared.thumb.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (!thErr) thumbPath = p; // 썸네일이 실패해도 원본으로 보여 주면 되니 계속 진행
  }

  const { data, error } = await supabase
    .from("refs")
    .insert({
      id,
      category_id: opts.categoryId ?? null,
      title: titleFromFile(file, !!opts.pasted),
      storage_path: originalPath,
      thumb_path: thumbPath,
      width: prepared.width || null,
      height: prepared.height || null,
      file_size: file.size,
      mime_type: file.type,
      dominant_color: prepared.color,
    })
    .select(REF_COLUMNS)
    .single();

  if (error) {
    // 기록에 실패하면 올린 파일도 치워서 고아 파일이 남지 않게
    await storage.remove([originalPath, ...(thumbPath ? [thumbPath] : [])]);
    throw error;
  }
  return data as Ref;
}

// ---------- 고치기 / 지우기 ----------

export type RefPatch = Partial<Pick<Ref, "title" | "memo" | "source_url" | "category_id" | "is_favorite">>;

export async function updateRef(id: string, patch: RefPatch): Promise<Ref> {
  const { data, error } = await getSupabase().from("refs").update(patch).eq("id", id).select(REF_COLUMNS).single();
  if (error) throw error;
  return data as Ref;
}

export async function deleteRef(ref: Ref): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("refs").delete().eq("id", ref.id);
  if (error) throw error;
  const paths = [ref.storage_path, ...(ref.thumb_path ? [ref.thumb_path] : [])];
  await supabase.storage.from(BUCKET).remove(paths);
  paths.forEach((p) => urlCache.delete(p));
}

// ---------- 태그 ----------

export async function fetchAllTags(): Promise<Tag[]> {
  const { data, error } = await getSupabase().from("tags").select("id, name").order("name");
  if (error) throw error;
  return (data ?? []) as Tag[];
}

export async function fetchRefTags(refId: string): Promise<Tag[]> {
  const { data, error } = await getSupabase()
    .from("ref_tags")
    .select("tags(id, name)")
    .eq("ref_id", refId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { tags: Tag | Tag[] | null }[];
  return rows
    .flatMap((r) => (Array.isArray(r.tags) ? r.tags : r.tags ? [r.tags] : []))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export function normalizeTagName(raw: string) {
  return raw.replace(/^#/, "").replace(/\s+/g, " ").trim().slice(0, 30);
}

async function findOrCreateTag(name: string): Promise<Tag> {
  const supabase = getSupabase();
  const existing = await supabase.from("tags").select("id, name").eq("name", name).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as Tag;

  const created = await supabase.from("tags").insert({ name }).select("id, name").single();
  if (created.error) {
    // 거의 동시에 같은 태그를 만든 경우: 다시 찾아봄
    const again = await supabase.from("tags").select("id, name").eq("name", name).maybeSingle();
    if (again.data) return again.data as Tag;
    throw created.error;
  }
  return created.data as Tag;
}

export async function addTagToRef(refId: string, rawName: string): Promise<Tag> {
  const name = normalizeTagName(rawName);
  if (!name) throw new Error("태그 이름이 비어 있어요.");
  const tag = await findOrCreateTag(name);
  const { error } = await getSupabase().from("ref_tags").insert({ ref_id: refId, tag_id: tag.id });
  // 이미 붙어 있는 태그면(중복) 그냥 성공으로 처리
  if (error && error.code !== "23505") throw error;
  return tag;
}

export async function removeTagFromRef(refId: string, tagId: string): Promise<void> {
  const { error } = await getSupabase().from("ref_tags").delete().eq("ref_id", refId).eq("tag_id", tagId);
  if (error) throw error;
}
