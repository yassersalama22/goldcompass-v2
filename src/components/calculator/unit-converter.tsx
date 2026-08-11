"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { useFormat } from "@/lib/use-format";
import {
  GOLD_PURITIES,
  TROY_OZ_TO_GRAMS,
  WEIGHT_UNITS,
  fromGrams,
  purityFactorFor,
  toGrams,
  type PurityKey,
  type WeightUnitKey,
} from "@/lib/calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  NumberField,
  SelectField,
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

const unitOptions = WEIGHT_UNITS.map((u) => ({ key: u.key, label: u.label }));
const purityOptions = GOLD_PURITIES.map((p) => ({ key: p.key, label: p.label }));

/** Enough precision that a gram doesn't round to zero when shown in kilograms. */
function formatQty(value: number): string {
  if (value === 0) return "0";
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(4);
  return value.toPrecision(4);
}

export function UnitConverter({ initialSpot, isStale }: Props) {
  const fmt = useFormat();
  const searchParams = useSearchParams();
  const spotState = useSpotState(initialSpot);

  const [amount, setAmount] = useState(() => searchParams.get("amount") ?? "1");
  const [unit, setUnit] = useState<WeightUnitKey>(() => {
    const u = searchParams.get("unit") as WeightUnitKey | null;
    return u && WEIGHT_UNITS.some((x) => x.key === u) ? u : "ozt";
  });
  const [karat, setKarat] = useState<PurityKey>(() => {
    const k = searchParams.get("karat") as PurityKey | null;
    return k && GOLD_PURITIES.some((x) => x.key === k) ? k : "24K";
  });

  useUrlState({
    amount: amount === "1" ? "" : amount,
    unit: unit === "ozt" ? "" : unit,
    karat: karat === "24K" ? "" : karat,
    spot: spotState.urlValue,
  });

  const amountNum = parseFloat(amount);
  const valid = Number.isFinite(amountNum) && amountNum > 0;
  const grams = valid ? toGrams(amountNum, unit) : 0;

  const factor = purityFactorFor(karat);
  const spotNum = parseFloat(spotState.spot);
  const hasSpot = Number.isFinite(spotNum) && spotNum > 0;
  // Value follows the *pure* gold content, so a gram of 14K is worth 58.3% of a gram of 24K.
  const valuePerGram = hasSpot ? (spotNum / TROY_OZ_TO_GRAMS) * factor : 0;

  const sourceUnit = WEIGHT_UNITS.find((u) => u.key === unit);

  return (
    <ToolGrid>
      <InputsCard title="Convert">
        <NumberField
          label="Amount"
          value={amount}
          onChange={setAmount}
          min="0"
          step="0.1"
          placeholder="1"
        />
        <SelectField label="From unit" value={unit} onChange={setUnit} options={unitOptions} />
        <SelectField
          label="Purity (for valuation)"
          value={karat}
          onChange={setKarat}
          options={purityOptions}
          hint="Purity does not change the weight conversion — only the dollar value."
        />
        <SpotField
          value={spotState.spot}
          onChange={spotState.setSpot}
          overridden={spotState.overridden}
          onReset={spotState.reset}
          initialSpot={initialSpot}
          isStale={isStale}
        />
      </InputsCard>

      <div aria-live="polite" aria-label="Conversion results">
        {!valid ? (
          <EmptyResults message="Enter an amount to convert it into every other gold weight unit." />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <ResultStat
                label="In grams"
                value={`${formatQty(grams)} g`}
                sub={`${formatQty(amountNum)} ${sourceUnit?.short} of ${karat} gold`}
              />
              <ResultStat
                label="In troy ounces"
                value={`${formatQty(fromGrams(grams, "ozt"))} ozt`}
                sub={hasSpot ? `Worth ${fmt.usd(grams * valuePerGram)} at ${karat}` : undefined}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm font-normal">
                  All units
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="-mx-1 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b text-xs">
                        <th scope="col" className="pe-3 pb-2 text-start font-medium">
                          Unit
                        </th>
                        <th scope="col" className="pe-3 pb-2 text-end font-medium">
                          Grams each
                        </th>
                        <th scope="col" className="pe-3 pb-2 text-end font-medium">
                          Amount
                        </th>
                        {hasSpot ? (
                          <th scope="col" className="pb-2 text-end font-medium">
                            Value per unit
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {WEIGHT_UNITS.map((u) => (
                        <tr
                          key={u.key}
                          className={cn(
                            "border-border/50 border-b last:border-0",
                            u.key === unit && "bg-muted/50 font-medium"
                          )}
                        >
                          <th scope="row" className="py-2 pe-3 text-start font-medium">
                            {u.label}{" "}
                            <span className="text-muted-foreground font-normal">({u.short})</span>
                          </th>
                          <td className="text-muted-foreground py-2 pe-3 text-end tabular-nums">
                            {u.grams.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                          </td>
                          <td className="py-2 pe-3 text-end font-semibold tabular-nums">
                            {formatQty(fromGrams(grams, u.key))}
                          </td>
                          {hasSpot ? (
                            <td className="py-2 text-end tabular-nums">
                              {fmt.usd(u.grams * valuePerGram)}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-muted-foreground mt-3 text-xs">
                  Values assume {karat} gold at {hasSpot ? fmt.usd(spotNum) : "the spot price"}{" "}
                  per troy ounce of pure gold, with no dealer premium.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ToolGrid>
  );
}
