import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { Confidence } from "@/types/outlook";

/**
 * Conviction shown with the same visual weight as the BUY/SELL signal.
 *
 * Three filled/unfilled segments carry the level *in addition* to the written
 * label, so the meaning never depends on colour alone (WCAG 1.4.1) — and the
 * segments themselves are `aria-hidden`, since the label already states the
 * level for assistive tech.
 */
const FILLED: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

const TOTAL_SEGMENTS = 3;

export function ConfidenceMeter({
  confidence,
  size = "default",
  className,
}: {
  confidence: Confidence;
  size?: "default" | "sm";
  className?: string;
}) {
  const t = useTranslations("market.confidence");
  const filled = FILLED[confidence];
  const isSmall = size === "sm";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn("flex items-end gap-0.5", isSmall ? "h-3" : "h-4")}
        aria-hidden="true"
      >
        {Array.from({ length: TOTAL_SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "rounded-[1px]",
              isSmall ? "w-1" : "w-1.5",
              // Rising bars, so the shape reads as a level even in greyscale.
              i === 0 && (isSmall ? "h-1.5" : "h-2"),
              i === 1 && (isSmall ? "h-2.5" : "h-3"),
              i === 2 && (isSmall ? "h-3" : "h-4"),
              i < filled ? "bg-gold-strong" : "bg-muted-foreground/25",
            )}
          />
        ))}
      </span>
      <span
        className={cn(
          "font-semibold tracking-tight",
          isSmall ? "text-xs" : "text-sm",
        )}
      >
        {/* One message per level ("High <muted>confidence</muted>") because
            the word order flips in Arabic (ثقة عالية). */}
        {t.rich(confidence, {
          muted: (chunks) => (
            <span className="text-muted-foreground font-normal">{chunks}</span>
          ),
        })}
      </span>
    </div>
  );
}
