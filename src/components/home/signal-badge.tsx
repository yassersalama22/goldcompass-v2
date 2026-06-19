import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Signal } from "@/data/recommendations";

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
}: {
  signal: Signal;
  className?: string;
}) {
  const { className: tone, Icon, label } = config[signal];
  return (
    <Badge className={cn("gap-1 text-sm font-semibold", tone, className)}>
      <Icon aria-hidden="true" />
      <span className="sr-only">{label}: </span>
      {signal}
    </Badge>
  );
}
