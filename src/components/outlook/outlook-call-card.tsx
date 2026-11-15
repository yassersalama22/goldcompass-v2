import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, History, ShieldAlert, Zap } from "lucide-react";

import { ConfidenceMeter } from "@/components/market/confidence-meter";
import { SignalBadge } from "@/components/market/signal-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { valueTags } from "@/i18n/rich";
import { formatMediumDate, formatUsdCompact } from "@/lib/format";
import type { ContentLang } from "@/server/i18n/availability";
import type { OutlookCall } from "@/types/outlook";
import type { Driver, Levels, Signal } from "@/types/signal";

const signalKey = (signal: Signal) => signal.toLowerCase() as "buy" | "sell" | "hold";

/**
 * One call.
 *
 * Everything below the signal that comes from the rules — since-date, what it
 * replaced, why it changed, its levels — is rendered from structured fields and
 * worded by the UI catalog, so it is identical in meaning in every language and
 * a translation cannot alter a level. Only the reason and an adjustment's
 * explanation are artifact prose (`content`).
 *
 * Calls published before the scorecard carry none of those fields; they render
 * exactly as before, with the model's own invalidation sentence.
 */
export function OutlookCallCard({
  call,
  drivers = [],
  content = {},
}: {
  call: OutlookCall;
  /** The outlook's dated events — an adjustment cites them by index. */
  drivers?: Driver[];
  /** Marks the artifact text (not the chrome) when it is a fallback. */
  content?: ContentLang;
}) {
  const t = useTranslations("outlook.call");
  const tSignal = useTranslations("market.signal");
  const locale = useLocale();

  const date = (iso: string) => formatMediumDate(iso, locale);
  const signalLabel = (signal: Signal) => tSignal(`${signalKey(signal)}.label`);
  const cited = (call.adjustment?.driverIndexes ?? [])
    .map((i) => drivers[i])
    .filter((d): d is Driver => d !== undefined);
  const pinned =
    call.baseline !== undefined && call.baseline !== call.signal && !call.adjustment;

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
        {call.since ? (
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-sm">
            <History className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {t.rich("since", {
                date: date(call.since),
                time: (chunks) => <time dateTime={call.since}>{chunks}</time>,
              })}
            </span>
            {call.previous ? (
              <span>· {t("previously", { signal: signalLabel(call.previous.signal) })}</span>
            ) : null}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Conviction sits on its own row so it reads as a peer of the signal,
            not as metadata trailing the horizon. */}
        <div className="border-border flex items-center justify-between gap-3 border-y py-2.5">
          <span className="text-muted-foreground text-sm">{t("conviction")}</span>
          <ConfidenceMeter confidence={call.confidence} />
        </div>

        {call.change && call.previous ? (
          <p className="bg-muted/50 text-muted-foreground rounded-md px-3 py-2 text-sm text-pretty">
            {t(`changeReason.${call.change.reason}`)}
          </p>
        ) : null}

        <p className="text-foreground/90 leading-7" {...content}>
          {call.reason}
        </p>

        {call.adjustment && call.baseline ? (
          <div className="border-gold/40 space-y-1.5 rounded-md border px-3 py-2 text-sm">
            <p className="text-muted-foreground flex gap-2">
              <Zap className="text-gold-strong mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {t(call.adjustment.step > 0 ? "adjustedUp" : "adjustedDown", {
                  baseline: signalLabel(call.baseline),
                })}{" "}
                <span {...content}>{call.adjustment.reason}</span>
              </span>
            </p>
            {cited.length > 0 ? (
              <ul className="ms-6 space-y-1">
                {cited.map((driver) => (
                  <li key={driver.url}>
                    <a
                      href={driver.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-gold-strong underline underline-offset-4"
                      {...content}
                    >
                      {driver.title}
                    </a>{" "}
                    <span className="text-muted-foreground">
                      (<time dateTime={driver.eventDate}>{date(driver.eventDate)}</time>)
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {pinned ? (
          <p className="text-muted-foreground text-sm text-pretty">
            {t("pinned", { baseline: signalLabel(call.baseline!) })}
          </p>
        ) : null}

        {call.levels ? (
          <LevelsLine levels={call.levels} />
        ) : call.invalidation ? (
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

/**
 * The frozen levels, from numbers. Rendered instead of the model's sentence
 * when they exist: they are the levels the rules actually enforce, and a
 * catalog sentence states them identically in every language.
 */
function LevelsLine({ levels }: { levels: Levels }) {
  const t = useTranslations("outlook.call");
  const locale = useLocale();
  const money = (value: number) => formatUsdCompact(value, locale);

  const line =
    levels.below !== undefined && levels.above !== undefined
      ? t.rich("levelsBoth", { ...valueTags, below: money(levels.below), above: money(levels.above) })
      : levels.below !== undefined
        ? t.rich("levelsBelow", { ...valueTags, below: money(levels.below) })
        : t.rich("levelsAbove", { ...valueTags, above: money(levels.above!) });

  return (
    <div className="text-muted-foreground space-y-1 text-sm">
      <p className="flex gap-2">
        <ShieldAlert className="text-gold-strong mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-medium">{t("invalidation")} </span>
          {line}
        </span>
      </p>
      <p className="ms-6 flex gap-1.5 text-xs">
        <CalendarClock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        <span>
          {t.rich("levelsFixed", {
            date: formatMediumDate(levels.setOn, locale),
            time: (chunks) => <time dateTime={levels.setOn}>{chunks}</time>,
          })}
        </span>
      </p>
    </div>
  );
}
