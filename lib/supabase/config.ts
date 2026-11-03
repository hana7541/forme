// Supabase 창고(forme-archive) 주소와 공개용 키
// 공개용(publishable) 키는 브라우저에 보여도 괜찮은 키예요.
// 실제 데이터 보호는 데이터베이스의 RLS 잠금이 담당합니다.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://iyhboywxwnhozfoddous.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_D5zZgKeVtdydgt-sQX1jZQ_b3wVvh6D";
