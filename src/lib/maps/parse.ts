const PLACE_ID_RE = /(?:ChIJ|GhIJ)[A-Za-z0-9_-]{16,}/;
const FTID_RE = /0x[0-9a-fA-F]+:0x[0-9a-fA-F]+/;

const SHORT_HOSTS = new Set([
  "maps.app.goo.gl",
  "goo.gl",
  "www.goo.gl",
  "share.google",
  "www.share.google",
  "g.page",
  "www.g.page",
]);

export type ExtractedPlace = {
  placeId: string;
  cid: string | null;
  ftid: string | null;
  name: string | null;
  lat: number | null;
  lng: number | null;
  sourceUrl: string;
};

export type ReviewLinks = ExtractedPlace & {
  writeReviewUrl: string;
  reviewsUrl: string;
  mapsUrl: string;
};

export function writeU64LE(bytes: Uint8Array, offset: number, value: bigint) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint32(offset, Number(value & 0xffffffffn), true);
  view.setUint32(offset + 4, Number((value >> 32n) & 0xffffffffn), true);
}

export function ftidToPlaceId(ftid: string): string {
  const [h1, h2] = ftid.split(":");
  if (!h1 || !h2) throw new Error("معرّف المكان غير صالح");
  const a = BigInt(h1);
  const b = BigInt(h2);
  const buf = new Uint8Array(20);
  buf[0] = 0x0a;
  buf[1] = 0x12;
  buf[2] = 0x09;
  writeU64LE(buf, 3, a);
  buf[11] = 0x11;
  writeU64LE(buf, 12, b);
  let bin = "";
  for (const byte of buf) bin += String.fromCharCode(byte);
  const b64 =
    typeof btoa === "function"
      ? btoa(bin)
      : Buffer.from(buf).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function ftidToCid(ftid: string): string {
  const h2 = ftid.split(":")[1];
  if (!h2) throw new Error("معرّف المكان غير صالح");
  return BigInt(h2).toString(10);
}

export function isShortMapsHost(host: string): boolean {
  return SHORT_HOSTS.has(host.toLowerCase());
}

export function isGoogleMapsHost(host: string): boolean {
  const h = host.toLowerCase();
  if (isShortMapsHost(h)) return true;
  if (h === "consent.google.com" || h === "www.consent.google.com") return true;
  return (
    /^(?:www\.|maps\.)?google(?:\.[a-z]{2,3}){1,2}$/.test(h) ||
    /^maps\.google(?:\.[a-z]{2,3}){1,2}$/.test(h)
  );
}

export function extractUrlCandidate(text: string): string {
  const cleaned = text.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  if (!cleaned) return "";
  if (PLACE_ID_RE.test(cleaned) && !cleaned.includes("://")) {
    const match = cleaned.match(PLACE_ID_RE);
    return match ? match[0] : cleaned;
  }
  const match = cleaned.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return cleaned;
  return match[0].replace(/[)\].,،؛]+$/g, "");
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeMapsUrl(raw: string): string {
  let current = raw.trim();
  for (let i = 0; i < 3; i++) {
    const next = safeDecode(current.replace(/\+/g, "%20"));
    if (next === current) break;
    current = next;
  }
  return current;
}

function extractFtid(haystack: string): string | null {
  const decoded = decodeMapsUrl(haystack);
  const fromQuery = decoded.match(/[?&/]ftid=(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/i);
  if (fromQuery) return fromQuery[1].toLowerCase();
  const fromData = decoded.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  if (fromData) return fromData[1].toLowerCase();
  const loose = decoded.match(FTID_RE);
  return loose ? loose[0].toLowerCase() : null;
}

function extractPlaceIdLiteral(haystack: string): string | null {
  const decoded = decodeMapsUrl(haystack);
  const fromQuery =
    decoded.match(/[?&](?:place_id|placeid)=((?:ChIJ|GhIJ)[A-Za-z0-9_-]+)/i) ??
    decoded.match(/place_id:((?:ChIJ|GhIJ)[A-Za-z0-9_-]+)/i) ??
    decoded.match(/q=place_id:((?:ChIJ|GhIJ)[A-Za-z0-9_-]+)/i);
  if (fromQuery) return fromQuery[1];
  const bare = decoded.match(PLACE_ID_RE);
  return bare ? bare[0] : null;
}

function extractName(url: string): string | null {
  const decoded = decodeMapsUrl(url);
  const fromPlace = decoded.match(/\/maps\/place\/([^/@?#]+)/i);
  if (fromPlace) {
    const name = safeDecode(fromPlace[1].replace(/\+/g, " ")).trim();
    if (name && !/^[\d.,\-\s]+$/.test(name) && !name.startsWith("data=")) {
      return name;
    }
  }
  try {
    const parsed = new URL(url);
    const q = parsed.searchParams.get("q");
    if (q && !q.startsWith("place_id:") && !/^[-.\d,\s]+$/.test(q)) {
      return q.replace(/\+/g, " ").trim();
    }
  } catch {
    /* ignore */
  }
  return null;
}

function extractCoords(url: string): { lat: number; lng: number } | null {
  const decoded = decodeMapsUrl(url);
  const at = decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  const data = decoded.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (data) return { lat: Number(data[1]), lng: Number(data[2]) };
  return null;
}

export function parsePlaceFromText(input: string): ExtractedPlace | null {
  const candidate = extractUrlCandidate(input);
  if (!candidate) return null;

  if (!candidate.includes("://") && PLACE_ID_RE.test(candidate)) {
    const placeId = candidate.match(PLACE_ID_RE)?.[0];
    if (!placeId) return null;
    return {
      placeId,
      cid: null,
      ftid: null,
      name: null,
      lat: null,
      lng: null,
      sourceUrl: candidate,
    };
  }

  const ftid = extractFtid(candidate);
  const literalId = extractPlaceIdLiteral(candidate);
  const placeId = literalId ?? (ftid ? ftidToPlaceId(ftid) : null);
  if (!placeId) return null;

  const coords = extractCoords(candidate);
  return {
    placeId,
    cid: ftid ? ftidToCid(ftid) : null,
    ftid,
    name: extractName(candidate),
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    sourceUrl: candidate,
  };
}

export function needsUnfurl(input: string): boolean {
  const candidate = extractUrlCandidate(input);
  try {
    const url = new URL(candidate);
    return isShortMapsHost(url.hostname);
  } catch {
    return false;
  }
}

export function toReviewLinks(place: ExtractedPlace): ReviewLinks {
  return {
    ...place,
    writeReviewUrl: `https://search.google.com/local/writereview?placeid=${place.placeId}`,
    reviewsUrl: `https://search.google.com/local/reviews?placeid=${place.placeId}`,
    mapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.placeId}`,
  };
}

export const SAMPLE_FULL_URL =
  "https://www.google.com/maps/place/Taj+Mahal/@27.1751448,78.0399535,17z/data=!3m1!4b1!4m6!3m5!1s0x39747121d702ff6d:0xdd2ae4803f767dde!8m2!3d27.1751448!4d78.0421422";

export const SAMPLE_SHARE_URL = "https://maps.app.goo.gl/KmVJ5wNPZ1DDcSXA6";
