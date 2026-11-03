"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CloseIcon, FolderIcon, GridIcon, HeartIcon, PlusIcon, SettingsIcon } from "@/components/icons";
import { useToast } from "@/components/Toast";
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
      className={`group flex h-9 items-center gap-3 rounded-md px-2.5 text-[14px] transition-colors ${
        active ? "bg-haze text-ink" : "text-graphite hover:text-ink"
      }`}
    >
      {icon && <span className={active ? "text-ink" : "text-graphite group-hover:text-ink"}>{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {typeof count === "number" && (
        <span className="text-[12px] tabular-nums text-graphite">{count}</span>
      )}
    </Link>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 px-2.5 text-[12px] text-graphite">{children}</p>;
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { counts } = useShell();
  const { show } = useToast();
  const pathname = usePathname();
  const params = useSearchParams();

  const onHome = pathname === "/";
  const view = params.get("view");
  const category = params.get("category");
  const isAll = onHome && !view && !category;

  return (
    <nav className="flex h-full flex-col overflow-y-auto px-5 pb-6 pt-6">
      <div className="mb-10 flex items-center justify-between px-2.5">
        <Link href="/" className="text-[22px] font-bold leading-none tracking-[-0.05em]">
          FORME
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="메뉴 닫기"
            className="-mr-1 grid h-9 w-9 place-items-center rounded-full text-graphite hover:bg-haze hover:text-ink"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <NavItem href="/" active={isAll} label="전체" count={counts?.total} icon={<GridIcon />} />
        <NavItem
          href="/?view=favorites"
          active={onHome && view === "favorites"}
          label="즐겨찾기"
          count={counts?.favorites}
          icon={<HeartIcon />}
        />
      </div>

      <div className="mt-9">
        <GroupLabel>카테고리</GroupLabel>
        <div className="flex flex-col gap-0.5">
          {counts === null &&
            Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="mx-2.5 my-2.5 h-3 w-24 rounded bg-haze" />
            ))}
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
      </div>

      <div className="mt-9">
        <GroupLabel>컬렉션</GroupLabel>
        <p className="px-2.5 py-1.5 text-[13px] leading-relaxed text-graphite">
          프로젝트별로 레퍼런스를 묶어 둘 수 있어요.
        </p>
        <button
          type="button"
          onClick={() => show("컬렉션은 STEP 10에서 열려요")}
          className="mt-1 flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-[14px] text-graphite transition-colors hover:text-ink"
        >
          <FolderIcon />
          <span className="flex-1 text-left">새 컬렉션</span>
          <PlusIcon size={14} />
        </button>
      </div>

      <div className="mt-auto pt-10">
        <button
          type="button"
          onClick={() => show("설정은 STEP 12에서 열려요")}
          className="flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-[14px] text-graphite transition-colors hover:text-ink"
        >
          <SettingsIcon />
          <span>설정</span>
        </button>
      </div>
    </nav>
  );
}
