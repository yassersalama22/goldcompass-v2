"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Num } from "@/components/market/num";
import { requireLocale } from "@/config/locales";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import type { PriceQuote } from "@/types/price";

type Status = "live" | "delayed" | "error";

const POLL_MS = 60_000;

// The server container runs UTC while the visitor's browser formats in their own
// zone, so a single formatter renders different text on each side and React bails
// out of hydrating this subtree (error #418). Render UTC for the first paint —
// which is what the server emitted — then switch to local time once mounted.
//
// Built from the registry's `intlLocale` (e.g. `ar-u-nu-latn`), never the bare
// route locale, so Arabic keeps Latin digits like the rest of the site.
function timeFormatters(intlLocale: string) {
  const opts = { hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const;
  return {
    utc: new Intl.DateTimeFormat(intlLocale, { ...opts, timeZone: "UTC" }),
    local: new Intl.DateTimeFormat(intlLocale, opts),
  };
}

// The "external store" here never changes; only the server/client snapshot split
// matters, which is what makes this hydration-safe without a setState effect.
const subscribeNoop = () => () => {};

export function PriceTicker({
  initialQuote,
  initialStale,
}: {
  initialQuote: PriceQuote | null;
  initialStale: boolean;
}) {
  const fmt = useFormat();
  const t = useTranslations("trends.ticker");
  const locale = useLocale();
  const timeFmt = React.useMemo(() => timeFormatters(requireLocale(locale).intlLocale), [locale]);
  const [quote, setQuote] = React.useState<PriceQuote | null>(initialQuote);
  const [status, setStatus] = React.useState<Status>(
    initialQuote ? (initialStale ? "delayed" : "live") : "error",
  );
  // false during SSR and the hydrating render, true afterwards.
  const mounted = React.useSyncExternalStore(subscribeNoop, () => true, () => false);

  React.useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/v1/price", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        const next: PriceQuote | null = json?.data?.quote ?? null;
        if (cancelled) return;
        if (next) {
          setQuote(next);
          setStatus(json?.meta?.stale ? "delayed" : "live");
        } else {
          setStatus("error");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    // Refresh once on mount (covers the case where SSR shipped fallback data),
    // then poll while the tab is visible.
    refresh();
    const id = setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!quote) {
    return (
      <div className="space-y-1">
        <p className="text-2xl font-bold">{t("unavailable")}</p>
        <p className="text-muted-foreground text-sm">{t("unavailableBody")}</p>
      </div>
    );
  }

  const change = quote.changePct24h;
  const up = change != null && change >= 0;
  const ChangeIcon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className="text-4xl font-bold tabular-nums sm:text-5xl"
          aria-live="polite"
        >
          <Num>{fmt.usd(quote.price)}</Num>
        </span>
        <span className="text-muted-foreground text-sm font-medium">
          {t("unit")}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {change != null ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium tabular-nums",
              up ? "text-bull" : "text-bear",
            )}
          >
            <ChangeIcon className="size-4" aria-hidden="true" />
            <span className="sr-only">
              {t(up ? "up" : "down")} {""}
            </span>
            <Num>{fmt.signedPct(change)}</Num>
            <span className="text-muted-foreground ms-1 font-normal">{t("window")}</span>
          </span>
        ) : null}

        <StatusPill status={status} />
      </div>

      <p className="text-muted-foreground text-xs">
        {t.rich("asOf", {
          time: (mounted ? timeFmt.local : timeFmt.utc).format(new Date(quote.asOf)),
          source: quote.source,
          // Provider attribution is English; isolate it inside an RTL sentence.
          attribution: (chunks) => (
            <bdi dir="ltr" lang="en">
              {chunks}
            </bdi>
          ),
        })}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const t = useTranslations("trends.ticker.status");
  const map = {
    live: { dot: "bg-bull", pulse: true },
    delayed: { dot: "bg-gold", pulse: false },
    error: { dot: "bg-bear", pulse: false },
  } as const;
  const { dot, pulse } = map[status];
  const label = t(status);
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="relative flex size-2">
        {pulse ? (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-75 motion-reduce:animate-none",
              dot,
            )}
          />
        ) : null}
        <span className={cn("relative inline-flex size-2 rounded-full", dot)} />
      </span>
      {label}
    </span>
  );
}
