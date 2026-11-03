"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLibraryCounts, type LibraryCounts } from "@/lib/library";
import { UploadManager, useUpload } from "@/components/upload/UploadManager";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

type ShellCtx = {
  counts: LibraryCounts | null;
  countsError: string | null;
  reloadCounts: () => Promise<void>;
  openUpload: () => void;
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
  const categoryId = params.get("category");
  const { reload } = counts;
  const onUploaded = useCallback(() => {
    void reload();
  }, [reload]);

  return (
    <UploadManager currentCategoryId={categoryId} onUploaded={onUploaded}>
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
  const { openPicker } = useUpload();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();

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
    <Ctx.Provider value={{ counts: data, countsError: error, reloadCounts: reload, openUpload: openPicker }}>
      <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* PC: 고정 사이드바 */}
        <aside className="sticky top-0 hidden h-screen border-r border-hairline lg:block">
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
            aria-label="메뉴"
            aria-hidden={!drawerOpen}
            className={`drawer-panel absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-paper ${
              drawerOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <Sidebar onClose={() => setDrawerOpen(false)} />
          </aside>
        </div>

        <div className="min-w-0">
          <Topbar onOpenMenu={() => setDrawerOpen(true)} />
          <main className="px-5 pb-24 pt-8 sm:px-8 lg:px-12 lg:pt-12">{children}</main>
        </div>
      </div>
    </Ctx.Provider>
  );
}
