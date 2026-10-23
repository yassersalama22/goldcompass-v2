"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

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
  useKaratLabel,
  usePurityOptions,
  useSpotState,
  useUnitOptions,
  useUnitShort,
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

/** Enough precision that a gram doesn't round to zero when shown in kilograms. */
function formatQty(value: number): string {
  if (value === 0) return "0";
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(4);
  return value.toPrecision(4);
}

export function UnitConverter({ initialSpot, isStale }: Props) {
  const fmt = useFormat();
  const t = useTranslations("calc.unitConverter");
  const tu = useTranslations("calc.units");
  const unitOptions = useUnitOptions();
  const purityOptions = usePurityOptions();
  const karatLabel = useKaratLabel();
  const unitShort = useUnitShort();
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

  return (
    <ToolGrid>
      <InputsCard title={t("inputsTitle")}>
        <NumberField
          label={t("amount")}
          value={amount}
          onChange={setAmount}
          min="0"
          step="0.1"
          placeholder="1"
        />
        <SelectField label={t("fromUnit")} value={unit} onChange={setUnit} options={unitOptions} />
        <SelectField
          label={t("purity")}
          value={karat}
          onChange={setKarat}
          options={purityOptions}
          hint={t("purityHint")}
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

      <div aria-live="polite" aria-label={t("resultsLabel")}>
        {!valid ? (
          <EmptyResults message={t("empty")} />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <ResultStat
                label={t("inGrams")}
                value={t("gramsValue", { qty: formatQty(grams) })}
                sub={t("amountOf", {
                  qty: formatQty(amountNum),
                  unit: unitShort(unit),
                  karat: karatLabel(karat),
                })}
              />
              <ResultStat
                label={t("inTroyOz")}
                value={t("troyOzValue", { qty: formatQty(fromGrams(grams, "ozt")) })}
                sub={
                  hasSpot
                    ? t("worth", { value: fmt.usd(grams * valuePerGram), karat: karatLabel(karat) })
                    : undefined
                }
              />
            </div>

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
                          {t("colUnit")}
                        </th>
                        <th scope="col" className="pe-3 pb-2 text-end font-medium">
                          {t("colGramsEach")}
                        </th>
                        <th scope="col" className="pe-3 pb-2 text-end font-medium">
                          {t("colAmount")}
                        </th>
                        {hasSpot ? (
                          <th scope="col" className="pb-2 text-end font-medium">
                            {t("colValue")}
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
                            {tu(`${u.key}.label`)}{" "}
                            <span className="text-muted-foreground font-normal">({unitShort(u.key)})</span>
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
                  {t("tableNote", {
                    karat: karatLabel(karat),
                    spot: hasSpot ? fmt.usd(spotNum) : t("theSpotPrice"),
                  })}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ToolGrid>
  );
}
