// 업로드 전에 브라우저에서 이미지를 살펴보고 준비하는 도구
// - 가로·세로 크기
// - 그리드용 작은 썸네일 (무료 플랜은 서버에서 자동 축소가 안 돼서 직접 만듦)
// - 이미지가 뜨기 전 칸을 채울 대표색

import { tr } from "@/lib/i18n";

export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB (Storage 버킷 제한과 같음)
const THUMB_MAX_WIDTH = 900;
const THUMB_MAX_HEIGHT = 2400;

export type PreparedImage = {
  width: number;
  height: number;
  thumb: Blob | null;
  thumbExt: "webp" | "jpg" | null;
  color: string | null;
};

export function fileExtension(file: File): string {
  const byType: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };
  return byType[file.type] ?? "bin";
}

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return tr("PNG, JPG, WEBP, GIF, AVIF 이미지만 올릴 수 있어요.");
  if (file.size > MAX_FILE_BYTES) return tr("20MB보다 큰 이미지는 올릴 수 없어요.");
  return null;
}

type Drawable = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // 일부 형식은 아래 방법으로 다시 시도
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

function toHex(n: number) {
  return Math.round(n).toString(16).padStart(2, "0");
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const img = await decode(file);
  try {
    const { width, height } = img;

    // 대표색: 아주 작게 줄여서 평균 색
    let color: string | null = null;
    try {
      const c = document.createElement("canvas");
      c.width = 8;
      c.height = 8;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img.source, 0, 0, 8, 8);
        const px = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < px.length; i += 4) {
          const a = px[i + 3] / 255;
          // 투명한 부분은 흰 바탕으로 계산
          r += px[i] * a + 255 * (1 - a);
          g += px[i + 1] * a + 255 * (1 - a);
          b += px[i + 2] * a + 255 * (1 - a);
          n++;
        }
        color = `#${toHex(r / n)}${toHex(g / n)}${toHex(b / n)}`;
      }
    } catch {
      color = null;
    }

    // 썸네일: 원본이 이미 작으면 만들지 않음
    let thumb: Blob | null = null;
    let thumbExt: PreparedImage["thumbExt"] = null;
    const scale = Math.min(1, THUMB_MAX_WIDTH / width, THUMB_MAX_HEIGHT / height);
    const needsThumb = scale < 1 || file.size > 400 * 1024 || file.type === "image/gif";
    if (needsThumb && width > 0 && height > 0) {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(width * scale));
      c.height = Math.max(1, Math.round(height * scale));
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img.source, 0, 0, c.width, c.height);
        const webp = await canvasToBlob(c, "image/webp", 0.82);
        if (webp && webp.type === "image/webp") {
          thumb = webp;
          thumbExt = "webp";
        } else {
          // WEBP를 못 만드는 브라우저: 흰 바탕 JPG로
          ctx.globalCompositeOperation = "destination-over";
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, c.width, c.height);
          const jpg = await canvasToBlob(c, "image/jpeg", 0.85);
          if (jpg) {
            thumb = jpg;
            thumbExt = "jpg";
          }
        }
      }
    }

    return { width, height, thumb, thumbExt, color };
  } finally {
    img.close();
  }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "-";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
