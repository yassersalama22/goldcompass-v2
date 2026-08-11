"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Num } from "@/components/market/num";
import { formatSignedPct, formatUsd } from "@/lib/format";
import {
  GOLD_PURITIES,
  WEIGHT_UNITS,
  profitLoss,
  purityFactorFor,
  type PurityKey,
  type WeightUnitKey,
} from "@/lib/calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  NumberField,
  PercentSlider,
  SelectField,
  useUrlState,
} from "@/components/calculator/tool-fields";
import {
  EmptyResults,
  InputsCard,
  ResultStat,
  ToolGrid,
} from "@/components/calculator/tool-results";

interface Props {
  /** Live spot, used to seed the exit price as "sell today". */
  initialSpot: number | null;
}

const unitOptions = WEIGHT_UNITS.map((u) => ({ key: u.key, label: u.label }));
const purityOptions = GOLD_PURITIES.map((p) => ({ key: p.key, label: p.label }));

function clampPct(raw: string | null, fallback: number, max: number): number {
  const value = parseFloat(raw ?? "");
  return !isNaN(value) && value >= 0 && value <= max ? value : fallback;
}

export function ProfitLossCalculator({ initialSpot }: Props) {
  const searchParams = useSearchParams();

  const [entry, setEntry] = useState(() => searchParams.get("entry") ?? "");
  const [exit, setExit] = useState(
    () => searchParams.get("exit") ?? (initialSpot != null ? initialSpot.toFixed(2) : "")
  );
  const [quantity, setQuantity] = useState(() => searchParams.get("qty") ?? "");
  const [unit, setUnit] = useState<WeightUnitKey>(() => {
    const u = searchParams.get("unit") as WeightUnitKey | null;
    return u && WEIGHT_UNITS.some((x) => x.key === u) ? u : "ozt";
  });
  const [karat, setKarat] = useState<PurityKey>(() => {
    const k = searchParams.get("karat") as PurityKey | null;
    return k && GOLD_PURITIES.some((x) => x.key === k) ? k : "24K";
  });
  const [premiumPct, setPremiumPct] = useState(() =>
    clampPct(searchParams.get("premium"), 5, 20)
  );
  const [sellFeePct, setSellFeePct] = useState(() =>
    clampPct(searchParams.get("sellfee"), 2, 20)
  );

  useUrlState({
    entry,
    exit,
    qty: quantity,
    unit: unit === "ozt" ? "" : unit,
    karat: karat === "24K" ? "" : karat,
    premium: premiumPct === 5 ? "" : String(premiumPct),
    sellfee: sellFeePct === 2 ? "" : String(sellFeePct),
  });

  const result = profitLoss({
    entrySpot: parseFloat(entry),
    exitSpot: parseFloat(exit),
    quantity: parseFloat(quantity),
    unit,
    purityFactor: purityFactorFor(karat),
    premiumPct,
    sellFeePct,
  });

  const isProfit = result != null && result.pnlUsd > 0;
  const isLoss = result != null && result.pnlUsd < 0;

  return (
    <ToolGrid>
      <InputsCard title="Your trade">
        <NumberField
          label="Gold price when you bought"
          value={entry}
          onChange={setEntry}
          prefix="$"
          min="1"
          step="1"
          placeholder="3,800"
        />
        <NumberField
          label="Gold price when you sell"
          value={exit}
          onChange={setExit}
          prefix="$"
          min="1"
          step="1"
          placeholder="4,200"
          hint={
            initialSpot != null
              ? `Pre-filled with today's spot price, ${formatUsd(initialSpot)}. Change it to test a target.`
              : undefined
          }
        />
        <NumberField
          label="Quantity"
          value={quantity}
          onChange={setQuantity}
          min="0"
          step="0.1"
          placeholder="2"
        />
        <SelectField label="Quantity unit" value={unit} onChange={setUnit} options={unitOptions} />
        <SelectField label="Purity" value={karat} onChange={setKarat} options={purityOptions} />
        <PercentSlider
          label="Premium paid on purchase"
          value={premiumPct}
          onChange={setPremiumPct}
          max={20}
        />
        <PercentSlider
          label="Sell-side spread"
          value={sellFeePct}
          onChange={setSellFeePct}
          max={20}
        />
      </InputsCard>

      <div aria-live="polite" aria-label="Profit and loss results">
        {!result ? (
          <EmptyResults message="Enter your buy price, sell price, and quantity to see the result." />
        ) : (
          <div className="space-y-4">
            <ResultStat
              label={isLoss ? "Net loss" : "Net profit"}
              tone={isProfit ? "bull" : isLoss ? "bear" : "default"}
              value={`${result.pnlUsd >= 0 ? "+" : ""}${formatUsd(result.pnlUsd)}`}
              sub={
                <span className="flex items-center gap-1.5">
                  {isProfit ? (
                    <TrendingUp className="text-bull size-4" aria-hidden="true" />
                  ) : isLoss ? (
                    <TrendingDown className="text-bear size-4" aria-hidden="true" />
                  ) : null}
                  <strong className="text-foreground">
                    <Num>{formatSignedPct(result.pnlPct, 1)}</Num>
                  </strong>{" "}
                  return on a {formatUsd(result.costBasis)} outlay.
                </span>
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <ResultStat
                label="Total cost"
                value={formatUsd(result.costBasis)}
                sub={`${result.pureTroyOz.toFixed(4)} troy oz of pure gold, including the ${premiumPct.toFixed(1)}% premium.`}
              />
              <ResultStat
                label="Sale proceeds"
                value={formatUsd(result.proceeds)}
                sub={`After a ${sellFeePct.toFixed(1)}% sell-side spread.`}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm font-normal">
                  Why the result differs from the price move
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-border divide-y text-sm">
                  <div className="flex items-baseline justify-between gap-4 pb-2">
                    <dt className="text-muted-foreground">Gold price move</dt>
                    <dd className="font-semibold tabular-nums">
                      <Num>{formatSignedPct(result.spotMovePct, 1)}</Num>
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">Break-even price</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatUsd(result.breakEvenSpot)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 pt-2">
                    <dt className="text-muted-foreground">Your actual return</dt>
                    <dd className="font-semibold tabular-nums">
                      <Num>{formatSignedPct(result.pnlPct, 1)}</Num>
                    </dd>
                  </div>
                </dl>
                <p className="text-muted-foreground mt-3 text-xs">
                  The gap between the two percentages is the cost of buying and selling. Gold had
                  to reach {formatUsd(result.breakEvenSpot)} just to return your money — everything
                  above that is profit.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ToolGrid>
  );
}
