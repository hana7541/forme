"use client";

import type { InputHTMLAttributes, ButtonHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string | null;
};

export function Field({ label, hint, error, id, className = "", ...props }: FieldProps) {
  const fieldId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={!!error}
        className={`h-11 rounded-lg border bg-[var(--field)] px-3.5 text-[15px] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--ink)] ${
          error ? "border-red-500" : "border-[var(--line)]"
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const look =
    variant === "primary"
      ? "bg-[var(--ink)] text-[var(--bg)] hover:opacity-90"
      : "border border-[var(--line)] hover:bg-[var(--field)]";
  return (
    <button className={`${base} ${look} ${className}`} disabled={disabled || loading} {...props}>
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400"
    >
      {message}
    </div>
  );
}
