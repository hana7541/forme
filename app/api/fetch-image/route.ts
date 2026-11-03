// URL로 저장: 브라우저 대신 서버가 이미지를 받아 와서 내 Storage 폴더에 바로 넣어 줌
// (다른 사이트 이미지는 브라우저에서 직접 받으면 CORS에 막히는 경우가 많기 때문)
//
// 안전장치
// - 로그인한 사용자만 (Supabase 토큰 확인), 파일은 그 사용자의 권한으로 업로드 → RLS 그대로 적용
// - http/https만, 내부망·로컬 주소 차단(리다이렉트 포함), 20MB·15초 제한
// - 웹페이지 주소면 대표 이미지(og:image)를 찾아서 저장

import { lookup } from "node:dns/promises";
import net from "node:net";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_HTML_BYTES = 1024 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 4;
const BUCKET = "refs";

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

class UserError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.status = status;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// ---------- 내부망 차단 ----------

function ipv4ToInt(ip: string) {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inRange(ip: string, cidr: string) {
  const [base, bits] = cidr.split("/");
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16",
  "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.168.0.0/16", "198.18.0.0/15",
  "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
];

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return BLOCKED_V4.some((r) => inRange(ip, r));
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    return (
      v === "::" || v === "::1" ||
      v.startsWith("fc") || v.startsWith("fd") || // 내부망
      v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || // 링크 로컬
      v.startsWith("ff") // 멀티캐스트
    );
  }
  return true;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UserError("주소 형식이 맞지 않아요.", 400);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UserError("http나 https 주소만 저장할 수 있어요.", 400);
  if (url.username || url.password) throw new UserError("아이디·비밀번호가 들어간 주소는 쓸 수 없어요.", 400);

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal"))
    throw new UserError("이 주소는 저장할 수 없어요.", 400);

  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new UserError("주소를 찾을 수 없어요. 철자를 확인해 주세요.", 422);
  if (addrs.some((a) => isBlockedIp(a.address))) throw new UserError("이 주소는 저장할 수 없어요.", 400);
  return url;
}

// ---------- 안전하게 받아 오기 ----------

async function safeFetch(start: string, accept: string): Promise<{ res: Response; finalUrl: URL }> {
  let current = await assertPublicUrl(start);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept,
        "user-agent": "Mozilla/5.0 (compatible; FORME/1.0; personal reference archive)",
      },
    }).catch((e: unknown) => {
      if (e instanceof Error && e.name === "TimeoutError") throw new UserError("상대 사이트가 너무 늦게 응답해요.", 504);
      throw new UserError("상대 사이트에 연결하지 못했어요.", 502);
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new UserError("상대 사이트가 이상한 응답을 보냈어요.", 502);
      current = await assertPublicUrl(new URL(loc, current).toString());
      continue;
    }
    if (!res.ok) throw new UserError(`상대 사이트가 거절했어요 (코드 ${res.status}).`, 502);
    return { res, finalUrl: current };
  }
  throw new UserError("다른 주소로 너무 많이 넘어가요.", 502);
}

async function readLimited(res: Response, limit: number, overLimitMessage: string): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared && declared > limit) throw new UserError(overLimitMessage, 413);
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new UserError(overLimitMessage, 413);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function mimeOf(res: Response) {
  return (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
}

// 파일 앞부분으로 실제 형식 확인 (content-type이 틀린 사이트 대비)
function sniff(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  if (b.length > 12 && String.fromCharCode(...b.slice(4, 12)).startsWith("ftypavi")) return "image/avif";
  return null;
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const k = key.replace(/[:.]/g, "\\$&");
    const a = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']+)["']`, "i").exec(html);
    if (a) return decodeEntities(a[1].trim());
    const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${k}["']`, "i").exec(html);
    if (b) return decodeEntities(b[1].trim());
  }
  return null;
}

function pageTitle(html: string): string {
  const og = metaContent(html, ["og:title", "twitter:title"]);
  if (og) return og;
  const t = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return t ? decodeEntities(t[1].replace(/\s+/g, " ").trim()) : "";
}

// ---------- 사용자 확인 + 업로드 ----------

async function currentUserId(token: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res || !res.ok) throw new UserError("다시 로그인해 주세요.", 401);
  const user = (await res.json()) as { id?: string };
  if (!user.id) throw new UserError("다시 로그인해 주세요.", 401);
  return user.id;
}

async function uploadAsUser(token: string, path: string, bytes: Uint8Array, mime: string) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
      "content-type": mime,
      "cache-control": "max-age=31536000",
      "x-upsert": "false",
    },
    body: bytes.buffer as ArrayBuffer,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new UserError(`저장소에 넣지 못했어요. ${detail.slice(0, 120)}`, 502);
  }
}

export async function POST(req: Request) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) throw new UserError("다시 로그인해 주세요.", 401);
    const userId = await currentUserId(token);

    const body = (await req.json().catch(() => ({}))) as { url?: unknown };
    const input = typeof body.url === "string" ? body.url.trim() : "";
    if (!input) throw new UserError("주소를 입력해 주세요.", 400);
    const startUrl = /^https?:\/\//i.test(input) ? input : `https://${input}`;

    // 1) 주소를 열어 봄
    const first = await safeFetch(startUrl, "image/avif,image/webp,image/*;q=0.9,text/html;q=0.8,*/*;q=0.5");
    let imageRes = first.res;
    let imageUrl = first.finalUrl;
    let title = "";
    let sourceUrl = first.finalUrl.toString();
    let mime = mimeOf(first.res);

    // 2) 웹페이지라면 대표 이미지를 찾아서 다시 받음
    if (mime === "text/html" || mime === "application/xhtml+xml") {
      const html = new TextDecoder().decode(await readLimited(first.res, MAX_HTML_BYTES, "웹페이지가 너무 커요."));
      const found = metaContent(html, ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"]);
      if (!found) throw new UserError("이 페이지에서 대표 이미지를 찾지 못했어요. 이미지 주소를 직접 넣어 주세요.", 422);
      title = pageTitle(html).slice(0, 120);
      const next = await safeFetch(new URL(found, first.finalUrl).toString(), "image/avif,image/webp,image/*;q=0.9,*/*;q=0.5");
      imageRes = next.res;
      imageUrl = next.finalUrl;
      mime = mimeOf(next.res);
    } else {
      sourceUrl = first.finalUrl.toString();
    }

    if (mime === "image/svg+xml") throw new UserError("SVG 이미지는 아직 저장할 수 없어요.", 415);

    const bytes = await readLimited(imageRes, MAX_BYTES, "20MB보다 큰 이미지는 저장할 수 없어요.");
    const realMime = sniff(bytes) ?? (IMAGE_TYPES[mime] ? mime : null);
    if (!realMime) throw new UserError("이미지가 아니거나 지원하지 않는 형식이에요.", 415);
    const ext = IMAGE_TYPES[realMime];
    const normalizedMime = realMime === "image/jpg" ? "image/jpeg" : realMime;

    // 3) 내 폴더에 원본 저장 (내 토큰으로 → Storage 잠금 규칙 그대로 적용)
    const id = crypto.randomUUID();
    const path = `${userId}/${id}.${ext}`;
    await uploadAsUser(token, path, bytes, normalizedMime);

    if (!title) {
      const last = decodeURIComponent(imageUrl.pathname.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
      title = last.replace(/[-_]+/g, " ").trim().slice(0, 120);
    }

    return json({ id, path, mime: normalizedMime, size: bytes.byteLength, title, sourceUrl });
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, e.status);
    return json({ error: "알 수 없는 문제로 저장하지 못했어요." }, 500);
  }
}
