import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isGoogleMapsHost } from "./parse";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const MAX_HOPS = 8;
const TIMEOUT_MS = 10000;

function isPrivateAddress(address: string): boolean {
  if (address === "127.0.0.1" || address === "::1" || address === "0.0.0.0") {
    return true;
  }
  if (address.startsWith("10.") || address.startsWith("192.168.") || address.startsWith("169.254.")) {
    return true;
  }
  const m = address.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  const lower = address.toLowerCase();
  return lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("الرابط غير صالح");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("يُسمح فقط بروابط خرائط قوقل");
  }
  if (url.username || url.password) {
    throw new Error("الرابط غير صالح");
  }
  const host = url.hostname;
  if (isIP(host) && isPrivateAddress(host)) {
    throw new Error("يُسمح فقط بروابط خرائط قوقل");
  }
  if (!isGoogleMapsHost(host) && host !== "consent.google.com") {
    throw new Error("يُسمح فقط بروابط خرائط قوقل");
  }
  const records = await lookup(host, { all: true });
  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw new Error("يُسمح فقط بروابط خرائط قوقل");
    }
  }
  return url;
}

function unwrapIntent(location: string): string | null {
  if (!location.startsWith("intent:")) return null;
  const match = location.match(/S\.browser_fallback_url=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function unwrapConsent(url: URL): string | null {
  if (!url.hostname.includes("consent.google.")) return null;
  const cont = url.searchParams.get("continue");
  return cont;
}

function unwrapGoogleUrl(url: URL): string | null {
  if (url.pathname === "/url" || url.pathname.endsWith("/url")) {
    return url.searchParams.get("q") ?? url.searchParams.get("url");
  }
  return null;
}

function resolveLocation(current: string, location: string): string {
  const intent = unwrapIntent(location);
  if (intent) return intent;
  return new URL(location, current).toString();
}

export async function unfurlMapsUrl(input: string): Promise<{ finalUrl: string; hops: string[] }> {
  let current = input;
  const hops = [current];

  for (let i = 0; i < MAX_HOPS; i++) {
    const url = await assertSafeUrl(current);

    const consent = unwrapConsent(url);
    if (consent) {
      current = consent;
      hops.push(current);
      continue;
    }
    const wrapped = unwrapGoogleUrl(url);
    if (wrapped) {
      current = wrapped;
      hops.push(current);
      continue;
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": DESKTOP_UA,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const location = res.headers.get("location");
    await res.body?.cancel().catch(() => undefined);

    if (location && res.status >= 300 && res.status < 400) {
      current = resolveLocation(current, location);
      hops.push(current);
      continue;
    }

    return { finalUrl: current, hops };
  }

  throw new Error("تعذر فتح رابط المشاركة");
}

export async function fetchMapsHtml(url: string): Promise<string> {
  await assertSafeUrl(url);
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": DESKTOP_UA,
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return "";
  const text = await res.text();
  return text.slice(0, 400_000);
}
