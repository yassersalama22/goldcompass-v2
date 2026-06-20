import { ShieldAlert } from "lucide-react";

import { SignalBadge } from "@/components/market/signal-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OutlookCall } from "@/types/outlook";

const confidenceLabel: Record<OutlookCall["confidence"], string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

export function OutlookCallCard({ call }: { call: OutlookCall }) {
  return (
    <Card className="border-l-gold border-l-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl">{call.label}</CardTitle>
          <SignalBadge signal={call.signal} size="lg" />
        </div>
        <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
          <span>{call.horizon}</span>
          <span aria-hidden="true">·</span>
          <span>{confidenceLabel[call.confidence]}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-foreground/90 leading-7">{call.reason}</p>
        {call.invalidation ? (
          <p className="text-muted-foreground flex gap-2 text-sm">
            <ShieldAlert
              className="text-gold-strong mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              <span className="font-medium">What would change our view: </span>
              {call.invalidation}
            </span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
