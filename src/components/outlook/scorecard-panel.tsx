import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Minus } from "lucide-react";

import { Num } from "@/components/market/num";
import { richTags } from "@/i18n/rich";
import { cn } from "@/lib/utils";
import type { OutlookCall, OutlookScorecard } from "@/types/outlook";
import type { Factor, Horizon, Scorecard, Signal } from "@/types/signal";

/**
 * The scorecard each call's baseline was computed from.
 *
 * This is the panel that makes a call checkable: the reader sees every factor,
 * what was measured and how it was read, and can add the readings up to the
 * baseline themselves. It renders from the snapshot stored in the artifact —
 * the same numbers the pipeline used, not a recomputation.
 *
 * Factor labels come from the catalog by key, so the artifact carries nothing
 * here that needs translating and the wording cannot drift between languages.
 * Each reading is a word and an arrow as well as a colour (WCAG 1.4.1).
 */
const READING: Record<number, { key: string; Icon: typeof ArrowUp; tone: string }> = {
  2: { key: "strongSupport", Icon: ChevronsUp, tone: "text-bull" },
  1: { key: "support", Icon: ArrowUp, tone: "text-bull" },
  0: { key: "neutral", Icon: Minus, tone: "text-muted-foreground" },
  [-1]: { key: "adverse", Icon: ArrowDown, tone: "text-bear" },
  [-2]: { key: "strongAdverse", Icon: ChevronsDown, tone: "text-bear" },
};

const signalKey = (signal: Signal) => signal.toLowerCase() as "buy" | "sell" | "hold";

/** "+1.23" — signed, except that zero is plain "0.00". */
function signed(value: number): string {
  const text = value.toFixed(2);
  return Number(text) === 0 ? text.replace("-", "") : `${value > 0 ? "+" : ""}${text}`;
}

export function ScorecardPanel({
  scorecard,
  calls,
}: {
  scorecard: OutlookScorecard;
  calls: OutlookCall[];
}) {
  const t = useTranslations("outlook.scorecard");
  const tMacro = useTranslations("outlook.macro");
  const tSignal = useTranslations("market.signal");

  const measuredText = (factor: Factor) =>
    factor.value == null
      ? null
      : factor.unit === "pp"
        ? `${signed(factor.value)} ${tMacro("pp")}`
        : `${signed(factor.value)}%`;

  const table = (horizon: Horizon, card: Scorecard) => {
    const baseline = calls.find((c) => c.term === horizon)?.baseline;
    return (
      <div key={horizon} className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <caption className="bg-muted/40 border-b px-4 py-2.5 text-start font-semibold">
            {t(horizon)}
          </caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">{t("factorColumn")}</th>
              <th scope="col">{t("measuredColumn")}</th>
              <th scope="col">{t("readingColumn")}</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {card.factors.map((factor) => {
              const reading = READING[factor.reading] ?? READING[0]!;
              const measured = measuredText(factor);
              return (
                <tr key={factor.key}>
                  <th scope="row" className="px-4 py-2 text-start font-normal">
                    {t(`factors.${factor.key}`)}
                  </th>
                  <td className="text-muted-foreground px-2 py-2 text-end whitespace-nowrap">
                    {measured ? <Num>{measured}</Num> : t("notMeasured")}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2 text-end whitespace-nowrap",
                      factor.value == null ? "text-muted-foreground" : reading.tone,
                    )}
                  >
                    {factor.value == null ? (
                      "—"
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <reading.Icon className="size-3.5 shrink-0" aria-hidden="true" />
                        {t(`reading.${reading.key}`)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t">
            <tr>
              <th scope="row" className="px-4 py-2.5 text-start font-semibold">
                {t("total")}
              </th>
              <td className="px-2 py-2.5 text-end font-semibold">
                <Num>{card.score > 0 ? `+${card.score}` : String(card.score)}</Num>
              </td>
              <td className="px-4 py-2.5 text-end font-medium whitespace-nowrap">
                {baseline ? t("baseline", { signal: tSignal(`${signalKey(baseline)}.label`) }) : null}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  return (
    <section aria-labelledby="scorecard-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="scorecard-heading" className="text-2xl font-bold">
          {t("heading")}
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">{t.rich("intro", richTags)}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {table("short", scorecard.short)}
        {table("long", scorecard.long)}
      </div>
      <div className="text-muted-foreground space-y-1 text-xs text-pretty">
        <p>{t("stretchNote")}</p>
        <p className="font-medium">{t("notForecast")}</p>
      </div>
    </section>
  );
}
