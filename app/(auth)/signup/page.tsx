"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import {
  authErrorMessage,
  normalizeUsername,
  usernameToEmail,
  validatePassword,
  validateUsername,
} from "@/lib/auth";
import { Button, Field, FormAlert } from "@/components/ui";

type Errors = {
  displayName?: string | null;
  username?: string | null;
  password?: string | null;
  confirm?: string | null;
};

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): Errors {
    const name = displayName.trim();
    return {
      displayName: !name ? "표시 이름을 입력해 주세요." : name.length > 40 ? "40자 이하로 입력해 주세요." : null,
      username: validateUsername(username),
      password: validatePassword(password),
      confirm: confirm !== password ? "비밀번호가 서로 달라요." : null,
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const next = validate();
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSubmitting(true);
    const { data, error } = await getSupabase().auth.signUp({
      email: usernameToEmail(username),
      password,
      options: {
        data: {
          username: normalizeUsername(username),
          display_name: displayName.trim(),
        },
      },
    });
    setSubmitting(false);

    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    if (!data.session) {
      // 'Confirm email'이 켜져 있으면 세션 없이 돌아옴
      setFormError("가입은 됐지만 로그인이 안 됐어요. Supabase의 'Confirm email'이 꺼져 있는지 확인해 주세요.");
      return;
    }
    router.replace("/");
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">계정 만들기</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">이메일 없이 Username으로 가입해요.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
        <Field
          label="표시 이름"
          name="displayName"
          autoComplete="nickname"
          placeholder="하나"
          hint="화면에 보이는 이름이에요. 나중에 바꿀 수 있어요."
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={errors.displayName}
        />
        <Field
          label="Username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="hana_design"
          hint="로그인할 때 쓰는 아이디예요. 영문 소문자·숫자·_ 3~20자"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          error={errors.username}
        />
        <Field
          label="비밀번호"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="6자 이상"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Field
          label="비밀번호 확인"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
        />

        <FormAlert message={formError} />

        <Button type="submit" loading={submitting} className="mt-1 w-full">
          가입하고 시작하기
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-[var(--muted)]">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-medium text-[var(--ink)] underline underline-offset-4">
          로그인
        </Link>
      </p>
    </div>
  );
}
