import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  LoaderCircle,
  MapPin,
  Nfc,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrMark } from "@/components/qr-mark";
import { resolveMapsShare } from "@/lib/maps/resolve.functions";
import {
  SAMPLE_FULL_URL,
  SAMPLE_SHARE_URL,
  needsUnfurl,
  parsePlaceFromText,
  toReviewLinks,
  type ReviewLinks,
} from "@/lib/maps/parse";
import { cn } from "@/lib/utils";
import { canWriteWebNfc, fitsNtag213, nfcPayloadBytes, writeUrlToNfcTag } from "@/lib/nfc";

const HISTORY_KEY = "qayyim-history-v1";

type HistoryItem = {
  name: string;
  writeReviewUrl: string;
  placeId: string;
  at: number;
};

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 6)));
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`تم نسخ ${label}`);
    return true;
  } catch {
    toast.error("تعذر النسخ");
    return false;
  }
}

export function Extractor() {
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewLinks | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [nfcWriting, setNfcWriting] = useState(false);
  const [webNfc, setWebNfc] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    setWebNfc(canWriteWebNfc());
  }, []);

  function remember(links: ReviewLinks) {
    const item: HistoryItem = {
      name: links.name ?? "مكان بدون اسم",
      writeReviewUrl: links.writeReviewUrl,
      placeId: links.placeId,
      at: Date.now(),
    };
    const next = [item, ...history.filter((h) => h.placeId !== item.placeId)].slice(0, 6);
    setHistory(next);
    saveHistory(next);
  }

  async function extract(input: string) {
    const value = input.trim();
    if (!value) {
      setError("الصق رابط المشاركة من خرائط قوقل");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const local = parsePlaceFromText(value);
      if (local && !needsUnfurl(value)) {
        const links = toReviewLinks(local);
        setResult(links);
        remember(links);
        return;
      }
      const remote = await resolveMapsShare({ data: { url: value } });
      if (!remote.ok) {
        setResult(null);
        setError(remote.error);
        return;
      }
      setResult(remote.links);
      remember(remote.links);
    } catch {
      setResult(null);
      setError("تعذر استخراج الرابط. تأكد أنه رابط خرائط قوقل.");
    } finally {
      setLoading(false);
    }
  }

  async function onCopy(value: string, key: string, label: string) {
    const ok = await copyText(value, label);
    if (ok) {
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
    }
  }

  async function onWriteNfc(url: string) {
    setNfcWriting(true);
    try {
      await writeUrlToNfcTag(url);
      toast.success("كُتب الرابط على الشريحة. لمس للتحقق.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "قرّب الشريحة ثم أعد المحاولة، أو انسخ الرابط إلى NFC Tools.";
      toast.error(message);
    } finally {
      setNfcWriting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <form
        className="rounded-[32px] bg-elevated p-5 shadow-border sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void extract(raw);
        }}
      >
        <label htmlFor="maps-url" className="mb-3 block text-sm font-medium text-fg-muted">
          رابط المشاركة
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="maps-url"
            dir="ltr"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://maps.app.goo.gl/…"
            value={raw}
            onChange={(event) => {
              setRaw(event.target.value);
              if (error) setError(null);
            }}
            className="text-left font-mono text-sm"
          />
          <Button type="submit" size="lg" className="sm:min-w-36" disabled={loading}>
            {loading ? (
              <>
                <LoaderCircle className="animate-spin" />
                جاري الاستخراج
              </>
            ) : (
              "استخراج الرابط"
            )}
          </Button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : (
          <p className="mt-3 text-sm text-fg-subtle">
            اقبل رابط المشاركة القصير أو الرابط الكامل. الناتج يُكتب على شريحة NFC.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setRaw(SAMPLE_SHARE_URL);
              void extract(SAMPLE_SHARE_URL);
            }}
          >
            مثال: رابط مشاركة
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setRaw(SAMPLE_FULL_URL);
              void extract(SAMPLE_FULL_URL);
            }}
          >
            مثال: رابط كامل
          </Button>
        </div>
      </form>

      {result ? (
        <section className="flex flex-col gap-4" aria-live="polite">
          <div className="rounded-[32px] bg-elevated p-5 shadow-border sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-wide text-fg-subtle">المكان</p>
                <h2 className="mt-1 text-lg font-semibold text-balance text-fg">
                  {result.name ?? "مكان على خرائط قوقل"}
                </h2>
              </div>
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <MapPin className="size-5" />
              </span>
            </div>

            <LinkRow
              icon={<Nfc className="size-4" />}
              label="رابط الشريحة"
              hint="اكتبه كسجل URL — اللمس يفتح نموذج التقييم"
              value={result.writeReviewUrl}
              copied={copied === "write"}
              onCopy={() => onCopy(result.writeReviewUrl, "write", "رابط الشريحة")}
              primary
            />
            <p className="mt-2 text-xs text-fg-subtle">
              {fitsNtag213(result.writeReviewUrl)
                ? `جاهز لشريحة NTAG213 وأكبر — ${nfcPayloadBytes(result.writeReviewUrl)} بايت`
                : "الرابط أطول من سعة NTAG213. استخدم NTAG215 أو 216."}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="flex-1"
                onClick={() => onCopy(result.writeReviewUrl, "write", "رابط الشريحة")}
              >
                {copied === "write" ? <Check /> : <Copy />}
                نسخ للشريحة
              </Button>
              {webNfc ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  disabled={nfcWriting}
                  onClick={() => void onWriteNfc(result.writeReviewUrl)}
                >
                  {nfcWriting ? <LoaderCircle className="animate-spin" /> : <Nfc />}
                  اكتب على الشريحة
                </Button>
              ) : null}
              <Button type="button" variant="outline" asChild>
                <a href={result.writeReviewUrl} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  تجربة الرابط
                </a>
              </Button>
            </div>
            {!webNfc ? (
              <ol className="mt-4 space-y-2 text-sm text-fg-muted">
                <li>١. انسخ رابط الشريحة أعلاه.</li>
                <li>٢. افتح تطبيق NFC Tools على الجوال.</li>
                <li>٣. أضف سجلاً من نوع URL / URI والصق الرابط.</li>
                <li>٤. اكتب على الشريحة، ثم لمسها بهاتف ثانٍ للتجربة.</li>
              </ol>
            ) : (
              <p className="mt-4 text-sm text-fg-muted">
                اضغط «اكتب على الشريحة» وقرّبها من خلف الهاتف. على الآيفون استخدم NFC Tools بعد النسخ.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-3 rounded-[28px] bg-elevated p-5 shadow-border">
              <LinkRow
                icon={<Link2 className="size-4" />}
                label="رابط مشاهدة التقييمات"
                value={result.reviewsUrl}
                copied={copied === "reviews"}
                onCopy={() => onCopy(result.reviewsUrl, "reviews", "رابط التقييمات")}
              />
              <LinkRow
                icon={<MapPin className="size-4" />}
                label="رابط المكان على الخريطة"
                value={result.mapsUrl}
                copied={copied === "maps"}
                onCopy={() => onCopy(result.mapsUrl, "maps", "رابط الخريطة")}
              />
              <LinkRow
                icon={<Copy className="size-4" />}
                label="معرّف المكان"
                value={result.placeId}
                copied={copied === "pid"}
                onCopy={() => onCopy(result.placeId, "pid", "معرّف المكان")}
                mono
              />
            </div>
            <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] bg-elevated p-5 shadow-border">
              <QrMark
                value={result.writeReviewUrl}
                className="size-40"
                label="باركود رابط التقييم"
              />
              <p className="text-center text-xs text-fg-subtle">باركود التقييم</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { n: "١", t: "استخرج الرابط", d: "من رابط المشاركة في خرائط قوقل." },
          { n: "٢", t: "انسخه للشريحة", d: "رابط التقييم القصير، مو رابط المشاركة." },
          { n: "٣", t: "اكتبه كـ URL", d: "NFC Tools → سجل رابط → اكتب ثم لمس للتجربة." },
        ].map((step) => (
          <div key={step.n} className="rounded-[24px] bg-elevated/80 px-4 py-4 shadow-border">
            <p className="font-display text-xl text-accent">{step.n}</p>
            <p className="mt-1 text-sm font-medium text-fg">{step.t}</p>
            <p className="mt-1 text-sm text-pretty text-fg-muted">{step.d}</p>
          </div>
        ))}
      </section>

      {history.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-fg-muted">آخر الاستخراجات</h2>
          <ul className="flex flex-col gap-2">
            {history.map((item) => (
              <li key={`${item.placeId}-${item.at}`}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-elevated px-4 py-3 text-right shadow-border transition-colors duration-(--motion-quick) hover:bg-surface-hover"
                  onClick={() => void onCopy(item.writeReviewUrl, item.placeId, "رابط التقييم")}
                >
                  <span className="min-w-0 truncate text-sm font-medium text-fg">{item.name}</span>
                  <Copy className="size-4 shrink-0 text-fg-subtle" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function LinkRow({
  icon,
  label,
  hint,
  value,
  copied,
  onCopy,
  primary,
  mono,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  primary?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl", primary ? "bg-accent/10 p-3" : "py-1")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-fg">
          <span className="text-accent">{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{label}</p>
            {hint ? <p className="text-xs text-fg-subtle">{hint}</p> : null}
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onCopy} aria-label={`نسخ ${label}`}>
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <p
        dir="ltr"
        className={cn(
          "mt-1 break-all text-left text-xs text-fg-muted",
          mono && "font-mono",
        )}
      >
        {value}
      </p>
    </div>
  );
}
