"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CloseIcon } from "@/components/icons";
import { emitRefCreated } from "@/lib/events";
import { ACCEPTED_TYPES, validateImageFile } from "@/lib/image";
import { saveFromUrl, uploadRef, type UploadTarget } from "@/lib/refs";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { tr, useT } from "@/lib/i18n";

type Status = "waiting" | "uploading" | "done" | "error";
type Job = {
  key: string;
  file?: File;
  url?: string;
  name: string;
  preview: string;
  status: Status;
  error?: string;
  pasted: boolean;
  target: UploadTarget;
};

type UploadCtx = {
  openPicker: () => void;
  uploadFiles: (files: File[], opts?: { pasted?: boolean }) => void;
  saveUrls: (urls: string[]) => void;
};

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export function looksLikeUrl(text: string) {
  const t = text.trim();
  if (!t || /\s/.test(t) || t.length > 2000) return false;
  if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(t)) return false;
  // 이미 FORME에 저장된 이미지의 주소면 다시 저장하지 않음
  try {
    const host = new URL(t).host;
    if (host === new URL(SUPABASE_URL).host) return false;
    if (typeof window !== "undefined" && host === window.location.host) return false;
  } catch {
    return false;
  }
  return true;
}

const Ctx = createContext<UploadCtx | null>(null);

export function useUpload() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUpload must be used inside <UploadManager>");
  return ctx;
}

const CONCURRENCY = 3;

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
  if (/exceeded|too large|payload/i.test(msg)) return tr("파일이 너무 커요 (최대 20MB).");
  if (/mime|type/i.test(msg)) return tr("지원하지 않는 형식이에요.");
  if (/network|fetch/i.test(msg)) return tr("인터넷 연결을 확인해 주세요.");
  if (/decode|image/i.test(msg)) return tr("이미지를 읽을 수 없어요.");
  return msg ? tr("올리지 못했어요: {msg}", { msg: tr(msg) }) : tr("올리지 못했어요.");
}

export function UploadManager({
  children,
  target,
  onUploaded,
}: {
  children: React.ReactNode;
  target: UploadTarget;
  onUploaded: () => void;
}) {
  const { session } = useAuth();
  const { t } = useT();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const running = useRef(0);
  const jobsRef = useRef<Job[]>([]);
  const targetRef = useRef<UploadTarget>(target);
  targetRef.current = target;

  const setJobsSync = useCallback((updater: (prev: Job[]) => Job[]) => {
    jobsRef.current = updater(jobsRef.current);
    setJobs(jobsRef.current);
  }, []);

  const patchJob = useCallback(
    (key: string, patch: Partial<Job>) => setJobsSync((prev) => prev.map((j) => (j.key === key ? { ...j, ...patch } : j))),
    [setJobsSync]
  );

  const pump = useCallback(() => {
    const userId = session?.user.id;
    if (!userId) return;
    while (running.current < CONCURRENCY) {
      const next = jobsRef.current.find((j) => j.status === "waiting");
      if (!next) break;
      running.current++;
      patchJob(next.key, { status: "uploading" });
      const work = next.file
        ? uploadRef(next.file, { userId, target: next.target, pasted: next.pasted })
        : saveFromUrl(next.url ?? "", { userId, target: next.target });
      work
        .then((ref) => {
          patchJob(next.key, { status: "done" });
          emitRefCreated(ref);
          onUploaded();
        })
        .catch((e) => patchJob(next.key, { status: "error", error: friendlyError(e) }))
        .finally(() => {
          running.current--;
          pump();
        });
    }
  }, [session, patchJob, onUploaded]);

  const uploadFiles = useCallback(
    (files: File[], opts?: { pasted?: boolean }) => {
      if (!files.length) return;
      const added: Job[] = files.map((file): Job => {
        const invalid = validateImageFile(file);
        return {
          key: crypto.randomUUID(),
          file,
          name: opts?.pasted ? tr("붙여넣은 이미지") : file.name,
          preview: invalid ? "" : URL.createObjectURL(file),
          status: invalid ? "error" : "waiting",
          error: invalid ?? undefined,
          pasted: !!opts?.pasted,
          target: { ...targetRef.current },
        };
      });
      setJobsSync((prev) => [...prev, ...added]);
      pump();
    },
    [pump, setJobsSync]
  );

  const saveUrls = useCallback(
    (urls: string[]) => {
      const added: Job[] = urls
        .map((u) => u.trim())
        .filter(Boolean)
        .map((url): Job => {
          let name = url;
          try {
            const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
            name = u.hostname.replace(/^www\./, "") + (u.pathname.length > 1 ? u.pathname : "");
          } catch {
            // 주소가 이상해도 서버가 알려 줌
          }
          return { key: crypto.randomUUID(), url, name, preview: "", status: "waiting", pasted: false, target: { ...targetRef.current } };
        });
      if (!added.length) return;
      setJobsSync((prev) => [...prev, ...added]);
      pump();
    },
    [pump, setJobsSync]
  );

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  // 붙여넣기 (Cmd/Ctrl + V)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        uploadFiles(files, { pasted: true });
        return;
      }
      // 입력칸 밖에서 이미지·웹페이지 주소를 붙여넣으면 URL로 저장
      if (isTyping(e.target)) return;
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (looksLikeUrl(text)) {
        e.preventDefault();
        saveUrls([text.trim()]);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [uploadFiles, saveUrls]);

  // 드래그 앤 드롭 (화면 어디든)
  useEffect(() => {
    let depth = 0;
    // 파일, 또는 다른 브라우저 탭에서 끌어온 이미지 링크
    const hasFiles = (e: DragEvent) => {
      const types = Array.from(e.dataTransfer?.types ?? []);
      return types.includes("Files") || types.includes("text/uri-list");
    };

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) {
        uploadFiles(files);
        return;
      }
      const links = (e.dataTransfer?.getData("text/uri-list") ?? "")
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith("#") && looksLikeUrl(l));
      if (links.length) saveUrls(links.slice(0, 20));
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [uploadFiles, saveUrls]);

  // 모두 성공하면 잠시 뒤 패널을 정리
  const active = jobs.some((j) => j.status === "waiting" || j.status === "uploading");
  const failed = jobs.filter((j) => j.status === "error").length;
  useEffect(() => {
    if (!jobs.length || active || failed) return;
    const timer = setTimeout(() => clearJobs(), 3500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length, active, failed]);

  function clearJobs() {
    jobsRef.current.forEach((j) => j.preview && URL.revokeObjectURL(j.preview));
    setJobsSync(() => []);
  }

  return (
    <Ctx.Provider value={{ openPicker, uploadFiles, saveUrls }}>
      {children}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => {
          uploadFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {/* 끌어다 놓을 때 덮이는 화면 */}
      <div
        aria-hidden={!dragging}
        className={`pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-paper/90 backdrop-blur-sm transition-opacity duration-200 ${
          dragging ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-4 rounded-2xl border-[1.5px] border-dashed border-ink sm:inset-6" />
        <div className="relative px-6 text-center">
          <p className="text-[32px] font-semibold tracking-[-0.04em] sm:text-[48px]">{t("여기에 놓으세요")}</p>
          <p className="mt-3 text-[15px] text-graphite">
            {targetRef.current.collectionId
              ? t("지금 보고 있는 컬렉션에 바로 들어가요.")
              : targetRef.current.categoryId
                ? t("지금 보고 있는 카테고리에 바로 들어가요.")
                : t("라이브러리에 바로 올라가요.")}
          </p>
        </div>
      </div>

      {/* 올리는 중 패널 */}
      {jobs.length > 0 && (
        <UploadPanel jobs={jobs} active={active} failed={failed} onClose={clearJobs} />
      )}
    </Ctx.Provider>
  );
}

function UploadPanel({
  jobs,
  active,
  failed,
  onClose,
}: {
  jobs: Job[];
  active: boolean;
  failed: number;
  onClose: () => void;
}) {
  const { t } = useT();
  const done = jobs.filter((j) => j.status === "done").length;
  const heading = active
    ? t("올리는 중 {done}/{total}", { done, total: jobs.length })
    : failed
      ? t("{done}장 올림, {failed}장 실패", { done, failed })
      : t("{done}장 모두 올렸어요", { done });

  return (
    <div className="fixed bottom-4 right-4 z-[55] w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden rounded-xl border border-hairline bg-paper sm:bottom-6 sm:right-6">
      <div className="flex h-12 items-center justify-between border-b border-hairline pl-4 pr-2">
        <p className="text-[14px] font-medium tabular-nums" role="status" aria-live="polite">
          {heading}
        </p>
        {!active && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("닫기")}
            className="grid h-8 w-8 place-items-center rounded-full text-graphite hover:bg-haze hover:text-ink"
          >
            <CloseIcon size={16} />
          </button>
        )}
      </div>
      <div className="h-[2px] bg-haze">
        <div
          className="h-full bg-ink transition-[width] duration-300"
          style={{ width: `${(jobs.filter((j) => j.status === "done" || j.status === "error").length / jobs.length) * 100}%` }}
        />
      </div>
      <ul className="max-h-64 overflow-y-auto py-1.5">
        {jobs.map((j) => (
          <li key={j.key} className="flex items-center gap-3 px-4 py-2">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-[6px] bg-haze">
              {j.preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={j.preview} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px]">{j.name}</p>
              {j.status === "error" && <p className="truncate text-[12px] text-red-600">{j.error}</p>}
            </div>
            <JobStatus status={j.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function JobStatus({ status }: { status: Status }) {
  const { t } = useT();
  if (status === "uploading")
    return <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-hairline border-t-ink" aria-label={t("올리는 중")} />;
  if (status === "done")
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-label={t("완료")}>
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "error")
    return <span className="shrink-0 text-[12px] text-red-600">{t("실패")}</span>;
  return <span className="shrink-0 text-[12px] text-graphite">{t("대기")}</span>;
}
