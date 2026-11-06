// 무드보드 내보내기: 보드 배치를 그대로 한 장의 이미지(PNG)나 PDF로
// - 원본 이미지를 받아서, 화면과 같은 자리·크기·자르기(가득 채우기)로 캔버스에 그림
// - 브라우저 캔버스 한계(특히 iPhone Safari 약 1,600만 화소)를 넘지 않게 크기를 맞춤
import { tr } from "@/lib/i18n";
import { signedUrls } from "@/lib/refs";
import {
  TEXT_FONT_FAMILY,
  TEXT_LINE_HEIGHT,
  TEXT_TRACKING_EM,
  textStyleOf,
  type BoardItem,
} from "@/lib/moodboards";

const PAD = 80; // 보드 가장자리 여백 (보드 단위)
const MAX_SCALE = 2; // 화면보다 2배 선명하게
const MAX_SIDE = 8000; // 한 변 최대 화소
const MAX_PIXELS = 16_000_000; // 전체 화소 상한

export type ExportProgress = { done: number; total: number };

type Drawable = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function loadImage(url: string): Promise<Drawable> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const blob = await res.blob();
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(blob);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // 일부 형식은 아래 방법으로 다시 시도
    }
  }
  // 같은 출처(blob:) 주소라 캔버스가 오염되지 않음
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = objectUrl;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// 화면의 줄바꿈(pre-wrap · keep-all · 넘치면 글자 단위)과 최대한 같게 줄 나누기
export function wrapText(measure: (s: string) => number, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const tokens = paragraph.split(/(\s+)/).filter((tok) => tok.length);
    let line = "";
    for (const tok of tokens) {
      const next = line + tok;
      if (measure(next.trimEnd()) <= maxWidth || !line.trim()) {
        if (measure(next.trimEnd()) <= maxWidth) {
          line = next;
          continue;
        }
      } else if (!/^\s+$/.test(tok)) {
        lines.push(line.trimEnd());
        line = "";
        if (measure(tok) <= maxWidth) {
          line = tok;
          continue;
        }
      } else {
        // 줄 끝 공백은 다음 줄로 넘기지 않음
        lines.push(line.trimEnd());
        line = "";
        continue;
      }
      // 한 단어가 한 줄보다 길면 글자 단위로 자름
      for (const ch of Array.from(tok)) {
        if (line && measure(line + ch) > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += ch;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function drawText(ctx: CanvasRenderingContext2D, item: BoardItem, x: number, y: number, w: number, scale: number) {
  const s = textStyleOf(item);
  const size = s.size * scale;
  ctx.font = `${s.weight} ${size}px ${TEXT_FONT_FAMILY}`;
  // 화면과 같은 자간 (지원하는 브라우저에서)
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = `${TEXT_TRACKING_EM * size}px`;
  ctx.fillStyle = s.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = s.align;
  const lineHeight = size * TEXT_LINE_HEIGHT;
  const lines = wrapText((str) => ctx.measureText(str).width, item.content ?? "", w);
  const ax = s.align === "center" ? x + w / 2 : s.align === "right" ? x + w : x;
  lines.forEach((line, n) => ctx.fillText(line, ax, y + lineHeight * (n + 0.5)));
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await worker(items[next++]);
    })
  );
}

export async function renderBoard(
  items: BoardItem[],
  background: string,
  onProgress?: (p: ExportProgress) => void
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  if (!items.length) throw new Error(tr("보드가 비어 있어요. 이미지를 먼저 넣어 주세요."));

  const minX = Math.min(...items.map((i) => i.x)) - PAD;
  const minY = Math.min(...items.map((i) => i.y)) - PAD;
  const maxX = Math.max(...items.map((i) => i.x + i.width)) + PAD;
  const maxY = Math.max(...items.map((i) => i.y + i.height)) + PAD;
  const width = maxX - minX;
  const height = maxY - minY;
  const scale = Math.min(MAX_SCALE, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_PIXELS / (width * height)));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(tr("이 브라우저에서는 내보낼 수 없어요."));
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 텍스트에 쓰인 글꼴 굵기를 미리 불러 둠 (안 하면 기본 글꼴로 그려질 수 있음)
  const texts = items.filter((i) => i.kind === "text");
  if (texts.length && typeof document !== "undefined" && document.fonts) {
    const weights = [...new Set(texts.map((i) => textStyleOf(i).weight))];
    await Promise.all(weights.map((w) => document.fonts.load(`${w} 40px ${TEXT_FONT_FAMILY}`, "가A").catch(() => []))).catch(() => {});
  }

  // 원본 이미지 받기 (4장씩)
  const withRef = items.filter((i) => i.kind !== "text" && i.refs);
  const urls = await signedUrls(withRef.map((i) => i.refs!.storage_path)).catch(() => ({} as Record<string, string>));
  const loaded = new Map<string, Drawable>();
  let done = 0;
  onProgress?.({ done, total: withRef.length });
  await runPool(withRef, 4, async (item) => {
    const url = urls[item.refs!.storage_path];
    if (url) {
      try {
        loaded.set(item.id, await loadImage(url));
      } catch {
        // 못 받은 이미지는 대표색 칸으로 남김
      }
    }
    onProgress?.({ done: ++done, total: withRef.length });
  });

  // 겹침 순서대로 그리기
  for (const item of [...items].sort((a, b) => a.z_index - b.z_index)) {
    const x = (item.x - minX) * scale;
    const y = (item.y - minY) * scale;
    const w = item.width * scale;
    const h = item.height * scale;

    ctx.save();
    if (item.rotation) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((item.rotation * Math.PI) / 180);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    const img = loaded.get(item.id);
    if (item.kind === "text") {
      drawText(ctx, item, x, y, w, scale);
    } else if (img && img.width && img.height) {
      // 화면과 같은 '가득 채우기' 자르기
      const boxRatio = w / h;
      const imgRatio = img.width / img.height;
      let sx = 0;
      let sy = 0;
      let sw = img.width;
      let sh = img.height;
      if (imgRatio > boxRatio) {
        sw = img.height * boxRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / boxRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img.source, sx, sy, sw, sh, x, y, w, h);
      img.close();
    } else {
      ctx.fillStyle = item.refs?.dominant_color ?? "#f4f4f2";
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  return { canvas, width, height };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(tr("이미지를 만들지 못했어요.")))), type, quality)
  );
}

// JPEG 한 장을 페이지 하나에 꽉 채운 PDF (단위: pt)
export async function jpegToPdf(jpeg: Uint8Array, pageWidth: number, pageHeight: number, title: string): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("FORME");
  pdf.setProducer("FORME");
  const image = await pdf.embedJpg(jpeg);
  const page = pdf.addPage([pageWidth, pageHeight]);
  page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  return pdf.save();
}

function safeFileName(name: string) {
  return (name.trim() || "moodboard").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-").slice(0, 80);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function exportBoardPng(
  name: string,
  items: BoardItem[],
  background: string,
  onProgress?: (p: ExportProgress) => void
) {
  const { canvas } = await renderBoard(items, background, onProgress);
  download(await canvasToBlob(canvas, "image/png"), `${safeFileName(name)}.png`);
}

export async function exportBoardPdf(
  name: string,
  items: BoardItem[],
  background: string,
  onProgress?: (p: ExportProgress) => void
) {
  const { canvas, width, height } = await renderBoard(items, background, onProgress);
  const jpeg = new Uint8Array(await (await canvasToBlob(canvas, "image/jpeg", 0.92)).arrayBuffer());
  // 보드 1단위 = 1px = 0.75pt (화면 96dpi 기준) → 인쇄해도 화면과 같은 비율
  const bytes = await jpegToPdf(jpeg, width * 0.75, height * 0.75, name || "FORME moodboard");
  download(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${safeFileName(name)}.pdf`);
}
