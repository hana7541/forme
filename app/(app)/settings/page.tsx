"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useShell } from "@/components/shell/AppShell";
import { useToast } from "@/components/Toast";
import { Button, Field, FormAlert } from "@/components/ui";
import { CloseIcon, LogoutIcon } from "@/components/icons";
import { exportBackup, readBackup, restoreBackup, type Progress, type RestorePreview, type RestoreResult } from "@/lib/backup";
import {
  changePassword,
  createCategory,
  deleteCategory,
  deleteTags,
  fetchCategories,
  renameCategory,
  renameTag,
  saveCategoryOrder,
  updateDisplayName,
  type Category,
} from "@/lib/settings";

// 왼쪽에 제목, 오른쪽에 내용 (모바일은 위아래)
function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid gap-5 border-t border-hairline py-10 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 id={`${id}-title`} className="text-[17px] font-semibold tracking-[-0.02em]">
          {title}
        </h2>
        {note && <p className="mt-1.5 text-[13px] leading-relaxed text-graphite">{note}</p>}
      </div>
      <div className="min-w-0 max-w-xl">{children}</div>
    </section>
  );
}

function ProgressBar({ p }: { p: Progress }) {
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return (
    <div className="mt-4" role="status" aria-live="polite">
      <div className="flex justify-between text-[13px]">
        <span>{p.stage}</span>
        <span className="tabular-nums text-graphite">{p.total > 1 ? `${p.done} / ${p.total}` : ""}</span>
      </div>
      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-haze">
        <div className="h-full bg-ink transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---------- 프로필 ----------
function ProfileSection() {
  const { profile, session, refreshProfile } = useAuth();
  const { show } = useToast();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setName(profile?.display_name ?? ""), [profile?.display_name]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      await updateDisplayName(session.user.id, name);
      await refreshProfile();
      show("표시 이름을 바꿨어요");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section id="profile" title="프로필" note="표시 이름은 화면에 보이는 이름이에요. 로그인 아이디(Username)는 바꿀 수 없어요.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field label="표시 이름" name="display-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">Username</p>
          <p className="flex h-11 items-center rounded-lg bg-haze px-3.5 text-[15px] text-graphite">@{profile?.username}</p>
        </div>
        <FormAlert message={error} />
        <div>
          <Button type="submit" loading={saving} disabled={name.trim() === profile?.display_name}>
            저장
          </Button>
        </div>
      </form>
    </Section>
  );
}

// ---------- 비밀번호 ----------
function PasswordSection() {
  const { show } = useToast();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== confirm) {
      setError("두 비밀번호가 서로 달라요.");
      return;
    }
    setSaving(true);
    try {
      await changePassword(pw);
      setPw("");
      setConfirm("");
      show("비밀번호를 바꿨어요");
    } catch (err) {
      setError(err instanceof Error ? err.message : "비밀번호를 바꾸지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section id="password" title="비밀번호" note="다른 기기에서도 새 비밀번호로 로그인해요.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field label="새 비밀번호" name="new-password" type="password" autoComplete="new-password" hint="6자 이상" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Field label="새 비밀번호 확인" name="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <FormAlert message={error} />
        <div>
          <Button type="submit" loading={saving} disabled={!pw}>
            비밀번호 바꾸기
          </Button>
        </div>
      </form>
    </Section>
  );
}

// ---------- 카테고리 ----------
function CategoryRow({
  c,
  index,
  count,
  onMove,
  onRenamed,
  onDelete,
}: {
  c: Category;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRenamed: (id: string, name: string) => Promise<void>;
  onDelete: (c: Category) => void;
}) {
  const [name, setName] = useState(c.name);
  useEffect(() => setName(c.name), [c.name]);

  return (
    <li className="flex items-center gap-2 py-1.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() !== c.name && void onRenamed(c.id, name).catch(() => setName(c.name))}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        maxLength={30}
        aria-label={`${c.name} 이름`}
        className="h-10 min-w-0 flex-1 rounded-lg border border-transparent px-3 text-[15px] outline-none hover:border-hairline focus:border-ink"
      />
      <button type="button" aria-label="위로" disabled={index === 0} onClick={() => onMove(index, index - 1)} className="grid h-9 w-9 place-items-center rounded-full text-graphite hover:bg-haze hover:text-ink disabled:opacity-30">
        ↑
      </button>
      <button type="button" aria-label="아래로" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} className="grid h-9 w-9 place-items-center rounded-full text-graphite hover:bg-haze hover:text-ink disabled:opacity-30">
        ↓
      </button>
      <button type="button" aria-label={`${c.name} 지우기`} onClick={() => onDelete(c)} className="grid h-9 w-9 place-items-center rounded-full text-graphite hover:bg-haze hover:text-red-600">
        <CloseIcon size={14} />
      </button>
    </li>
  );
}

function CategorySection() {
  const { reloadCounts, counts } = useShell();
  const { show } = useToast();
  const [list, setList] = useState<Category[] | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories().then(setList).catch(() => setList([]));
  }, []);

  async function rename(id: string, name: string) {
    try {
      await renameCategory(id, name);
      setList((prev) => prev?.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)) ?? prev);
      void reloadCounts();
    } catch (e) {
      show(e instanceof Error ? e.message : "이름을 바꾸지 못했어요.");
      throw e;
    }
  }

  function move(from: number, to: number) {
    if (!list) return;
    const next = [...list];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setList(next);
    void saveCategoryOrder(next).then(() => reloadCounts());
  }

  async function remove(c: Category) {
    const n = counts?.categories.find((x) => x.id === c.id)?.count ?? 0;
    if (n > 0 && !window.confirm(`‘${c.name}’에 레퍼런스 ${n}개가 있어요. 카테고리만 지우고 이미지는 남길까요?`)) return;
    try {
      await deleteCategory(c.id);
      setList((prev) => prev?.filter((x) => x.id !== c.id) ?? prev);
      void reloadCounts();
      show(`‘${c.name}’ 카테고리를 지웠어요`);
    } catch {
      show("지우지 못했어요.");
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const c = await createCategory(newName, (list?.length ?? 0) + 1);
      setList((prev) => [...(prev ?? []), c]);
      setNewName("");
      void reloadCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "만들지 못했어요.");
    }
  }

  return (
    <Section id="categories" title="카테고리" note="이미지 하나에 카테고리 하나를 붙여요. 이름을 눌러 바로 고칠 수 있어요.">
      {list === null ? (
        <p className="text-[14px] text-graphite">불러오는 중…</p>
      ) : (
        <ul className="-mx-3">
          {list.map((c, i) => (
            <CategoryRow key={c.id} c={c} index={i} count={list.length} onMove={move} onRenamed={rename} onDelete={(x) => void remove(x)} />
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={30}
          placeholder="새 카테고리 이름"
          aria-label="새 카테고리 이름"
          className="h-11 min-w-0 flex-1 rounded-lg border border-hairline px-3.5 text-[15px] outline-none placeholder:text-graphite focus:border-ink"
        />
        <Button type="submit" variant="ghost" disabled={!newName.trim()}>
          추가
        </Button>
      </form>
      {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
    </Section>
  );
}

// ---------- 태그 ----------
function TagSection() {
  const { counts, reloadCounts } = useShell();
  const { show } = useToast();
  const tags = counts?.tags ?? [];
  const unused = tags.filter((t) => t.ref_count === 0);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");

  async function save(id: string) {
    try {
      await renameTag(id, text);
      setEditing(null);
      void reloadCounts();
    } catch (e) {
      show(e instanceof Error ? e.message : "이름을 바꾸지 못했어요.");
    }
  }

  async function remove(ids: string[], label: string) {
    try {
      await deleteTags(ids);
      void reloadCounts();
      show(label);
    } catch {
      show("태그를 지우지 못했어요.");
    }
  }

  return (
    <Section id="tags" title="태그" note="태그를 지워도 이미지는 그대로 남아요. 태그를 누르면 이름을 고칠 수 있어요.">
      {tags.length === 0 ? (
        <p className="text-[14px] leading-relaxed text-graphite">아직 태그가 없어요. 이미지를 열어 태그를 붙여 보세요.</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-2">
            {tags.map((t) =>
              editing === t.id ? (
                <li key={t.id}>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(t.id);
                    }}
                    className="flex items-center gap-1"
                  >
                    <input
                      autoFocus
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onBlur={() => setEditing(null)}
                      onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                      maxLength={30}
                      aria-label="태그 이름"
                      className="h-8 w-36 rounded-full border border-ink px-3 text-[13px] outline-none"
                    />
                  </form>
                </li>
              ) : (
                <li key={t.id} className="inline-flex h-8 items-center rounded-full border border-hairline pl-3 pr-1 text-[13px]">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(t.id);
                      setText(t.name);
                    }}
                    className="hover:underline hover:underline-offset-4"
                  >
                    {t.name}
                  </button>
                  <span className="ml-1.5 tabular-nums text-graphite">{t.ref_count}</span>
                  <button
                    type="button"
                    aria-label={`${t.name} 태그 지우기`}
                    onClick={() => void remove([t.id], `‘${t.name}’ 태그를 지웠어요`)}
                    className="ml-1 grid h-6 w-6 place-items-center rounded-full text-graphite hover:bg-haze hover:text-red-600"
                  >
                    <CloseIcon size={12} />
                  </button>
                </li>
              )
            )}
          </ul>
          {unused.length > 0 && (
            <button
              type="button"
              onClick={() => void remove(unused.map((t) => t.id), `안 쓰는 태그 ${unused.length}개를 지웠어요`)}
              className="mt-5 text-[13px] text-graphite underline underline-offset-4 hover:text-ink"
            >
              아무 이미지에도 안 붙은 태그 {unused.length}개 지우기
            </button>
          )}
        </>
      )}
    </Section>
  );
}

// ---------- 백업과 복원 ----------
const NO_CATEGORY = "__none__";

function BackupSection() {
  const { session } = useAuth();
  const { reloadCounts, counts } = useShell();
  const [scope, setScope] = useState<"all" | "category" | "collection">("all");
  const [pickedCats, setPickedCats] = useState<Set<string>>(new Set());
  const [pickedCols, setPickedCols] = useState<Set<string>>(new Set());
  const picked = scope === "collection" ? pickedCols : pickedCats;
  const setPicked = scope === "collection" ? setPickedCols : setPickedCats;
  const unit = scope === "collection" ? "컬렉션" : "카테고리";

  // 지금 고를 수 있는 목록 (카테고리 또는 컬렉션)
  const options =
    scope === "collection"
      ? (counts?.collections ?? []).map((c) => ({ id: c.id, name: c.name, count: c.ref_count }))
      : [
          ...(counts?.categories ?? []).map((c) => ({ id: c.id, name: c.name, count: c.count })),
          {
            id: NO_CATEGORY,
            name: "카테고리 없음",
            count: Math.max(0, (counts?.total ?? 0) - (counts?.categories ?? []).reduce((n, c) => n + c.count, 0)),
          },
        ];
  const { show } = useToast();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState<"export" | "restore" | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 작업 중에 창을 닫으려 하면 경고
  useEffect(() => {
    if (!busy) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [busy]);

  async function doExport() {
    setBusy("export");
    setError(null);
    setResult(null);
    try {
      const categoryIds = scope === "category" ? [...pickedCats].map((id) => (id === NO_CATEGORY ? null : id)) : undefined;
      const collectionIds = scope === "collection" ? [...pickedCols] : undefined;
      const { blob, missing, count } = await exportBackup(setProgress, { categoryIds, collectionIds });
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      // 파일 이름에 고른 카테고리·컬렉션 이름을 넣음 (예: forme-브랜딩-20261104.zip)
      const names =
        scope === "all"
          ? []
          : [...picked]
              .map((id) => (id === NO_CATEGORY ? "카테고리없음" : options.find((o) => o.id === id)?.name ?? ""))
              .filter(Boolean)
              .map((n) => n.replace(/[\\/:*?"<>|\s]+/g, ""));
      const label = names.length > 3 ? `${names.slice(0, 3).join("-")}-외${names.length - 3}` : names.join("-");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = label ? `forme-${label}-${stamp}.zip` : `forme-backup-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      show(missing ? `${count - missing}개를 백업했어요 (${missing}개는 원본을 못 받았어요)` : `레퍼런스 ${count}개를 백업했어요`);
    } catch {
      setError("백업 파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      setPreview(await readBackup(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "백업 파일을 읽지 못했어요.");
    }
  }

  async function doRestore() {
    if (!preview || !session) return;
    setBusy("restore");
    setError(null);
    try {
      const r = await restoreBackup(preview, session.user.id, setProgress);
      setResult(r);
      setPreview(null);
      void reloadCounts();
    } catch {
      setError("복원하다 멈췄어요. 같은 파일로 다시 복원하면 이미 들어간 건 건너뛰고 이어서 해요.");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  const m = preview?.manifest;

  return (
    <Section
      id="backup"
      title="백업과 복원"
      note="원본 이미지와 제목·메모·태그·컬렉션·무드보드를 ZIP 파일 하나로 내려받아요. 같은 파일로 다시 복원할 수 있어요."
    >
      <div className="flex flex-col gap-8">
        <div>
          <p className="text-[15px] font-medium">ZIP으로 백업</p>
          <p className="mt-1 text-[13px] leading-relaxed text-graphite">
            이미지가 많으면 몇 분 걸릴 수 있어요. 끝날 때까지 이 화면을 닫지 마세요.
          </p>

          <div role="radiogroup" aria-label="백업 범위" className="mt-4 inline-flex rounded-full bg-haze p-1">
            {(
              [
                ["all", "전체"],
                ["category", "카테고리별"],
                ["collection", "컬렉션별"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={scope === v}
                onClick={() => setScope(v)}
                disabled={!!busy}
                className={`h-9 rounded-full px-4 text-[13px] transition-colors ${scope === v ? "bg-paper font-medium text-ink shadow-[0_0_0_1px_var(--color-hairline)]" : "text-graphite hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {scope === "all" ? (
            <p className="mt-3 text-[13px] text-graphite tabular-nums">
              레퍼런스 {counts?.total ?? 0}개와 컬렉션·무드보드를 모두 담아요.
            </p>
          ) : (
            <div className="mt-4">
              <div className="flex flex-wrap gap-1.5">
                {options.map((c) => {
                  const on = picked.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      disabled={!!busy}
                      onClick={() =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        })
                      }
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors ${
                        on ? "border-ink bg-ink text-paper" : "border-hairline hover:border-ink"
                      }`}
                    >
                      {c.name}
                      <span className={`tabular-nums ${on ? "text-paper/70" : "text-graphite"}`}>{c.count}</span>
                    </button>
                  );
                })}
              </div>
              {scope === "collection" && options.length === 0 && (
                <p className="text-[13px] text-graphite">아직 컬렉션이 없어요.</p>
              )}
              <p className="mt-3 text-[13px] leading-relaxed text-graphite">
                {scope === "collection"
                  ? "고른 컬렉션과 그 안의 이미지, 그 이미지가 놓인 무드보드만 담아요."
                  : "고른 카테고리의 이미지와, 그 이미지가 들어 있는 컬렉션·무드보드만 담아요."}
              </p>
            </div>
          )}

          <div className="mt-5">
            <Button
              type="button"
              onClick={() => void doExport()}
              loading={busy === "export"}
              disabled={!!busy || (scope !== "all" && picked.size === 0)}
            >
              {scope === "all"
                ? "전체 백업 내려받기"
                : picked.size
                  ? `고른 ${unit} ${picked.size}개 내려받기`
                  : `${unit}${scope === "collection" ? "을" : "를"} 골라 주세요`}
            </Button>
          </div>
          {busy === "export" && progress && <ProgressBar p={progress} />}
        </div>

        <div>
          <p className="text-[15px] font-medium">백업에서 복원</p>
          <p className="mt-1 text-[13px] leading-relaxed text-graphite">
            지금 라이브러리에 더해져요. 이미 있는 이미지(같은 날짜·용량·제목)는 건너뛰어서, 두 번 복원해도 겹치지 않아요.
          </p>
          <input ref={fileRef} type="file" accept=".zip,application/zip" hidden onChange={(e) => void pickFile(e.target.files?.[0]).finally(() => (e.target.value = ""))} />

          {!preview && (
            <div className="mt-4">
              <Button type="button" variant="ghost" onClick={() => fileRef.current?.click()} disabled={!!busy}>
                백업 파일 고르기
              </Button>
            </div>
          )}

          {m && (
            <div className="mt-4 rounded-xl border border-hairline p-5">
              <p className="text-[14px] font-medium">이 백업을 복원할까요?</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[13px]">
                <dt className="text-graphite">만든 날</dt>
                <dd className="tabular-nums">{new Date(m.exported_at).toLocaleString("ko-KR")}</dd>
                <dt className="text-graphite">레퍼런스</dt>
                <dd className="tabular-nums">{m.refs.length}개</dd>
                <dt className="text-graphite">컬렉션</dt>
                <dd className="tabular-nums">{m.collections.length}개</dd>
                <dt className="text-graphite">무드보드</dt>
                <dd className="tabular-nums">{m.moodboards.length}개</dd>
                <dt className="text-graphite">태그</dt>
                <dd className="tabular-nums">{m.tags.length}개</dd>
              </dl>
              <div className="mt-5 flex gap-2">
                <Button type="button" onClick={() => void doRestore()} loading={busy === "restore"} disabled={!!busy}>
                  복원하기
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPreview(null)} disabled={!!busy}>
                  취소
                </Button>
              </div>
              {busy === "restore" && progress && <ProgressBar p={progress} />}
            </div>
          )}

          {result && (
            <div className="mt-4 rounded-xl bg-haze p-5 text-[14px] leading-relaxed">
              <p className="font-medium">복원을 마쳤어요</p>
              <p className="mt-1 text-graphite">
                새로 넣은 이미지 {result.added}개, 이미 있어서 건너뛴 이미지 {result.skipped}개
                {result.failed ? `, 넣지 못한 이미지 ${result.failed}개` : ""}. 컬렉션 {result.collections}개와 무드보드 {result.moodboards}개를 새로 만들었어요.
              </p>
            </div>
          )}
        </div>
        <FormAlert message={error} />
      </div>
    </Section>
  );
}

function AccountSection() {
  const { signOut } = useAuth();
  return (
    <Section id="account" title="계정">
      <Button type="button" variant="ghost" onClick={() => void signOut()}>
        <LogoutIcon size={16} />
        로그아웃
      </Button>
    </Section>
  );
}

export default function SettingsPage() {
  return (
    <div>
      <header className="mb-10 md:mb-14">
        <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[52px] lg:text-[68px]">설정</h1>
      </header>
      <ProfileSection />
      <PasswordSection />
      <CategorySection />
      <TagSection />
      <BackupSection />
      <AccountSection />
    </div>
  );
}
