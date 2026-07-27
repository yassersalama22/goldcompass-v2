"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { formatSignedPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PriceQuote } from "@/types/price";

type Status = "live" | "delayed" | "error";

const POLL_MS = 60_000;

// The server container runs UTC while the visitor's browser formats in their own
// zone, so a single formatter renders different text on each side and React bails
// out of hydrating this subtree (error #418). Render UTC for the first paint —
// which is what the server emitted — then switch to local time once mounted.
const utcTimeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
  timeZone: "UTC",
});

const localTimeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

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
        <p className="text-2xl font-bold">Price unavailable</p>
        <p className="text-muted-foreground text-sm">
          We couldn&apos;t load the live gold price. Please try again shortly.
        </p>
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
          {formatUsd(quote.price)}
        </span>
        <span className="text-muted-foreground text-sm font-medium">
          XAU/USD · per oz
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
              {up ? "Up" : "Down"} {""}
            </span>
            {formatSignedPct(change)}
            <span className="text-muted-foreground ml-1 font-normal">24h</span>
          </span>
        ) : null}

        <StatusPill status={status} />
      </div>

      <p className="text-muted-foreground text-xs">
        As of {(mounted ? localTimeFmt : utcTimeFmt).format(new Date(quote.asOf))} ·{" "}
        {quote.source}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map = {
    live: { dot: "bg-bull", label: "Live", pulse: true },
    delayed: { dot: "bg-gold", label: "Delayed", pulse: false },
    error: { dot: "bg-bear", label: "Offline", pulse: false },
  } as const;
  const { dot, label, pulse } = map[status];
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
