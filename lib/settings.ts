// 설정 화면에서 쓰는 도구: 프로필, 비밀번호, 카테고리, 태그 관리
import { getSupabase } from "@/lib/supabase/client";
import { PASSWORD_MIN } from "@/lib/auth";

export type Category = { id: string; name: string; sort_order: number };

function isDuplicate(e: unknown) {
  return typeof e === "object" && !!e && "code" in e && (e as { code: string }).code === "23505";
}

export async function updateDisplayName(userId: string, name: string) {
  const v = name.trim();
  if (!v) throw new Error("표시 이름을 입력해 주세요.");
  if (v.length > 40) throw new Error("40자 이하로 입력해 주세요.");
  const { error } = await getSupabase().from("profiles").update({ display_name: v }).eq("id", userId);
  if (error) throw new Error("저장하지 못했어요.");
}

export async function changePassword(password: string) {
  if (password.length < PASSWORD_MIN) throw new Error(`비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.`);
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") throw new Error("지금 쓰는 비밀번호와 같아요.");
    if (error.code === "weak_password") throw new Error("비밀번호가 너무 약해요.");
    if (error.code === "reauthentication_needed") throw new Error("보안을 위해 다시 로그인한 뒤 바꿔 주세요.");
    throw new Error("비밀번호를 바꾸지 못했어요.");
  }
}

// ---------- 카테고리 ----------

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await getSupabase().from("categories").select("id, name, sort_order").order("sort_order");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function createCategory(name: string, sortOrder: number): Promise<Category> {
  const v = name.trim().slice(0, 30);
  if (!v) throw new Error("이름을 입력해 주세요.");
  const { data, error } = await getSupabase().from("categories").insert({ name: v, sort_order: sortOrder }).select("id, name, sort_order").single();
  if (error) throw new Error(isDuplicate(error) ? "같은 이름의 카테고리가 이미 있어요." : "만들지 못했어요.");
  return data as Category;
}

export async function renameCategory(id: string, name: string) {
  const v = name.trim().slice(0, 30);
  if (!v) throw new Error("이름을 입력해 주세요.");
  const { error } = await getSupabase().from("categories").update({ name: v }).eq("id", id);
  if (error) throw new Error(isDuplicate(error) ? "같은 이름의 카테고리가 이미 있어요." : "이름을 바꾸지 못했어요.");
}

// 지워도 레퍼런스는 남고, '카테고리 없음'이 됨
export async function deleteCategory(id: string) {
  const { error } = await getSupabase().from("categories").delete().eq("id", id);
  if (error) throw new Error("지우지 못했어요.");
}

export async function saveCategoryOrder(list: Category[]) {
  const supabase = getSupabase();
  await Promise.all(list.map((c, i) => supabase.from("categories").update({ sort_order: i + 1 }).eq("id", c.id)));
}

// ---------- 태그 ----------

export async function renameTag(id: string, name: string) {
  const v = name.replace(/^#/, "").replace(/\s+/g, " ").trim().slice(0, 30);
  if (!v) throw new Error("이름을 입력해 주세요.");
  const { error } = await getSupabase().from("tags").update({ name: v }).eq("id", id);
  if (error) throw new Error(isDuplicate(error) ? "같은 이름의 태그가 이미 있어요." : "이름을 바꾸지 못했어요.");
}

export async function deleteTags(ids: string[]) {
  if (!ids.length) return;
  const { error } = await getSupabase().from("tags").delete().in("id", ids);
  if (error) throw new Error("태그를 지우지 못했어요.");
}
