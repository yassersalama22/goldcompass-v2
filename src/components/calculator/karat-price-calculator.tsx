"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { formatUsd } from "@/lib/format";
import {
  GOLD_PURITIES,
  WEIGHT_UNITS,
  karatPriceTable,
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

export function KaratPriceCalculator({ initialSpot, isStale }: Props) {
  const searchParams = useSearchParams();
  const spotState = useSpotState(initialSpot);

  const [weight, setWeight] = useState(() => searchParams.get("weight") ?? "");
  const [unit, setUnit] = useState<WeightUnitKey>(() => {
    const u = searchParams.get("unit") as WeightUnitKey | null;
    return u && WEIGHT_UNITS.some((x) => x.key === u) ? u : "g";
  });
  const [karat, setKarat] = useState<PurityKey>(() => {
    const k = searchParams.get("karat") as PurityKey | null;
    return k && GOLD_PURITIES.some((x) => x.key === k) ? k : "18K";
  });

  useUrlState({
    weight,
    unit: unit === "g" ? "" : unit,
    karat: karat === "18K" ? "" : karat,
    spot: spotState.urlValue,
  });

  const weightNum = parseFloat(weight);
  const hasWeight = Number.isFinite(weightNum) && weightNum > 0;
  const weightGrams = hasWeight ? toGrams(weightNum, unit) : 0;
  const table = karatPriceTable(parseFloat(spotState.spot), weightGrams);
  const selected = table?.find((row) => row.key === karat);

  return (
    <ToolGrid>
      <InputsCard title="Your gold">
        <NumberField
          label="Weight"
          value={weight}
          onChange={setWeight}
          min="0"
          step="0.1"
          placeholder="10"
        />
        <SelectField label="Weight unit" value={unit} onChange={setUnit} options={unitOptions} />
        <SelectField
          label="Karat / purity"
          value={karat}
          onChange={setKarat}
          options={purityOptions}
          hint="Check the hallmark stamped on the item — 750 means 18K, 585 means 14K."
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

      <div aria-live="polite" aria-label="Karat price results">
        {!table || !selected ? (
          <EmptyResults message="Enter a weight and confirm the spot price to see what your gold is worth." />
        ) : (
          <div className="space-y-4">
            <ResultStat
              label={`Melt value of ${weightNum.toLocaleString("en-US")} ${
                WEIGHT_UNITS.find((u) => u.key === unit)?.short
              } of ${karat} gold`}
              value={hasWeight ? formatUsd(selected.value) : "—"}
              sub={
                hasWeight ? (
                  <>
                    Contains <strong className="text-foreground">{selected.pureGrams.toFixed(2)} g</strong>{" "}
                    of pure gold ({selected.fineness} parts per thousand).
                  </>
                ) : (
                  "Enter a weight above to value a specific item."
                )
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <ResultStat
                label={`${karat} price per gram`}
                value={formatUsd(selected.pricePerGram)}
              />
              <ResultStat
                label={`${karat} price per troy ounce`}
                value={formatUsd(selected.pricePerTroyOz)}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm font-normal">
                  Every karat at this spot price
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="-mx-1 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b text-xs">
                        <th scope="col" className="pr-3 pb-2 text-left font-medium">
                          Karat
                        </th>
                        <th scope="col" className="pr-3 pb-2 text-right font-medium">
                          Fineness
                        </th>
                        <th scope="col" className="pr-3 pb-2 text-right font-medium">
                          Per gram
                        </th>
                        <th scope="col" className="pr-3 pb-2 text-right font-medium">
                          Per troy oz
                        </th>
                        {hasWeight ? (
                          <th scope="col" className="pb-2 text-right font-medium">
                            Your weight
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {table.map((row) => (
                        <tr
                          key={row.key}
                          className={cn(
                            "border-border/50 border-b last:border-0",
                            row.key === karat && "bg-muted/50 font-medium"
                          )}
                        >
                          <th scope="row" className="py-2 pr-3 text-left font-medium">
                            {row.key}
                          </th>
                          <td className="text-muted-foreground py-2 pr-3 text-right tabular-nums">
                            {row.fineness}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {formatUsd(row.pricePerGram)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {formatUsd(row.pricePerTroyOz)}
                          </td>
                          {hasWeight ? (
                            <td className="py-2 text-right font-semibold tabular-nums">
                              {formatUsd(row.value)}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-muted-foreground mt-3 text-xs">
                  Melt value only — the worth of the metal itself. A dealer buying scrap pays a
                  percentage of this; a dealer selling coins or jewellery charges more than this.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ToolGrid>
  );
}
