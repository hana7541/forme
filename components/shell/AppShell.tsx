"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CollectionDialog } from "@/components/collections/CollectionDialog";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n";
import { useLibraryCounts, type LibraryCounts } from "@/lib/library";
import { UploadManager } from "@/components/upload/UploadManager";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AddModal } from "@/components/upload/AddModal";

type ShellCtx = {
  counts: LibraryCounts | null;
  countsError: string | null;
  reloadCounts: () => Promise<void>;
  openUpload: () => void;
  // 새 컬렉션 만들기 (선택한 레퍼런스를 바로 넣을 수도 있음)
  openNewCollection: (opts?: { refIds?: string[]; stay?: boolean; onCreated?: (id: string) => void }) => void;
};

const Ctx = createContext<ShellCtx | null>(null);

export function useShell() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShell must be used inside <AppShell>");
  return ctx;
}

// 로그인 후 모든 화면의 공통 틀: 사이드바 + 위쪽 바 + 본문
export function AppShell({ children }: { children: React.ReactNode }) {
  const counts = useLibraryCounts();
  const params = useSearchParams();
  const pathname = usePathname();
  const categoryId = pathname === "/" ? params.get("category") : null;
  const collectionId = pathname.match(/^\/collections\/([0-9a-f-]{36})/)?.[1] ?? null;
  const target = useMemo(() => ({ categoryId, collectionId }), [categoryId, collectionId]);
  const { reload } = counts;
  const onUploaded = useCallback(() => {
    void reload();
  }, [reload]);

  return (
    <UploadManager target={target} onUploaded={onUploaded}>
      <ShellFrame counts={counts}>{children}</ShellFrame>
    </UploadManager>
  );
}

function ShellFrame({
  counts,
  children,
}: {
  counts: ReturnType<typeof useLibraryCounts>;
  children: React.ReactNode;
}) {
  const { data, error, reload } = counts;
  const [addOpen, setAddOpen] = useState(false);
  const openUpload = useCallback(() => setAddOpen(true), []);
  const { show } = useToast();
  const { t, cat } = useT();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newCollection, setNewCollection] = useState<{
    refIds: string[];
    stay: boolean;
    onCreated?: (id: string) => void;
  } | null>(null);

  const openNewCollection = useCallback<ShellCtx["openNewCollection"]>((opts) => {
    setNewCollection({ refIds: opts?.refIds ?? [], stay: !!opts?.stay, onCreated: opts?.onCreated });
  }, []);
  const closeNewCollection = useCallback(() => setNewCollection(null), []);
  const pathname = usePathname();
  const params = useSearchParams();

  // Add New 창에 "어디로 들어가는지" 안내
  const homeCategory = pathname === "/" ? params.get("category") : null;
  const collectionMatch = pathname.match(/^\/collections\/([0-9a-f-]{36})/)?.[1] ?? null;
  const destination = collectionMatch
    ? t("‘{name}’ 컬렉션에 바로 들어가요.", { name: data?.collections.find((c) => c.id === collectionMatch)?.name ?? "" })
    : homeCategory
      ? t("‘{name}’ 카테고리로 바로 들어가요.", { name: cat(data?.categories.find((c) => c.id === homeCategory)?.name ?? "") })
      : pathname.startsWith("/moodboards/")
        ? t("라이브러리에 저장되고, 지금 보고 있는 무드보드에도 놓여요.")
        : null;

  // 메뉴에서 다른 곳으로 이동하면 서랍 닫기
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, params]);

  // 서랍이 열려 있을 땐 뒤 화면 스크롤 막기 + Esc로 닫기
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  return (
    <Ctx.Provider value={{ counts: data, countsError: error, reloadCounts: reload, openUpload, openNewCollection }}>
      {/* 전체 너비 헤더 (스크롤해도 위에 고정) */}
      <Header onOpenMenu={() => setDrawerOpen(true)} />

      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* PC: 헤더 아래 고정 사이드바 */}
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] border-r border-hairline lg:block">
          <Sidebar />
        </aside>

        {/* 태블릿·모바일: 왼쪽에서 밀려 나오는 서랍 */}
        <div className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? "" : "pointer-events-none"}`}>
          <div
            className={`drawer-scrim absolute inset-0 bg-ink/20 ${drawerOpen ? "opacity-100" : "opacity-0"}`}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            aria-label={t("메뉴")}
            aria-hidden={!drawerOpen}
            className={`drawer-panel absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-paper ${
              drawerOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <Sidebar onClose={() => setDrawerOpen(false)} />
          </aside>
        </div>

        {/* 본문만 스크롤 */}
        <main className="min-w-0 px-4 pb-24 pt-8 sm:px-6 lg:px-10 lg:pt-10">{children}</main>
      </div>

      <AddModal open={addOpen} onClose={() => setAddOpen(false)} destination={destination} />

      <CollectionDialog
        open={!!newCollection}
        onClose={closeNewCollection}
        refIds={newCollection?.refIds}
        onSaved={(c) => {
          const req = newCollection;
          void reload();
          req?.onCreated?.(c.id);
          if (req?.stay) show(t("‘{name}’ 컬렉션에 넣었어요", { name: c.name }));
          else router.push(`/collections/${c.id}`);
        }}
      />
    </Ctx.Provider>
  );
}
