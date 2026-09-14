export function nfcPayloadBytes(url: string): number {
  return new TextEncoder().encode(url).length + 16;
}

export function fitsNtag213(url: string): boolean {
  return nfcPayloadBytes(url) <= 144;
}

export function canWriteWebNfc(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

type NdefWriter = {
  write: (message: { records: Array<{ recordType: string; data: string }> }) => Promise<void>;
};

export async function writeUrlToNfcTag(url: string): Promise<void> {
  if (!canWriteWebNfc()) {
    throw new Error("الكتابة من المتصفح على أندرويد كروم فقط. انسخ الرابط لتطبيق NFC Tools.");
  }
  const Reader = (window as unknown as { NDEFReader: new () => NdefWriter }).NDEFReader;
  const ndef = new Reader();
  await ndef.write({
    records: [{ recordType: "url", data: url }],
  });
}
