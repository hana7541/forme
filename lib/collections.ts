// 컬렉션: 프로젝트별로 레퍼런스를 묶어 두는 폴더
import { getSupabase } from "@/lib/supabase/client";

export type Collection = {
  id: string;
  name: string;
  description: string;
  cover_ref_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CollectionPreview = Collection & {
  ref_count: number;
  preview_paths: string[];
  preview_colors: string[];
};

const COLUMNS = "id, name, description, cover_ref_id, created_at, updated_at";

export async function fetchCollections(): Promise<CollectionPreview[]> {
  const { data, error } = await getSupabase().rpc("collection_previews");
  if (error) throw error;
  return ((data ?? []) as (Omit<CollectionPreview, "ref_count"> & { ref_count: number | string })[]).map((c) => ({
    ...c,
    ref_count: Number(c.ref_count),
    preview_paths: c.preview_paths ?? [],
    preview_colors: c.preview_colors ?? [],
  }));
}

export async function fetchCollection(id: string): Promise<Collection | null> {
  const { data, error } = await getSupabase().from("collections").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Collection | null) ?? null;
}

export async function createCollection(name: string, description = ""): Promise<Collection> {
  const { data, error } = await getSupabase()
    .from("collections")
    .insert({ name: name.trim().slice(0, 60), description: description.trim().slice(0, 500) })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as Collection;
}

export async function updateCollection(
  id: string,
  patch: Partial<Pick<Collection, "name" | "description" | "cover_ref_id">>
): Promise<Collection> {
  const clean = { ...patch };
  if (clean.name !== undefined) clean.name = clean.name.trim().slice(0, 60);
  if (clean.description !== undefined) clean.description = clean.description.trim().slice(0, 500);
  const { data, error } = await getSupabase().from("collections").update(clean).eq("id", id).select(COLUMNS).single();
  if (error) throw error;
  return data as Collection;
}

// 컬렉션만 지움 (안에 있던 레퍼런스 이미지는 라이브러리에 그대로 남음)
export async function deleteCollection(id: string): Promise<void> {
  const { error } = await getSupabase().from("collections").delete().eq("id", id);
  if (error) throw error;
}
