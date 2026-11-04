// 레퍼런스(이미지 1장)를 창고에서 꺼내고, 넣고, 고치고, 지우는 도구 모음
import { getSupabase } from "@/lib/supabase/client";
import { fileExtension, prepareImage } from "@/lib/image";
import { tr } from "@/lib/i18n";

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
export type TagWithCount = Tag & { ref_count: number };

export type RefFilter = {
  q?: string | null;
  favorites?: boolean;
  categoryId?: string | null;
  tagId?: string | null;
  collectionId?: string | null;
  oldestFirst?: boolean;
};

const REF_COLUMNS =
  "id, user_id, category_id, title, memo, source_url, storage_path, thumb_path, width, height, file_size, mime_type, is_favorite, dominant_color, created_at, updated_at";

// 검색어가 있으면 "새로 생긴 이미지가 이 목록에 들어가는지"를 화면에서 판단하기 어려워 다시 불러오게 함
export function matchesFilter(ref: Ref, f: RefFilter) {
  if (f.q) return false;
  if (f.tagId) return false;
  if (f.favorites && !ref.is_favorite) return false;
  if (f.categoryId && ref.category_id !== f.categoryId) return false;
  return true;
}

function rpcArgs(f: RefFilter) {
  return {
    q: f.q?.trim() || null,
    fav: !!f.favorites,
    cat: f.categoryId || null,
    tag: f.tagId || null,
    coll: f.collectionId || null,
  };
}

// ---------- 목록 ----------

export async function fetchRefs(filter: RefFilter, offset: number, limit = PAGE_SIZE): Promise<Ref[]> {
  const { data, error } = await getSupabase().rpc("list_refs", {
    ...rpcArgs(filter),
    newest: !filter.oldestFirst,
    lim: limit,
    off: offset,
  });
  if (error) throw error;
  return (data ?? []) as Ref[];
}

export async function countRefs(filter: RefFilter): Promise<number> {
  const { data, error } = await getSupabase().rpc("count_refs", rpcArgs(filter));
  if (error) throw error;
  return Number(data ?? 0);
}

export async function fetchRef(id: string): Promise<Ref | null> {
  const { data, error } = await getSupabase().from("refs").select(REF_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Ref | null) ?? null;
}

export async function fetchAllRefs(onPage?: (n: number) => void): Promise<Ref[]> {
  const out: Ref[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await getSupabase()
      .from("refs")
      .select(REF_COLUMNS)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + 499);
    if (error) throw error;
    const rows = (data ?? []) as Ref[];
    out.push(...rows);
    onPage?.(out.length);
    if (rows.length < 500) break;
  }
  return out;
}

// ---------- 이미지 주소 (비공개 상자라 1시간짜리 임시 주소를 받아 씀) ----------

const urlCache = new Map<string, { url: string; expires: number }>();
const URL_TTL_SECONDS = 60 * 60;

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const result: Record<string, string> = {};
  const missing: string[] = [];

  for (const p of new Set(paths)) {
    const hit = urlCache.get(p);
    if (hit && hit.expires > now + 60_000) result[p] = hit.url;
    else missing.push(p);
  }

  for (let i = 0; i < missing.length; i += 100) {
    const batch = missing.slice(i, i + 100);
    const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrls(batch, URL_TTL_SECONDS);
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

export function gridPath(ref: Pick<Ref, "thumb_path" | "storage_path">) {
  return ref.thumb_path ?? ref.storage_path;
}

// ---------- 올리기 ----------

export type UploadTarget = { categoryId?: string | null; collectionId?: string | null };

type FinalizeInput = {
  id: string;
  userId: string;
  originalPath: string;
  file: File;
  title: string;
  sourceUrl?: string | null;
  target: UploadTarget;
  extra?: Partial<Pick<Ref, "memo" | "is_favorite" | "created_at">>;
};

// 원본이 Storage에 들어간 뒤: 썸네일 만들고, 기록을 남기고, 컬렉션에 넣기
async function finalizeUpload(input: FinalizeInput): Promise<Ref> {
  const supabase = getSupabase();
  const storage = supabase.storage.from(BUCKET);
  const prepared = await prepareImage(input.file).catch(() => null);

  let thumbPath: string | null = null;
  if (prepared?.thumb && prepared.thumbExt) {
    const p = `${input.userId}/thumbs/${input.id}.${prepared.thumbExt}`;
    const { error } = await storage.upload(p, prepared.thumb, {
      contentType: prepared.thumb.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (!error) thumbPath = p; // 썸네일이 실패해도 원본으로 보여 주면 되니 계속 진행
  }

  const { data, error } = await supabase
    .from("refs")
    .insert({
      id: input.id,
      category_id: input.target.categoryId ?? null,
      title: input.title.slice(0, 120),
      source_url: input.sourceUrl ?? null,
      storage_path: input.originalPath,
      thumb_path: thumbPath,
      width: prepared?.width || null,
      height: prepared?.height || null,
      file_size: input.file.size,
      mime_type: input.file.type,
      dominant_color: prepared?.color ?? null,
      ...(input.extra ?? {}),
    })
    .select(REF_COLUMNS)
    .single();

  if (error) {
    // 기록에 실패하면 올린 파일도 치워서 고아 파일이 남지 않게
    await storage.remove([input.originalPath, ...(thumbPath ? [thumbPath] : [])]);
    throw error;
  }

  if (input.target.collectionId) {
    await supabase.from("collection_refs").insert({ collection_id: input.target.collectionId, ref_id: input.id });
  }
  return data as Ref;
}

export async function uploadRef(
  file: File,
  opts: {
    userId: string;
    target: UploadTarget;
    pasted?: boolean;
    title?: string;
    sourceUrl?: string | null;
    extra?: FinalizeInput["extra"];
  }
): Promise<Ref> {
  const id = crypto.randomUUID();
  const originalPath = `${opts.userId}/${id}.${fileExtension(file)}`;

  const { error } = await getSupabase().storage.from(BUCKET).upload(originalPath, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;

  const title = opts.title ?? (opts.pasted ? "" : file.name.replace(/\.[^.]+$/, "").trim());
  return finalizeUpload({
    id,
    userId: opts.userId,
    originalPath,
    file,
    title,
    sourceUrl: opts.sourceUrl,
    target: opts.target,
    extra: opts.extra,
  });
}

// URL로 저장: 서버가 이미지를 받아 내 폴더에 넣고 → 브라우저가 썸네일과 기록을 마무리
export async function saveFromUrl(url: string, opts: { userId: string; target: UploadTarget }): Promise<Ref> {
  const supabase = getSupabase();
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error(tr("다시 로그인해 주세요."));

  const res = await fetch("/api/fetch-image", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    vars?: Record<string, string | number>;
    id?: string;
    path?: string;
    mime?: string;
    size?: number;
    title?: string;
    sourceUrl?: string;
  };
  if (!res.ok || !body.id || !body.path || !body.mime) throw new Error(body.error ? tr(body.error, body.vars) : tr("저장하지 못했어요."));

  // 방금 저장된 원본을 다시 받아서 썸네일·대표색을 만듦
  const signed = await signedUrls([body.path]);
  const blob = await fetch(signed[body.path]).then((r) => {
    if (!r.ok) throw new Error(tr("저장한 이미지를 읽지 못했어요."));
    return r.blob();
  });
  const file = new File([blob], body.path.split("/").pop() ?? "image", { type: body.mime });

  try {
    return await finalizeUpload({
      id: body.id,
      userId: opts.userId,
      originalPath: body.path,
      file,
      title: body.title ?? "",
      sourceUrl: body.sourceUrl ?? url,
      target: opts.target,
    });
  } catch (e) {
    await supabase.storage.from(BUCKET).remove([body.path]);
    throw e;
  }
}

// ---------- 고치기 / 지우기 ----------

export type RefPatch = Partial<Pick<Ref, "title" | "memo" | "source_url" | "category_id" | "is_favorite">>;

export async function updateRef(id: string, patch: RefPatch): Promise<Ref> {
  const { data, error } = await getSupabase().from("refs").update(patch).eq("id", id).select(REF_COLUMNS).single();
  if (error) throw error;
  return data as Ref;
}

export async function updateRefs(ids: string[], patch: RefPatch): Promise<Ref[]> {
  if (!ids.length) return [];
  const { data, error } = await getSupabase().from("refs").update(patch).in("id", ids).select(REF_COLUMNS);
  if (error) throw error;
  return (data ?? []) as Ref[];
}

export async function deleteRefs(refs: Ref[]): Promise<void> {
  if (!refs.length) return;
  const supabase = getSupabase();
  for (let i = 0; i < refs.length; i += 100) {
    const batch = refs.slice(i, i + 100);
    const { error } = await supabase.from("refs").delete().in("id", batch.map((r) => r.id));
    if (error) throw error;
    const paths = batch.flatMap((r) => [r.storage_path, ...(r.thumb_path ? [r.thumb_path] : [])]);
    await supabase.storage.from(BUCKET).remove(paths);
    paths.forEach((p) => urlCache.delete(p));
  }
}

export async function deleteRef(ref: Ref): Promise<void> {
  await deleteRefs([ref]);
}

// ---------- 태그 ----------

export async function fetchAllTags(): Promise<Tag[]> {
  const { data, error } = await getSupabase().from("tags").select("id, name").order("name");
  if (error) throw error;
  return (data ?? []) as Tag[];
}

export async function fetchTagCounts(): Promise<TagWithCount[]> {
  const { data, error } = await getSupabase().rpc("tag_counts");
  if (error) throw error;
  return ((data ?? []) as { id: string; name: string; ref_count: number | string }[]).map((t) => ({
    id: t.id,
    name: t.name,
    ref_count: Number(t.ref_count),
  }));
}

export async function fetchRefTags(refId: string): Promise<Tag[]> {
  const { data, error } = await getSupabase().from("ref_tags").select("tags(id, name)").eq("ref_id", refId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { tags: Tag | Tag[] | null }[];
  return rows
    .flatMap((r) => (Array.isArray(r.tags) ? r.tags : r.tags ? [r.tags] : []))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export function normalizeTagName(raw: string) {
  return raw.replace(/^#/, "").replace(/\s+/g, " ").trim().slice(0, 30);
}

export async function findOrCreateTag(rawName: string): Promise<Tag> {
  const name = normalizeTagName(rawName);
  if (!name) throw new Error(tr("태그 이름이 비어 있어요."));
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

export async function addTagToRefs(refIds: string[], rawName: string): Promise<Tag> {
  const tag = await findOrCreateTag(rawName);
  if (refIds.length) {
    const { error } = await getSupabase()
      .from("ref_tags")
      .upsert(
        refIds.map((ref_id) => ({ ref_id, tag_id: tag.id })),
        { onConflict: "ref_id,tag_id", ignoreDuplicates: true }
      );
    if (error) throw error;
  }
  return tag;
}

export async function addTagToRef(refId: string, rawName: string): Promise<Tag> {
  return addTagToRefs([refId], rawName);
}

export async function removeTagFromRef(refId: string, tagId: string): Promise<void> {
  const { error } = await getSupabase().from("ref_tags").delete().eq("ref_id", refId).eq("tag_id", tagId);
  if (error) throw error;
}

// ---------- 컬렉션 연결 ----------

export async function addRefsToCollection(collectionId: string, refIds: string[]): Promise<void> {
  if (!refIds.length) return;
  const { error } = await getSupabase()
    .from("collection_refs")
    .upsert(
      refIds.map((ref_id) => ({ collection_id: collectionId, ref_id })),
      { onConflict: "collection_id,ref_id", ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function removeRefsFromCollection(collectionId: string, refIds: string[]): Promise<void> {
  if (!refIds.length) return;
  const { error } = await getSupabase()
    .from("collection_refs")
    .delete()
    .eq("collection_id", collectionId)
    .in("ref_id", refIds);
  if (error) throw error;
}

export async function fetchRefCollectionIds(refId: string): Promise<string[]> {
  const { data, error } = await getSupabase().from("collection_refs").select("collection_id").eq("ref_id", refId);
  if (error) throw error;
  return ((data ?? []) as { collection_id: string }[]).map((r) => r.collection_id);
}
