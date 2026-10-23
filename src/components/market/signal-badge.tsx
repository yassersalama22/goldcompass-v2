import { useTranslations } from "next-intl";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Signal } from "@/types/outlook";

/**
 * Tone and icon per signal. The visible word and the screen-reader label come
 * from `market.signal.<buy|sell|hold>` — the enum itself is the API contract
 * and never shown translated, so `signal` stays "BUY" in data while an Arabic
 * reader sees شراء.
 */
const config: Record<Signal, { className: string; Icon: typeof TrendingUp }> = {
  BUY: { className: "bg-bull text-bull-foreground", Icon: TrendingUp },
  SELL: { className: "bg-bear text-bear-foreground", Icon: TrendingDown },
  HOLD: { className: "bg-secondary text-secondary-foreground", Icon: Minus },
};

export function SignalBadge({
  signal,
  className,
  size = "default",
}: {
  signal: Signal;
  className?: string;
  size?: "default" | "lg";
}) {
  const t = useTranslations("market.signal");
  const { className: tone, Icon } = config[signal];
  const key = signal.toLowerCase() as "buy" | "sell" | "hold";
  return (
    <Badge
      className={cn(
        "gap-1 font-semibold",
        size === "lg" ? "h-7 px-3 text-sm" : "text-sm",
        tone,
        className,
      )}
    >
      <Icon aria-hidden="true" />
      <span className="sr-only">{t(`${key}.sr`)}: </span>
      {t(`${key}.label`)}
    </Badge>
  );
}
