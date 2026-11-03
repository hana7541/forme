import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config";

// 브라우저에서 한 번만 만들어 계속 재사용하는 Supabase 연결
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true, // 새로고침해도 로그인 유지
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
