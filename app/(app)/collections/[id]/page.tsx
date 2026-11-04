"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useShell } from "@/components/shell/AppShell";
import { useToast } from "@/components/Toast";
import { Dialog } from "@/components/Dialog";
import { Button } from "@/components/ui";
import { UploadIcon } from "@/components/icons";
import { LibraryView } from "@/components/library/LibraryView";
import { CollectionDialog } from "@/components/collections/CollectionDialog";
import { deleteCollection, fetchCollection, type Collection } from "@/lib/collections";
import { createMoodboard } from "@/lib/moodboards";
import type { RefFilter } from "@/lib/refs";
import { useT } from "@/lib/i18n";

const actionBtn =
  "inline-flex h-10 items-center gap-2 rounded-full border border-hairline px-4 text-[13px] transition-colors hover:border-ink disabled:opacity-50";

function CollectionScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { reloadCounts, openUpload } = useShell();
  const { show } = useToast();
  const { t } = useT();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [makingBoard, setMakingBoard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCollection(null);
    setMissing(false);
    fetchCollection(id)
      .then((c) => {
        if (cancelled) return;
        if (c) setCollection(c);
        else setMissing(true);
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const base = useMemo<RefFilter>(() => ({ collectionId: id }), [id]);

  if (missing) {
    return (
      <div className="max-w-md">
        <h1 className="text-[40px] font-semibold tracking-[-0.045em]">{t("컬렉션을 찾을 수 없어요")}</h1>
        <p className="mt-4 text-[15px] text-graphite">{t("삭제됐거나 주소가 잘못됐어요.")}</p>
        <Link href="/collections" className="mt-6 inline-block text-[14px] underline underline-offset-4">
          {t("컬렉션 목록으로")}
        </Link>
      </div>
    );
  }

  async function makeBoard() {
    if (!collection) return;
    setMakingBoard(true);
    try {
      const board = await createMoodboard({ name: collection.name, collectionId: collection.id });
      void reloadCounts();
      router.push(`/moodboards/${board.id}`);
    } catch {
      show(t("무드보드를 만들지 못했어요."));
      setMakingBoard(false);
    }
  }

  async function doDelete() {
    if (!collection) return;
    setDeleting(true);
    try {
      await deleteCollection(collection.id);
      await reloadCounts();
      show(t("‘{name}’ 컬렉션을 지웠어요", { name: collection.name }));
      router.replace("/collections");
    } catch {
      setDeleting(false);
      show(t("컬렉션을 지우지 못했어요."));
    }
  }

  return (
    <>
      <nav aria-label={t("위치")} className="mb-4 text-[13px] text-graphite">
        <Link href="/collections" className="hover:text-ink">
          {t("컬렉션@nav")}
        </Link>
      </nav>

      <LibraryView
        base={base}
        collectionId={id}
        categoryFilter
        title={collection?.name ?? " "}
        description={collection?.description || undefined}
        actions={
          collection && (
            <>
              <button type="button" onClick={() => void makeBoard()} disabled={makingBoard} className={actionBtn}>
                {makingBoard ? t("무드보드 만드는 중…") : t("무드보드 만들기")}
              </button>
              <button type="button" onClick={() => setEditing(true)} className={actionBtn}>
                {t("고치기")}
              </button>
              <button type="button" onClick={() => setConfirmDelete(true)} className={`${actionBtn} text-graphite hover:text-red-600`}>
                {t("삭제")}
              </button>
            </>
          )
        }
        empty={
          <div>
            <p className="text-[15px] leading-relaxed text-graphite">
              {t("이 컬렉션은 비어 있어요. 이 화면에서 바로 올리면 컬렉션에 들어가고, 라이브러리에서 ‘선택’으로 여러 장을 골라 넣을 수도 있어요.")}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openUpload}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-ink px-5 text-[14px] font-medium transition-colors hover:bg-ink hover:text-paper"
              >
                <UploadIcon size={16} />
                {t("이미지 올리기")}
              </button>
              <Link href="/" className="inline-flex h-11 items-center rounded-full px-5 text-[14px] hover:bg-haze">
                {t("라이브러리에서 고르기")}
              </Link>
            </div>
          </div>
        }
      />

      <CollectionDialog
        open={editing}
        onClose={() => setEditing(false)}
        editing={collection}
        onSaved={(c) => {
          setCollection(c);
          void reloadCounts();
          show(t("저장했어요"));
        }}
      />

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t("컬렉션을 지울까요?")}>
        <p className="text-[15px] leading-relaxed text-graphite">
          {t("‘{name}’ 컬렉션만 지워져요. 안에 있던 이미지는 라이브러리에 그대로 남아요.", { name: collection?.name ?? "" })}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
            {t("취소")}
          </Button>
          <Button type="button" loading={deleting} onClick={() => void doDelete()} className="bg-red-600! text-white!">
            {t("지우기")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export default function CollectionPage() {
  return (
    <Suspense fallback={null}>
      <CollectionScreen />
    </Suspense>
  );
}
