export const MESSAGE_TONES = [
  { id: "warm", label: "ودي" },
  { id: "visit", label: "بعد الزيارة" },
  { id: "delivery", label: "بعد التوصيل" },
  { id: "formal", label: "رسمي" },
] as const;

export type MessageToneId = (typeof MESSAGE_TONES)[number]["id"];

export function buildReviewMessage(
  tone: MessageToneId,
  name: string,
  url: string,
): string {
  const place = name.trim() || "المكان";
  switch (tone) {
    case "warm":
      return `يا هلا، نورتنا اليوم في ${place}\nلو سمحت تقيّمنا على قوقل، يفيدنا كثير\n${url}`;
    case "visit":
      return `شكرًا لزيارتك ${place}\nتقييمك على قوقل يساعدنا نتحسّن\n${url}`;
    case "delivery":
      return `وصل طلبك من ${place}، نتمنى يعجبك\nلو تقيّمنا من الرابط، نكون شاكرين\n${url}`;
    case "formal":
      return `نشكر تعاملَكم مع ${place}.\nنرجو تقييم الخدمة عبر الرابط التالي:\n${url}`;
  }
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
