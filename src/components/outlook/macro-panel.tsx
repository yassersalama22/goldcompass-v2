import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { Num } from "@/components/market/num";
import { formatMediumDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MacroIndicator, MacroSnapshot } from "@/types/macro";

/**
 * "Macro pressure" — the deterministic backdrop the analysis was written
 * against. Rendered from the snapshot stored in the published artifact, not a
 * live fetch, so these are provably the numbers the model reasoned over.
 */
function formatValue(indicator: MacroIndicator): string {
  return indicator.unit === "percent"
    ? `${indicator.value.toFixed(2)}%`
    : indicator.value.toFixed(1);
}

/**
 * The signed number and its unit, kept apart: the number goes in a bidi
 * isolate and the unit does not. Joined inside one isolate, an Arabic unit
 * (نقطة مئوية) gets laid out left-to-right with the digits and the line reads
 * scrambled.
 */
function formatChange(
  indicator: MacroIndicator,
  ppLabel: string,
): { num: string; unit: string | null } | null {
  if (indicator.change30d == null) return null;
  const sign = indicator.change30d > 0 ? "+" : "";
  // Yields move in percentage *points*; saying "%" would imply a relative move.
  return {
    num: `${sign}${indicator.change30d.toFixed(2)}`,
    unit: indicator.unit === "percent" ? ppLabel : null,
  };
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
  const t = useTranslations("outlook.macro");
  const locale = useLocale();
  if (macro.indicators.length === 0) return null;

  return (
    <section aria-labelledby="macro-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="macro-heading" className="text-2xl font-bold">
          {t("heading")}
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">
          {t("intro")}
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {macro.indicators.map((indicator) => {
          const change = formatChange(indicator, t("pp"));
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
                  {/* Daily series dated in UTC — formatMediumDate is UTC-pinned. */}
                  {t.rich("asOf", {
                    date: formatMediumDate(indicator.asOf, locale),
                    time: (chunks) => <time dateTime={indicator.asOf}>{chunks}</time>,
                  })}
                  {dir ? (
                    <>
                      {" · "}
                      <span
                        className={cn(
                          "font-medium",
                          dir === "supportive" ? "text-bull" : "text-bear",
                        )}
                      >
                        {t(dir)}
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
                      {t(rising ? "srUp" : "srDown", {
                        change: [change.num.replace("-", ""), change.unit]
                          .filter(Boolean)
                          .join(" "),
                      })}{" "}
                    </span>
                    <span aria-hidden="true">
                      <Num>{change.num}</Num>
                      {change.unit ? ` ${change.unit}` : null}
                    </span>
                    <span className="ms-0.5">{t("window")}</span>
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-muted-foreground text-xs">
        {/* `source` is the provider's attribution — passed in, never translated. */}
        {t.rich("footnote", {
          source: macro.source,
          // English attribution inside a possibly-RTL sentence: isolate it, or
          // its parentheses and semicolon reorder against the Arabic.
          attribution: (chunks) => (
            <bdi dir="ltr" lang="en">
              {chunks}
            </bdi>
          ),
        })}
      </p>
    </section>
  );
}
