import { useTranslations } from "next-intl";
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
import type { ContentLang } from "@/server/i18n/availability";
import type { OutlookCall } from "@/types/outlook";

/** `content` marks the artifact text (not the chrome) when it is a fallback. */
export function OutlookCallCard({ call, content = {} }: { call: OutlookCall; content?: ContentLang }) {
  const t = useTranslations("outlook.call");
  return (
    <Card className="border-s-gold border-s-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl" {...content}>
            {call.label}
          </CardTitle>
          <SignalBadge signal={call.signal} size="lg" />
        </div>
        <CardDescription className="text-sm font-medium" {...content}>
          {call.horizon}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Conviction sits on its own row so it reads as a peer of the signal,
            not as metadata trailing the horizon. */}
        <div className="border-border flex items-center justify-between gap-3 border-y py-2.5">
          <span className="text-muted-foreground text-sm">{t("conviction")}</span>
          <ConfidenceMeter confidence={call.confidence} />
        </div>
        <p className="text-foreground/90 leading-7" {...content}>
          {call.reason}
        </p>
        {call.invalidation ? (
          <p className="text-muted-foreground flex gap-2 text-sm">
            <ShieldAlert
              className="text-gold-strong mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              <span className="font-medium">{t("invalidation")} </span>
              <span {...content}>{call.invalidation}</span>
            </span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
