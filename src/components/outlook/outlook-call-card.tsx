import { ShieldAlert } from "lucide-react";

import { ConfidenceMeter } from "@/components/market/confidence-meter";
import { SignalBadge } from "@/components/market/signal-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OutlookCall } from "@/types/outlook";

export function OutlookCallCard({ call }: { call: OutlookCall }) {
  return (
    <Card className="border-l-gold border-l-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl">{call.label}</CardTitle>
          <SignalBadge signal={call.signal} size="lg" />
        </div>
        <CardDescription className="text-sm font-medium">
          {call.horizon}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Conviction sits on its own row so it reads as a peer of the signal,
            not as metadata trailing the horizon. */}
        <div className="border-border flex items-center justify-between gap-3 border-y py-2.5">
          <span className="text-muted-foreground text-sm">Conviction</span>
          <ConfidenceMeter confidence={call.confidence} />
        </div>
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
