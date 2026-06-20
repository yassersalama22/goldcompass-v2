import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Signal } from "@/types/outlook";

const config: Record<
  Signal,
  { className: string; Icon: typeof TrendingUp; label: string }
> = {
  BUY: {
    className: "bg-bull text-bull-foreground",
    Icon: TrendingUp,
    label: "Buy signal",
  },
  SELL: {
    className: "bg-bear text-bear-foreground",
    Icon: TrendingDown,
    label: "Sell signal",
  },
  HOLD: {
    className: "bg-secondary text-secondary-foreground",
    Icon: Minus,
    label: "Hold signal",
  },
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
  const { className: tone, Icon, label } = config[signal];
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
      <span className="sr-only">{label}: </span>
      {signal}
    </Badge>
  );
}
