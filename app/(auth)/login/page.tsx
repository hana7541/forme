"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { authErrorMessage, usernameToEmail, validateUsername } from "@/lib/auth";
import { Button, Field, FormAlert } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ username?: string | null; password?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const next = {
      username: validateUsername(username),
      password: password ? null : "비밀번호를 입력해 주세요.",
    };
    setErrors(next);
    if (next.username || next.password) return;

    setSubmitting(true);
    const { error } = await getSupabase().auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    setSubmitting(false);

    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    router.replace("/");
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">로그인</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">내 레퍼런스 라이브러리로 들어가요.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
        <Field
          label="Username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="hana_design"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={errors.username}
        />
        <Field
          label="비밀번호"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        <FormAlert message={formError} />

        <Button type="submit" loading={submitting} className="mt-1 w-full">
          로그인
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-[var(--muted)]">
        처음이신가요?{" "}
        <Link href="/signup" className="font-medium text-[var(--ink)] underline underline-offset-4">
          계정 만들기
        </Link>
      </p>
    </div>
  );
}
