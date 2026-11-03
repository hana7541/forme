"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export type CategoryWithCount = { id: string; name: string; sort_order: number; count: number };

export type LibraryCounts = {
  total: number;
  favorites: number;
  categories: CategoryWithCount[];
};

type CategoryRow = { id: string; name: string; sort_order: number; refs: { count: number }[] | null };

// 사이드바에 보여 줄 숫자들(전체, 즐겨찾기, 카테고리별 개수)
export function useLibraryCounts() {
  const [data, setData] = useState<LibraryCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [total, favorites, cats] = await Promise.all([
      supabase.from("refs").select("id", { count: "exact", head: true }),
      supabase.from("refs").select("id", { count: "exact", head: true }).eq("is_favorite", true),
      supabase.from("categories").select("id, name, sort_order, refs(count)").order("sort_order"),
    ]);

    const firstError = total.error ?? favorites.error ?? cats.error;
    if (firstError) {
      setError(firstError.message);
      return;
    }

    const rows = (cats.data ?? []) as unknown as CategoryRow[];
    setData({
      total: total.count ?? 0,
      favorites: favorites.count ?? 0,
      categories: rows.map((c) => ({
        id: c.id,
        name: c.name,
        sort_order: c.sort_order,
        count: c.refs?.[0]?.count ?? 0,
      })),
    });
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, reload: load };
}
