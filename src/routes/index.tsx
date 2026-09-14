import { createFileRoute } from "@tanstack/react-router";
import { Extractor } from "@/components/extractor";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-accent)_7%,transparent),transparent)]"
      />
      <header className="relative mx-auto mb-10 flex w-full max-w-xl flex-col items-start gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-fg">
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
              <path d="M12 2.5c-3.7 0-6.7 2.9-6.7 6.8 0 5.1 6.7 12.2 6.7 12.2s6.7-7.1 6.7-12.2c0-3.9-3-6.8-6.7-6.8zm0 9.3a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-medium text-fg-subtle">رابط تقييم لشريحة NFC</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
              قيِّم
            </h1>
          </div>
        </div>
        <p className="max-w-md text-base leading-relaxed text-fg-muted">
          الصق رابط المشاركة من خرائط قوقل، ثم انسخ رابط التقييم واكتبه على الشريحة. اللمس يفتح نموذج قوقل مباشرة.
        </p>
      </header>
      <div className="relative">
        <Extractor />
      </div>
    </main>
  );
}
