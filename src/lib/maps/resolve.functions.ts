import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  extractUrlCandidate,
  parsePlaceFromText,
  toReviewLinks,
  type ReviewLinks,
} from "./parse";
import { fetchMapsHtml, unfurlMapsUrl } from "./unfurl.server";

export type ResolveResult =
  | { ok: true; links: ReviewLinks }
  | { ok: false; error: string };

function parseHtmlFallback(html: string, sourceUrl: string) {
  const ftid = html.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/)?.[1]
    ?? html.match(/ftid=(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/i)?.[1];
  const chij = html.match(/(?:ChIJ|GhIJ)[A-Za-z0-9_-]{16,}/)?.[0];
  if (ftid) return parsePlaceFromText(`${sourceUrl} ${ftid} ${chij ?? ""}`);
  if (chij) return parsePlaceFromText(chij);
  return null;
}

export const resolveMapsShare = createServerFn({ method: "POST" })
  .validator(z.object({ url: z.string().trim().min(1).max(4000) }))
  .handler(async ({ data }): Promise<ResolveResult> => {
    try {
      const candidate = extractUrlCandidate(data.url);
      if (!candidate) {
        return { ok: false, error: "الصق رابط مشاركة من خرائط قوقل" };
      }

      const local = parsePlaceFromText(candidate);
      if (local) return { ok: true, links: toReviewLinks(local) };

      let expanded = candidate;
      try {
        const unfurled = await unfurlMapsUrl(candidate);
        expanded = unfurled.finalUrl;
      } catch (err) {
        const message = err instanceof Error ? err.message : "تعذر فتح رابط المشاركة";
        return { ok: false, error: message };
      }

      const fromExpanded = parsePlaceFromText(expanded);
      if (fromExpanded) {
        return {
          ok: true,
          links: toReviewLinks({ ...fromExpanded, sourceUrl: expanded }),
        };
      }

      const html = await fetchMapsHtml(expanded).catch(() => "");
      const fromHtml = html ? parseHtmlFallback(html, expanded) : null;
      if (fromHtml) {
        return {
          ok: true,
          links: toReviewLinks({ ...fromHtml, sourceUrl: expanded }),
        };
      }

      return {
        ok: false,
        error: "لم نجد مكاناً في هذا الرابط. انسخ رابط المشاركة من بطاقة المكان نفسه.",
      };
    } catch {
      return { ok: false, error: "حدث خطأ غير متوقع. جرّب رابطاً آخر." };
    }
  });
