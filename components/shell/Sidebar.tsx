"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BoardIcon, CloseIcon, GridIcon, HeartIcon, PlusIcon, SettingsIcon } from "@/components/icons";
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
      {typeof count === "number" && <span className="text-[12px] tabular-nums text-graphite">{count}</span>}
    </Link>
  );
}

function GroupHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex h-7 items-center justify-between px-2.5">
      <p className="text-[12px] text-graphite">{children}</p>
      {action}
    </div>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="mx-2.5 my-2.5 h-3 w-24 rounded bg-haze" />
      ))}
    </>
  );
}

const TAG_PREVIEW = 8;

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { counts, openNewCollection } = useShell();
  const pathname = usePathname();
  const params = useSearchParams();
  const [allTags, setAllTags] = useState(false);

  const onHome = pathname === "/";
  const view = params.get("view");
  const category = params.get("category");
  const tag = params.get("tag");
  const q = params.get("q");
  const isAll = onHome && !view && !category && !tag && !q;

  const tags = counts?.tags.filter((t) => t.ref_count > 0) ?? [];
  const shownTags = allTags ? tags : tags.slice(0, TAG_PREVIEW);
  const collections = counts?.collections ?? [];

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
        <NavItem
          href="/moodboards"
          active={pathname.startsWith("/moodboards")}
          label="무드보드"
          icon={<BoardIcon />}
        />
      </div>

      <div className="mt-9">
        <GroupHeader
          action={
            <button
              type="button"
              onClick={() => openNewCollection()}
              aria-label="새 컬렉션"
              className="-mr-1.5 grid h-7 w-7 place-items-center rounded-full text-graphite hover:bg-haze hover:text-ink"
            >
              <PlusIcon size={14} />
            </button>
          }
        >
          <Link href="/collections" className={`hover:text-ink ${pathname === "/collections" ? "text-ink" : ""}`}>
            컬렉션
          </Link>
        </GroupHeader>
        <div className="flex flex-col gap-0.5">
          {counts === null && <Skeleton rows={2} />}
          {counts && collections.length === 0 && (
            <button
              type="button"
              onClick={() => openNewCollection()}
              className="px-2.5 py-1.5 text-left text-[13px] leading-relaxed text-graphite hover:text-ink"
            >
              프로젝트별로 레퍼런스를 묶어 보세요. 새 컬렉션 만들기
            </button>
          )}
          {collections.map((c) => (
            <NavItem
              key={c.id}
              href={`/collections/${c.id}`}
              active={pathname === `/collections/${c.id}`}
              label={c.name}
              count={c.ref_count}
            />
          ))}
        </div>
      </div>

      <div className="mt-9">
        <GroupHeader>카테고리</GroupHeader>
        <div className="flex flex-col gap-0.5">
          {counts === null && <Skeleton rows={6} />}
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

      {tags.length > 0 && (
        <div className="mt-9">
          <GroupHeader>태그</GroupHeader>
          <div className="flex flex-wrap gap-1.5 px-2.5">
            {shownTags.map((t) => {
              const active = onHome && tag === t.id;
              return (
                <Link
                  key={t.id}
                  href={`/?tag=${t.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors ${
                    active ? "border-ink bg-ink text-paper" : "border-hairline text-graphite hover:border-ink hover:text-ink"
                  }`}
                >
                  {t.name}
                  <span className={`tabular-nums ${active ? "text-paper/70" : "text-graphite/70"}`}>{t.ref_count}</span>
                </Link>
              );
            })}
          </div>
          {tags.length > TAG_PREVIEW && (
            <button
              type="button"
              onClick={() => setAllTags((v) => !v)}
              className="mt-2 px-2.5 text-[12px] text-graphite underline-offset-4 hover:text-ink hover:underline"
            >
              {allTags ? "접기" : `태그 ${tags.length - TAG_PREVIEW}개 더 보기`}
            </button>
          )}
        </div>
      )}

      <div className="mt-auto pt-10">
        <NavItem href="/settings" active={pathname === "/settings"} label="설정" icon={<SettingsIcon />} />
      </div>
    </nav>
  );
}
