"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BoardIcon, CloseIcon, FolderIcon, GridIcon, HeartIcon } from "@/components/icons";
import { useShell } from "./AppShell";

type NavItemProps = {
  href: string;
  active: boolean;
  label: string;
  count?: number;
  icon?: React.ReactNode;
};

function NavItem({ href, active, label, count, icon }: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex h-9 items-center gap-3 rounded-[6px] px-3 text-[14px] transition-colors ${
        active ? "bg-haze font-medium text-ink" : "text-graphite hover:bg-haze/60 hover:text-ink"
      }`}
    >
      {icon && <span className={active ? "text-ink" : "text-graphite group-hover:text-ink"}>{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {typeof count === "number" && (
        <span className={`text-[12px] tabular-nums ${active ? "text-ink" : "text-graphite"}`}>{count}</span>
      )}
    </Link>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-graphite">{children}</p>;
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { counts } = useShell();
  const pathname = usePathname();
  const params = useSearchParams();

  const onHome = pathname === "/";
  const view = params.get("view");
  const category = params.get("category");
  const tag = params.get("tag");
  const q = params.get("q");
  const isAll = onHome && view !== "favorites" && !category && !tag && !q;

  return (
    <nav aria-label="라이브러리 메뉴" className="flex h-full flex-col overflow-y-auto px-4 pb-6 pt-8">
      {onClose && (
        <div className="mb-6 flex items-center justify-between px-3">
          <span className="text-[19px] font-bold tracking-[-0.05em]">FORME.</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="메뉴 닫기"
            className="-mr-2 grid h-9 w-9 place-items-center rounded-full text-graphite hover:bg-haze hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      <GroupLabel>Library</GroupLabel>
      <div className="flex flex-col gap-0.5">
        <NavItem href="/" active={isAll} label="All References" count={counts?.total} icon={<GridIcon size={17} />} />
        <NavItem
          href="/?view=favorites"
          active={onHome && view === "favorites"}
          label="Favorites"
          count={counts?.favorites}
          icon={<HeartIcon size={17} />}
        />
        <NavItem
          href="/collections"
          active={pathname.startsWith("/collections")}
          label="Collections"
          count={counts?.collections.length}
          icon={<FolderIcon size={17} />}
        />
        <NavItem
          href="/moodboards"
          active={pathname.startsWith("/moodboards")}
          label="Moodboards"
          count={counts?.moodboards}
          icon={<BoardIcon size={17} />}
        />
      </div>

      <div className="mx-3 my-7 h-px bg-hairline" />

      <GroupLabel>Categories</GroupLabel>
      <div className="flex flex-col gap-0.5">
        {counts === null &&
          Array.from({ length: 5 }, (_, i) => <div key={i} className="mx-3 my-3 h-3 w-24 rounded bg-haze" />)}
        {counts?.categories.map((c) => (
          <NavItem
            key={c.id}
            href={`/?category=${c.id}`}
            active={onHome && category === c.id}
            label={c.name}
            count={c.count}
          />
        ))}
      </div>
    </nav>
  );
}
