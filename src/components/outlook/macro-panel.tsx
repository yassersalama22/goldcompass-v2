import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { Num } from "@/components/market/num";
import { cn } from "@/lib/utils";
import type { MacroIndicator, MacroSnapshot } from "@/types/macro";

/**
 * "Macro pressure" — the deterministic backdrop the analysis was written
 * against. Rendered from the snapshot stored in the published artifact, not a
 * live fetch, so these are provably the numbers the model reasoned over.
 */
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC", // series are daily and dated in UTC; keeps SSR/CSR identical
});

function formatValue(indicator: MacroIndicator): string {
  return indicator.unit === "percent"
    ? `${indicator.value.toFixed(2)}%`
    : indicator.value.toFixed(1);
}

function formatChange(indicator: MacroIndicator): string | null {
  if (indicator.change30d == null) return null;
  const sign = indicator.change30d > 0 ? "+" : "";
  // Yields move in percentage *points*; saying "%" would imply a relative move.
  const suffix = indicator.unit === "percent" ? " pp" : "";
  return `${sign}${indicator.change30d.toFixed(2)}${suffix}`;
}

/**
 * Direction of pressure on gold, not direction of the indicator: a falling
 * headwind is supportive. Returns null when the move is negligible or unknown.
 */
function pressure(indicator: MacroIndicator): "supportive" | "restrictive" | null {
  if (indicator.change30d == null) return null;
  const threshold = indicator.unit === "percent" ? 0.05 : 0.25;
  if (Math.abs(indicator.change30d) < threshold) return null;
  const rising = indicator.change30d > 0;
  const isHeadwind = indicator.goldEffect === "headwind";
  return rising === isHeadwind ? "restrictive" : "supportive";
}

export function MacroPanel({ macro }: { macro: MacroSnapshot }) {
  if (macro.indicators.length === 0) return null;

  return (
    <section aria-labelledby="macro-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="macro-heading" className="text-2xl font-bold">
          Macro pressure
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">
          The backdrop this outlook was written against. A stronger dollar and higher real
          yields are headwinds for gold; rising inflation expectations are a tailwind.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {macro.indicators.map((indicator) => {
          const change = formatChange(indicator);
          const dir = pressure(indicator);
          const rising = (indicator.change30d ?? 0) > 0;
          const Icon = change == null ? ArrowRight : rising ? ArrowUp : ArrowDown;

          return (
            <li
              key={indicator.key}
              className="border-border flex items-start justify-between gap-4 rounded-xl border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{indicator.label}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  as of{" "}
                  <time dateTime={indicator.asOf}>
                    {dateFormatter.format(new Date(indicator.asOf))}
                  </time>
                  {dir ? (
                    <>
                      {" · "}
                      <span
                        className={cn(
                          "font-medium",
                          dir === "supportive" ? "text-bull" : "text-bear",
                        )}
                      >
                        {dir === "supportive" ? "supportive" : "restrictive"} for gold
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-xl font-bold tabular-nums">
                  <Num>{formatValue(indicator)}</Num>
                </p>
                {change ? (
                  <p className="text-muted-foreground flex items-center justify-end gap-0.5 text-xs whitespace-nowrap tabular-nums">
                    <Icon className="size-3" aria-hidden="true" />
                    <span className="sr-only">
                      {rising ? "up" : "down"} {change.replace("-", "")} over 30 days:{" "}
                    </span>
                    <span aria-hidden="true">
                      <Num>{change}</Num>
                    </span>
                    <span className="ms-0.5">30d</span>
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-muted-foreground text-xs">
        {macro.source}. The dollar figure is the Federal Reserve&rsquo;s trade-weighted broad
        dollar index, not the ICE &ldquo;DXY&rdquo;. Inflation breakeven is derived as the
        10-year Treasury yield minus the 10-year real yield.
      </p>
    </section>
  );
}
