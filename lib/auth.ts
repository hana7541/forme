// Username 로그인 규칙
// Supabase Auth는 이메일로 인증하므로, username을 내부용 가짜 이메일로 바꿔 씁니다.
// 사용자에게는 이 이메일이 보이지 않아요.

import { tr } from "@/lib/i18n";

export const USERNAME_RULE = /^[a-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 6;

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

export function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@forme.local`;
}

export function validateUsername(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (!u) return tr("Username을 입력해 주세요.");
  if (!USERNAME_RULE.test(u)) return tr("영문 소문자, 숫자, _ 만 써서 3~20자로 입력해 주세요.");
  return null;
}

export function validatePassword(pw: string): string | null {
  if (!pw) return tr("비밀번호를 입력해 주세요.");
  if (pw.length < PASSWORD_MIN) return tr("비밀번호는 {n}자 이상이어야 해요.", { n: PASSWORD_MIN });
  return null;
}

type AuthErrorLike = { message?: string; code?: string; status?: number } | null | undefined;

// Supabase 에러를 사람이 읽기 쉬운 한국어로
export function authErrorMessage(err: AuthErrorLike): string {
  if (!err) return tr("알 수 없는 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || msg.includes("invalid login credentials"))
    return tr("Username 또는 비밀번호가 맞지 않아요.");
  if (code === "user_already_exists" || msg.includes("already registered"))
    return tr("이미 사용 중인 Username이에요. 다른 이름을 골라 주세요.");
  if (code === "weak_password" || msg.includes("password should"))
    return tr("비밀번호가 너무 약해요. 더 길게 만들어 주세요.");
  if (code === "email_not_confirmed")
    return tr("Supabase의 'Confirm email' 설정이 아직 켜져 있어요. 꺼 주세요.");
  if (code === "email_address_invalid" || msg.includes("email address") || msg.includes("invalid format"))
    return tr("가입 방식이 Supabase에서 막혔어요. 이 화면을 캡처해서 Claude에게 보내 주세요.");
  if (code === "signup_disabled" || msg.includes("signups not allowed"))
    return tr("Supabase에서 새 가입이 꺼져 있어요. 'Allow new users to sign up'을 켜 주세요.");
  if (code.startsWith("over_") || err.status === 429)
    return tr("시도가 너무 많았어요. 1분 정도 기다렸다가 다시 해 주세요.");
  if (msg.includes("fetch") || msg.includes("network"))
    return tr("인터넷 연결을 확인해 주세요.");

  return tr("문제가 생겼어요: {msg}", { msg: err.message ?? code });
}
