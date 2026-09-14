import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MESSAGE_TONES,
  buildReviewMessage,
  whatsappShareUrl,
  type MessageToneId,
} from "@/lib/messages";
import { cn } from "@/lib/utils";

export function MessageTemplates({
  name,
  url,
  copied,
  onCopy,
}: {
  name: string;
  url: string;
  copied: boolean;
  onCopy: (text: string) => void;
}) {
  const [tone, setTone] = useState<MessageToneId>("warm");
  const text = buildReviewMessage(tone, name, url);
  const wa = whatsappShareUrl(text);

  return (
    <div className="rounded-[32px] bg-elevated p-5 shadow-border sm:p-6">
      <div className="mb-4">
        <p className="text-xs font-medium tracking-wide text-fg-subtle">رسائل جاهزة</p>
        <h2 className="mt-1 text-lg font-semibold text-fg">أرسل رابط التقييم</h2>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="نبرة الرسالة">
        {MESSAGE_TONES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tone === item.id}
            className={cn(
              "h-9 rounded-full px-3 text-sm font-medium transition-colors duration-(--motion-quick)",
              tone === item.id
                ? "bg-accent text-accent-fg"
                : "bg-surface text-fg shadow-border hover:bg-surface-hover",
            )}
            onClick={() => setTone(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-accent/10 p-4 text-sm leading-relaxed text-fg">
        {text}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="flex-1" asChild>
          <a href={wa} target="_blank" rel="noreferrer">
            <MessageCircle />
            واتساب
          </a>
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => onCopy(text)}
        >
          {copied ? <Check /> : <Copy />}
          نسخ الرسالة
        </Button>
      </div>
    </div>
  );
}
