"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Num } from "@/components/market/num";
import { useFormat } from "@/lib/use-format";
import { breakEven } from "@/lib/calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PercentSlider,
  SpotField,
  useSpotState,
  useUrlState,
} from "@/components/calculator/tool-fields";
import {
  EmptyResults,
  InputsCard,
  ResultStat,
  ToolGrid,
} from "@/components/calculator/tool-results";

interface Props {
  initialSpot: number | null;
  isStale: boolean;
}

/** Typical premiums, so the table shows how product choice moves break-even. */
const PREMIUM_BENCHMARKS = [
  { pct: 2, key: "largeBars" },
  { pct: 4, key: "smallBars" },
  { pct: 6, key: "bullionCoins" },
  { pct: 10, key: "collectibleCoins" },
  { pct: 15, key: "jewellery" },
] as const;

function clampPct(raw: string | null, fallback: number, max: number): number {
  const value = parseFloat(raw ?? "");
  return !isNaN(value) && value >= 0 && value <= max ? value : fallback;
}

export function BreakEvenCalculator({ initialSpot, isStale }: Props) {
  const fmt = useFormat();
  const t = useTranslations("calc.breakEven");
  const searchParams = useSearchParams();
  const spotState = useSpotState(initialSpot);

  const [premiumPct, setPremiumPct] = useState(() =>
    clampPct(searchParams.get("premium"), 5, 20)
  );
  const [sellFeePct, setSellFeePct] = useState(() =>
    clampPct(searchParams.get("sellfee"), 2, 20)
  );

  useUrlState({
    premium: premiumPct === 5 ? "" : String(premiumPct),
    sellfee: sellFeePct === 2 ? "" : String(sellFeePct),
    spot: spotState.urlValue,
  });

  const spotNum = parseFloat(spotState.spot);
  const result = breakEven({ spotUsd: spotNum, premiumPct, sellFeePct });

  return (
    <ToolGrid>
      <InputsCard title={t("inputsTitle")}>
        <SpotField
          value={spotState.spot}
          onChange={spotState.setSpot}
          overridden={spotState.overridden}
          onReset={spotState.reset}
          initialSpot={initialSpot}
          isStale={isStale}
          label={t("spotLabel")}
        />
        <PercentSlider
          label={t("premium")}
          value={premiumPct}
          onChange={setPremiumPct}
          max={20}
          hint={t("premiumHint")}
        />
        <PercentSlider
          label={t("sellFee")}
          value={sellFeePct}
          onChange={setSellFeePct}
          max={20}
          hint={t("sellFeeHint")}
        />
      </InputsCard>

      <div aria-live="polite" aria-label={t("resultsLabel")}>
        {!result ? (
          <EmptyResults message={t("empty")} />
        ) : (
          <div className="space-y-4">
            <ResultStat
              label={t("breakEven")}
              value={fmt.usd(result.breakEvenSpot)}
              sub={
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="text-bull size-4" aria-hidden="true" />
                  <span>
                    {t.rich("mustRise", {
                      rise: `+${result.requiredRisePct.toFixed(1)}%`,
                      spot: fmt.usd(spotNum),
                      strong: (chunks) => (
                        <strong className="text-foreground">
                          <Num>{chunks}</Num>
                        </strong>
                      ),
                    })}
                  </span>
                </span>
              }
            />

            <ResultStat
              label={t("costLabel")}
              value={fmt.usd(result.costPerPureTroyOz)}
              sub={t("costSub", { spot: fmt.usd(spotNum), premium: premiumPct.toFixed(1) })}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm font-normal">
                  {t("tableTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="-mx-1 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b text-xs">
                        <th scope="col" className="pe-3 pb-2 text-start font-medium">
                          {t("colProduct")}
                        </th>
                        <th scope="col" className="pe-3 pb-2 text-end font-medium">
                          {t("colPremium")}
                        </th>
                        <th scope="col" className="pe-3 pb-2 text-end font-medium">
                          {t("colBreakEven")}
                        </th>
                        <th scope="col" className="pb-2 text-end font-medium">
                          {t("colRise")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {PREMIUM_BENCHMARKS.map((benchmark) => {
                        const row = breakEven({
                          spotUsd: spotNum,
                          premiumPct: benchmark.pct,
                          sellFeePct,
                        });
                        if (!row) return null;
                        return (
                          <tr
                            key={benchmark.pct}
                            className={cn(
                              "border-border/50 border-b last:border-0",
                              benchmark.pct === premiumPct && "bg-muted/50 font-medium"
                            )}
                          >
                            <th scope="row" className="py-2 pe-3 text-start font-medium">
                              {t(`products.${benchmark.key}`)}
                            </th>
                            <td className="text-muted-foreground py-2 pe-3 text-end tabular-nums">
                              {benchmark.pct}%
                            </td>
                            <td className="py-2 pe-3 text-end tabular-nums">
                              {fmt.usd(row.breakEvenSpot)}
                            </td>
                            <td className="py-2 text-end font-semibold tabular-nums">
                              <Num>{`+${row.requiredRisePct.toFixed(1)}%`}</Num>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-muted-foreground mt-3 text-xs">
                  {t("tableNote", { sellFee: sellFeePct.toFixed(1) })}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ToolGrid>
  );
}
