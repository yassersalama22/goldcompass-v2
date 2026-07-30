"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatUsd } from "@/lib/format";
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
  { pct: 2, label: "Large bars (1 kg+)" },
  { pct: 4, label: "Small bars (1 oz)" },
  { pct: 6, label: "Bullion coins" },
  { pct: 10, label: "Collectible coins" },
  { pct: 15, label: "Jewellery" },
];

function clampPct(raw: string | null, fallback: number, max: number): number {
  const value = parseFloat(raw ?? "");
  return !isNaN(value) && value >= 0 && value <= max ? value : fallback;
}

export function BreakEvenCalculator({ initialSpot, isStale }: Props) {
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
      <InputsCard title="Purchase terms">
        <SpotField
          value={spotState.spot}
          onChange={spotState.setSpot}
          overridden={spotState.overridden}
          onReset={spotState.reset}
          initialSpot={initialSpot}
          isStale={isStale}
          label="Spot price when you buy"
        />
        <PercentSlider
          label="Dealer premium"
          value={premiumPct}
          onChange={setPremiumPct}
          max={20}
          hint="What you pay over spot. Bars/coins: 3–8% · Jewellery: 10–15%"
        />
        <PercentSlider
          label="Sell-side spread"
          value={sellFeePct}
          onChange={setSellFeePct}
          max={20}
          hint="What a buy-back costs you. Set to 0 to see the spot-only break-even."
        />
      </InputsCard>

      <div aria-live="polite" aria-label="Break-even results">
        {!result ? (
          <EmptyResults message="Enter the spot price you paid to see the price gold has to reach." />
        ) : (
          <div className="space-y-4">
            <ResultStat
              label="Break-even gold price"
              value={formatUsd(result.breakEvenSpot)}
              sub={
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="text-bull size-4" aria-hidden="true" />
                  Gold must rise{" "}
                  <strong className="text-foreground">
                    +{result.requiredRisePct.toFixed(1)}%
                  </strong>{" "}
                  from {formatUsd(spotNum)} before you are back to even.
                </span>
              }
            />

            <ResultStat
              label="Your effective cost per troy ounce of pure gold"
              value={formatUsd(result.costPerPureTroyOz)}
              sub={`Spot ${formatUsd(spotNum)} plus a ${premiumPct.toFixed(1)}% premium. This is your real entry price, whatever karat you bought.`}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm font-normal">
                  Break-even by product type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="-mx-1 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b text-xs">
                        <th scope="col" className="pr-3 pb-2 text-left font-medium">
                          Typical product
                        </th>
                        <th scope="col" className="pr-3 pb-2 text-right font-medium">
                          Premium
                        </th>
                        <th scope="col" className="pr-3 pb-2 text-right font-medium">
                          Break-even price
                        </th>
                        <th scope="col" className="pb-2 text-right font-medium">
                          Required rise
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
                            <th scope="row" className="py-2 pr-3 text-left font-medium">
                              {benchmark.label}
                            </th>
                            <td className="text-muted-foreground py-2 pr-3 text-right tabular-nums">
                              {benchmark.pct}%
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {formatUsd(row.breakEvenSpot)}
                            </td>
                            <td className="py-2 text-right font-semibold tabular-nums">
                              +{row.requiredRisePct.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-muted-foreground mt-3 text-xs">
                  All rows assume the same {sellFeePct.toFixed(1)}% sell-side spread. Premiums vary
                  by dealer, product, and order size — treat these as illustrative ranges.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ToolGrid>
  );
}
