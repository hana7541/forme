"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useShell } from "@/components/shell/AppShell";
import { PlusIcon } from "@/components/icons";
import { createMoodboard, fetchMoodboards, type MoodboardWithItems } from "@/lib/moodboards";
import { gridPath, signedUrls } from "@/lib/refs";

// 카드 미리보기: 보드 배치를 그대로 작게 줄여서 보여 줌
function BoardPreview({ board, urls }: { board: MoodboardWithItems; urls: Record<string, string> }) {
  const items = [...board.moodboard_items].sort((a, b) => a.z_index - b.z_index);
  if (!items.length) {
    return <div className="aspect-[4/3] rounded-[10px] border border-hairline" style={{ backgroundColor: board.background }} />;
  }
  const minX = Math.min(...items.map((i) => i.x));
  const minY = Math.min(...items.map((i) => i.y));
  const maxX = Math.max(...items.map((i) => i.x + i.width));
  const maxY = Math.max(...items.map((i) => i.y + i.height));
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  // 4:3 틀 안에 들어가도록 비율 맞춤
  const frame = 4 / 3;
  const contentRatio = w / h;
  const scaleW = contentRatio > frame ? 1 : contentRatio / frame;
  const scaleH = contentRatio > frame ? frame / contentRatio : 1;

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] border border-hairline" style={{ backgroundColor: board.background }}>
      <div
        className="absolute"
        style={{
          left: `${(1 - scaleW * 0.86) * 50}%`,
          top: `${(1 - scaleH * 0.86) * 50}%`,
          width: `${scaleW * 86}%`,
          height: `${scaleH * 86}%`,
        }}
      >
        {items.slice(-40).map((i) => {
          const path = i.refs ? gridPath(i.refs) : null;
          return (
            <div
              key={i.id}
              className="absolute overflow-hidden"
              style={{
                left: `${((i.x - minX) / w) * 100}%`,
                top: `${((i.y - minY) / h) * 100}%`,
                width: `${(i.width / w) * 100}%`,
                height: `${(i.height / h) * 100}%`,
                backgroundColor: i.refs?.dominant_color ?? "#f4f4f2",
              }}
            >
              {path && urls[path] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[path]} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금 고침";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전 고침`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전 고침`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 고침`;
}

export default function MoodboardsPage() {
  const router = useRouter();
  const { show } = useToast();
  const { reloadCounts } = useShell();
  const [boards, setBoards] = useState<MoodboardWithItems[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchMoodboards()
      .then(async (list) => {
        setBoards(list);
        const paths = list.flatMap((b) => b.moodboard_items.slice(-40).flatMap((i) => (i.refs ? [gridPath(i.refs)] : [])));
        if (paths.length) setUrls(await signedUrls(paths));
      })
      .catch(() => setBoards([]));
  }, []);

  async function create() {
    setCreating(true);
    try {
      const board = await createMoodboard({ name: "새 무드보드" });
      void reloadCounts();
      router.push(`/moodboards/${board.id}`);
    } catch {
      show("무드보드를 만들지 못했어요.");
      setCreating(false);
    }
  }

  return (
    <div>
      <header className="mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[52px] lg:text-[68px]">
            Moodboards
            <sup className="ml-2 align-super text-[13px] font-normal tracking-normal text-graphite tabular-nums sm:text-[15px]">
              {boards?.length ?? ""}
            </sup>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-graphite">
            레퍼런스를 캔버스 위에 자유롭게 놓고, 크기를 바꾸고, 겹쳐 보는 곳이에요. 컬렉션 화면에서 바로 만들 수도 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void create()}
          disabled={creating}
          className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-full border border-ink px-5 text-[14px] font-medium transition-colors hover:bg-ink hover:text-paper disabled:opacity-50 md:self-auto"
        >
          <PlusIcon size={16} />
          {creating ? "만드는 중…" : "새 무드보드"}
        </button>
      </header>

      {boards === null && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="aspect-[4/3] rounded-[10px] bg-haze" />
          ))}
        </div>
      )}

      {boards && boards.length === 0 && (
        <p className="max-w-md text-[15px] leading-relaxed text-graphite">
          아직 무드보드가 없어요. 새 무드보드를 만들거나, 컬렉션 화면에서 ‘무드보드 만들기’를 눌러 보세요.
        </p>
      )}

      {boards && boards.length > 0 && (
        <ul className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {boards.map((b) => (
            <li key={b.id}>
              <Link href={`/moodboards/${b.id}`} className="group block">
                <div className="transition-opacity duration-200 group-hover:opacity-90">
                  <BoardPreview board={b} urls={urls} />
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <p className="truncate text-[16px] font-medium tracking-[-0.01em] group-hover:underline group-hover:underline-offset-4">
                    {b.name}
                  </p>
                  <p className="shrink-0 text-[13px] tabular-nums text-graphite">{b.moodboard_items.length}</p>
                </div>
                <p className="mt-1 text-[13px] text-graphite">{timeAgo(b.updated_at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
