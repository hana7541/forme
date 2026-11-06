// ZIP 백업 · 복원
// 백업 ZIP 구조
//   manifest.json   카테고리, 태그, 레퍼런스 정보, 컬렉션, 무드보드
//   images/<id>.<확장자>   원본 이미지
import JSZip from "jszip";
import { getSupabase } from "@/lib/supabase/client";
import { fetchAllRefs, signedUrls, uploadRef, type Ref } from "@/lib/refs";
import { tr } from "@/lib/i18n";

export const BACKUP_VERSION = 1;

type Row = Record<string, unknown>;

export type BackupManifest = {
  app: "FORME";
  version: number;
  exported_at: string;
  profile: { username: string; display_name: string } | null;
  categories: { id: string; name: string; color: string | null; sort_order: number }[];
  tags: { id: string; name: string }[];
  refs: {
    id: string;
    file: string | null;
    category_id: string | null;
    title: string;
    memo: string;
    source_url: string | null;
    width: number | null;
    height: number | null;
    file_size: number | null;
    mime_type: string | null;
    is_favorite: boolean;
    created_at: string;
  }[];
  ref_tags: { ref_id: string; tag_id: string }[];
  collections: { id: string; name: string; description: string; cover_ref_id: string | null; created_at: string }[];
  collection_refs: { collection_id: string; ref_id: string; sort_order: number; added_at: string }[];
  moodboards: { id: string; name: string; background: string; collection_id: string | null }[];
  moodboard_items: {
    moodboard_id: string;
    // 예전 백업에는 kind가 없음 → 이미지로 봄
    kind?: "image" | "text";
    ref_id: string | null;
    content?: string | null;
    font_size?: number | null;
    font_weight?: number | null;
    color?: string | null;
    align?: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    z_index: number;
  }[];
};

export type Progress = { stage: string; done: number; total: number };

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};
const MIME: Record<string, string> = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));

// Supabase는 한 번에 1000줄까지만 주므로 나눠서 모두 받기
async function fetchAllRows(table: string, columns: string, order: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await getSupabase().from(table).select(columns).order(order).range(from, from + 999);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Row[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function runPool<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

// ---------- 백업 ----------

// 범위를 고르면 그 레퍼런스만 담음
// - categoryIds: 고른 카테고리의 레퍼런스 (null = '카테고리 없음')
// - collectionIds: 고른 컬렉션에 들어 있는 레퍼런스
export type BackupScope = { categoryIds?: (string | null)[]; collectionIds?: string[] };

export async function exportBackup(
  onProgress: (p: Progress) => void,
  scope: BackupScope = {}
): Promise<{ blob: Blob; missing: number; count: number }> {
  const supabase = getSupabase();
  onProgress({ stage: "정보 모으는 중", done: 0, total: 1 });

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  const profileRes = uid
    ? await supabase.from("profiles").select("username, display_name").eq("id", uid).maybeSingle()
    : { data: null };

  const [allRefs, allCategories, allTags, allRefTags, allCollections, allCollectionRefs, allMoodboards, allItems] = await Promise.all([
    fetchAllRefs(),
    fetchAllRows("categories", "id, name, color, sort_order", "sort_order"),
    fetchAllRows("tags", "id, name", "name"),
    fetchAllRows("ref_tags", "ref_id, tag_id", "ref_id"),
    fetchAllRows("collections", "id, name, description, cover_ref_id, created_at", "created_at"),
    fetchAllRows("collection_refs", "collection_id, ref_id, sort_order, added_at", "added_at"),
    fetchAllRows("moodboards", "id, name, background, collection_id", "created_at"),
    fetchAllRows("moodboard_items", "moodboard_id, kind, ref_id, content, font_size, font_weight, color, align, x, y, width, height, rotation, z_index", "created_at"),
  ]);

  // 범위를 골랐으면, 그 레퍼런스와 연결된 것만 남김
  let refs = allRefs;
  let categories = allCategories;
  let tags = allTags;
  let refTags = allRefTags;
  let collections = allCollections;
  let collectionRefs = allCollectionRefs;
  let moodboards = allMoodboards;
  let items = allItems;
  if (scope.categoryIds || scope.collectionIds) {
    const byCollection = !!scope.collectionIds;
    const pickedCols = new Set(scope.collectionIds ?? []);
    const pickedCats = new Set(scope.categoryIds ?? []);

    if (byCollection) {
      const inPicked = new Set(
        allCollectionRefs.filter((cr) => pickedCols.has(cr.collection_id as string)).map((cr) => cr.ref_id as string)
      );
      refs = allRefs.filter((r) => inPicked.has(r.id));
    } else {
      refs = allRefs.filter((r) => pickedCats.has(r.category_id));
    }
    const refIds = new Set(refs.map((r) => r.id));

    // 카테고리: 카테고리로 골랐으면 고른 것, 컬렉션으로 골랐으면 담긴 이미지가 쓰는 것
    const usedCats = new Set(refs.map((r) => r.category_id).filter(Boolean) as string[]);
    categories = allCategories.filter((c) => (byCollection ? usedCats : pickedCats).has(c.id as string));

    refTags = allRefTags.filter((rt) => refIds.has(rt.ref_id as string));
    const tagIds = new Set(refTags.map((rt) => rt.tag_id as string));
    tags = allTags.filter((t) => tagIds.has(t.id as string));

    // 컬렉션: 컬렉션으로 골랐으면 고른 것만, 카테고리로 골랐으면 담긴 이미지가 들어 있는 것
    collectionRefs = allCollectionRefs.filter(
      (cr) => refIds.has(cr.ref_id as string) && (!byCollection || pickedCols.has(cr.collection_id as string))
    );
    const colIds = byCollection ? pickedCols : new Set(collectionRefs.map((cr) => cr.collection_id as string));
    collections = allCollections
      .filter((c) => colIds.has(c.id as string))
      .map((c) => (c.cover_ref_id && !refIds.has(c.cover_ref_id as string) ? { ...c, cover_ref_id: null } : c));

    // 고른 이미지가 들어 있는 보드만 담고, 그 보드의 텍스트도 함께
    const boardIds = new Set(
      allItems.filter((i) => i.ref_id && refIds.has(i.ref_id as string)).map((i) => i.moodboard_id as string)
    );
    items = allItems.filter((i) =>
      i.kind === "text" ? boardIds.has(i.moodboard_id as string) : refIds.has(i.ref_id as string)
    );
    moodboards = allMoodboards
      .filter((b) => boardIds.has(b.id as string))
      .map((b) => (b.collection_id && !colIds.has(b.collection_id as string) ? { ...b, collection_id: null } : b));
  }

  const zip = new JSZip();
  const images = zip.folder("images")!;
  const files = new Map<string, string>();
  let missing = 0;
  let done = 0;

  // 원본 이미지 내려받기 (4장씩 동시에)
  for (let i = 0; i < refs.length; i += 100) {
    const batch = refs.slice(i, i + 100);
    const urls = await signedUrls(batch.map((r) => r.storage_path)).catch(() => ({} as Record<string, string>));
    await runPool(batch, 4, async (r) => {
      const url = urls[r.storage_path];
      try {
        if (!url) throw new Error("no url");
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const ext = EXT[r.mime_type ?? ""] ?? r.storage_path.split(".").pop() ?? "bin";
        const name = `${r.id}.${ext}`;
        images.file(name, blob, { binary: true });
        files.set(r.id, `images/${name}`);
      } catch {
        missing++;
      }
      done++;
      onProgress({ stage: "원본 이미지 내려받는 중", done, total: refs.length });
    });
  }

  const manifest: BackupManifest = {
    app: "FORME",
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    profile: (profileRes.data as BackupManifest["profile"]) ?? null,
    categories: categories as BackupManifest["categories"],
    tags: tags as BackupManifest["tags"],
    refs: refs.map((r) => ({
      id: r.id,
      file: files.get(r.id) ?? null,
      category_id: r.category_id,
      title: r.title,
      memo: r.memo,
      source_url: r.source_url,
      width: r.width,
      height: r.height,
      file_size: r.file_size,
      mime_type: r.mime_type,
      is_favorite: r.is_favorite,
      created_at: r.created_at,
    })),
    ref_tags: refTags as BackupManifest["ref_tags"],
    collections: collections as BackupManifest["collections"],
    collection_refs: collectionRefs as BackupManifest["collection_refs"],
    moodboards: moodboards as BackupManifest["moodboards"],
    moodboard_items: items as BackupManifest["moodboard_items"],
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file(
    "README.txt",
    [
      tr("FORME 백업 파일"),
      tr("만든 날: {date}", { date: manifest.exported_at }),
      tr("레퍼런스 {r}개, 컬렉션 {c}개, 무드보드 {m}개", { r: refs.length, c: collections.length, m: moodboards.length }),
      "",
      tr("images/ 폴더에 원본 이미지가, manifest.json에 제목·메모·태그·컬렉션·무드보드 정보가 들어 있어요."),
      tr("FORME 설정 > 백업과 복원 에서 이 ZIP을 그대로 올리면 복원돼요."),
    ].join("\n")
  );

  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" }, (meta) =>
    onProgress({ stage: "ZIP 파일 만드는 중", done: Math.round(meta.percent), total: 100 })
  );
  return { blob, missing, count: refs.length };
}

// ---------- 복원 ----------

export type RestorePreview = {
  manifest: BackupManifest;
  zip: JSZip;
};

export async function readBackup(file: File): Promise<RestorePreview> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error(tr("ZIP 파일을 열 수 없어요."));
  }
  const entry = zip.file("manifest.json");
  if (!entry) throw new Error(tr("FORME 백업 파일이 아니에요 (manifest.json이 없어요)."));
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(await entry.async("string")) as BackupManifest;
  } catch {
    throw new Error(tr("백업 정보가 손상됐어요."));
  }
  if (manifest.app !== "FORME" || typeof manifest.version !== "number") throw new Error(tr("FORME 백업 파일이 아니에요."));
  if (manifest.version > BACKUP_VERSION) throw new Error(tr("더 새로운 버전의 FORME에서 만든 백업이에요."));
  return { manifest, zip };
}

export type RestoreResult = {
  added: number;
  skipped: number;
  failed: number;
  collections: number;
  moodboards: number;
};

const fingerprint = (r: { created_at: string; file_size: number | null; title: string }) =>
  `${new Date(r.created_at).getTime()}|${r.file_size ?? ""}|${r.title}`;

export async function restoreBackup(
  { manifest, zip }: RestorePreview,
  userId: string,
  onProgress: (p: Progress) => void
): Promise<RestoreResult> {
  const supabase = getSupabase();
  const result: RestoreResult = { added: 0, skipped: 0, failed: 0, collections: 0, moodboards: 0 };

  // 1) 카테고리: 같은 이름은 다시 쓰고, 없으면 만듦
  onProgress({ stage: "카테고리와 태그 맞추는 중", done: 0, total: 1 });
  const catMap = new Map<string, string>();
  {
    const { data } = await supabase.from("categories").select("id, name, sort_order");
    const existing = (data ?? []) as { id: string; name: string; sort_order: number }[];
    let maxOrder = existing.reduce((m, c) => Math.max(m, c.sort_order), 0);
    for (const c of manifest.categories ?? []) {
      const hit = existing.find((e) => e.name === c.name);
      if (hit) {
        catMap.set(c.id, hit.id);
        continue;
      }
      const { data: created } = await supabase
        .from("categories")
        .insert({ name: c.name, color: c.color, sort_order: ++maxOrder })
        .select("id")
        .single();
      if (created) catMap.set(c.id, (created as { id: string }).id);
    }
  }

  // 2) 태그
  const tagMap = new Map<string, string>();
  {
    const { data } = await supabase.from("tags").select("id, name");
    const existing = new Map(((data ?? []) as { id: string; name: string }[]).map((t) => [t.name, t.id]));
    const toCreate = (manifest.tags ?? []).filter((t) => !existing.has(t.name)).map((t) => ({ name: t.name }));
    if (toCreate.length) {
      const { data: created } = await supabase.from("tags").insert(toCreate).select("id, name");
      ((created ?? []) as { id: string; name: string }[]).forEach((t) => existing.set(t.name, t.id));
    }
    for (const t of manifest.tags ?? []) {
      const id = existing.get(t.name);
      if (id) tagMap.set(t.id, id);
    }
  }

  // 3) 레퍼런스: 이미 있는 것(같은 날짜·용량·제목)은 건너뜀
  const refMap = new Map<string, string>();
  const current: Ref[] = await fetchAllRefs();
  const byPrint = new Map(current.map((r) => [fingerprint(r), r.id]));
  const refs = manifest.refs ?? [];
  let done = 0;

  await runPool(refs, 3, async (r) => {
    try {
      const dup = byPrint.get(fingerprint(r));
      if (dup) {
        refMap.set(r.id, dup);
        result.skipped++;
        return;
      }
      const entry = r.file ? zip.file(r.file) : null;
      if (!entry) {
        result.failed++;
        return;
      }
      const ext = (r.file ?? "").split(".").pop() ?? "";
      const type = r.mime_type ?? MIME[ext] ?? "image/png";
      const blob = await entry.async("blob");
      const file = new File([blob], r.file?.split("/").pop() ?? "image", { type });
      const created = await uploadRef(file, {
        userId,
        target: { categoryId: r.category_id ? catMap.get(r.category_id) ?? null : null },
        title: r.title ?? "",
        sourceUrl: r.source_url,
        extra: { memo: r.memo ?? "", is_favorite: !!r.is_favorite, created_at: r.created_at },
      });
      refMap.set(r.id, created.id);
      result.added++;
    } catch {
      result.failed++;
    } finally {
      done++;
      onProgress({ stage: "이미지 올리는 중", done, total: refs.length });
    }
  });

  // 4) 태그 연결
  onProgress({ stage: "태그·컬렉션·무드보드 정리 중", done: 0, total: 1 });
  const pairs = (manifest.ref_tags ?? []).flatMap((rt) => {
    const ref_id = refMap.get(rt.ref_id);
    const tag_id = tagMap.get(rt.tag_id);
    return ref_id && tag_id ? [{ ref_id, tag_id }] : [];
  });
  for (let i = 0; i < pairs.length; i += 500) {
    await supabase.from("ref_tags").upsert(pairs.slice(i, i + 500), { onConflict: "ref_id,tag_id", ignoreDuplicates: true });
  }

  // 5) 컬렉션: 같은 이름이 있으면 그 컬렉션에 합침
  const colMap = new Map<string, string>();
  {
    const { data } = await supabase.from("collections").select("id, name");
    const existing = new Map(((data ?? []) as { id: string; name: string }[]).map((c) => [c.name, c.id]));
    for (const c of manifest.collections ?? []) {
      let id = existing.get(c.name);
      if (!id) {
        const { data: created } = await supabase
          .from("collections")
          .insert({ name: c.name, description: c.description ?? "" })
          .select("id")
          .single();
        id = (created as { id: string } | null)?.id;
        if (id) result.collections++;
      }
      if (id) colMap.set(c.id, id);
    }
    const links = (manifest.collection_refs ?? []).flatMap((cr) => {
      const collection_id = colMap.get(cr.collection_id);
      const ref_id = refMap.get(cr.ref_id);
      return collection_id && ref_id ? [{ collection_id, ref_id, sort_order: cr.sort_order ?? 0 }] : [];
    });
    for (let i = 0; i < links.length; i += 500) {
      await supabase.from("collection_refs").upsert(links.slice(i, i + 500), { onConflict: "collection_id,ref_id", ignoreDuplicates: true });
    }
    for (const c of manifest.collections ?? []) {
      const id = colMap.get(c.id);
      const cover = c.cover_ref_id ? refMap.get(c.cover_ref_id) : null;
      if (id && cover) await supabase.from("collections").update({ cover_ref_id: cover }).eq("id", id);
    }
  }

  // 6) 무드보드: 같은 이름의 보드가 이미 있으면 건너뜀 (두 번 복원해도 겹치지 않게)
  {
    const { data } = await supabase.from("moodboards").select("name");
    const names = new Set(((data ?? []) as { name: string }[]).map((b) => b.name));
    for (const b of manifest.moodboards ?? []) {
      if (names.has(b.name)) continue;
      const { data: created } = await supabase
        .from("moodboards")
        .insert({
          name: b.name,
          background: b.background ?? "#ffffff",
          collection_id: b.collection_id ? colMap.get(b.collection_id) ?? null : null,
        })
        .select("id")
        .single();
      const boardId = (created as { id: string } | null)?.id;
      if (!boardId) continue;
      result.moodboards++;
      const rows = (manifest.moodboard_items ?? [])
        .filter((i) => i.moodboard_id === b.id)
        .flatMap((i): Record<string, unknown>[] => {
          const base = { moodboard_id: boardId, x: i.x, y: i.y, width: i.width, height: i.height, rotation: i.rotation ?? 0, z_index: i.z_index ?? 0 };
          if (i.kind === "text") {
            if (!i.content) return [];
            return [
              {
                ...base,
                kind: "text",
                ref_id: null,
                content: i.content.slice(0, 5000),
                font_size: i.font_size ?? null,
                font_weight: i.font_weight ?? null,
                color: i.color ?? null,
                align: i.align ?? null,
              },
            ];
          }
          const ref_id = i.ref_id ? refMap.get(i.ref_id) : undefined;
          return ref_id ? [{ ...base, kind: "image", ref_id }] : [];
        });
      for (let k = 0; k < rows.length; k += 500) {
        await supabase.from("moodboard_items").insert(rows.slice(k, k + 500));
      }
    }
  }

  return result;
}
