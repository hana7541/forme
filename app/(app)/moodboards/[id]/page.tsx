"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BoardEditor } from "@/components/moodboard/BoardEditor";
import { fetchMoodboard, type MoodboardWithItems } from "@/lib/moodboards";

export default function MoodboardPage() {
  const { id } = useParams<{ id: string }>();
  const [board, setBoard] = useState<MoodboardWithItems | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBoard(null);
    setMissing(false);
    fetchMoodboard(id)
      .then((b) => {
        if (cancelled) return;
        if (b) setBoard(b);
        else setMissing(true);
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (missing) {
    return (
      <div className="max-w-md">
        <h1 className="text-[40px] font-semibold tracking-[-0.045em]">무드보드를 찾을 수 없어요</h1>
        <p className="mt-4 text-[15px] text-graphite">삭제됐거나 주소가 잘못됐어요.</p>
        <Link href="/moodboards" className="mt-6 inline-block text-[14px] underline underline-offset-4">
          무드보드 목록으로
        </Link>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-paper">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-hairline border-t-ink" />
      </div>
    );
  }

  return <BoardEditor key={board.id} initial={board} />;
}
