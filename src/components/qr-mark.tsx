import { encode } from "uqr";
import { cn } from "@/lib/utils";

export function QrMark({
  value,
  className,
  label,
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const encoded = encode(value, { ecc: "M", border: 2 });
  const size = encoded.size;
  const modules = encoded.data;
  const cells: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y]?.[x]) cells.push(`M${x} ${y}h1v1h-1z`);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={cn("text-fg", className)}
      role="img"
      aria-label={label ?? "رمز الاستجابة السريعة"}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="var(--color-surface)" />
      <path d={cells.join("")} fill="currentColor" />
    </svg>
  );
}
