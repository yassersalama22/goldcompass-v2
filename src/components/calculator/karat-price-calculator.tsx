"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { useFormat } from "@/lib/use-format";
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

export function KaratPriceCalculator({ initialSpot, isStale }: Props) {
  const fmt = useFormat();
  const t = useTranslations("calc.karatPrice");
  const unitOptions = useUnitOptions();
  const purityOptions = usePurityOptions();
  const karatLabel = useKaratLabel();
  const unitShort = useUnitShort();
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
      <InputsCard title={t("inputsTitle")}>
        <NumberField
          label={t("weight")}
          value={weight}
          onChange={setWeight}
          min="0"
          step="0.1"
          placeholder="10"
        />
        <SelectField label={t("weightUnit")} value={unit} onChange={setUnit} options={unitOptions} />
        <SelectField
          label={t("karat")}
          value={karat}
          onChange={setKarat}
          options={purityOptions}
          hint={t("karatHint")}
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
        {!table || !selected ? (
          <EmptyResults message={t("empty")} />
        ) : (
          <div className="space-y-4">
            <ResultStat
              label={t("meltValue", {
                weight: weightNum.toLocaleString("en-US"),
                unit: unitShort(unit),
                karat: karatLabel(karat),
              })}
              value={hasWeight ? fmt.usd(selected.value) : "—"}
              sub={
                hasWeight ? (
                  t.rich("contains", {
                    grams: selected.pureGrams.toFixed(2),
                    fineness: String(selected.fineness),
                    strong: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                  })
                ) : (
                  t("enterWeight")
                )
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <ResultStat
                label={t("perGram", { karat: karatLabel(karat) })}
                value={fmt.usd(selected.pricePerGram)}
              />
              <ResultStat
                label={t("perTroyOz", { karat: karatLabel(karat) })}
                value={fmt.usd(selected.pricePerTroyOz)}
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
                          {t("colKarat")}
                        </th>
                        <th scope="col" className="pe-3 pb-2 text-end font-medium">
                          {t("colFineness")}
                        </th>
                        <th scope="col" className="pe-3 pb-2 text-end font-medium">
                          {t("colPerGram")}
                        </th>
                        <th scope="col" className="pe-3 pb-2 text-end font-medium">
                          {t("colPerTroyOz")}
                        </th>
                        {hasWeight ? (
                          <th scope="col" className="pb-2 text-end font-medium">
                            {t("colYourWeight")}
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
                          <th scope="row" className="py-2 pe-3 text-start font-medium">
                            {karatLabel(row.key)}
                          </th>
                          <td className="text-muted-foreground py-2 pe-3 text-end tabular-nums">
                            {row.fineness}
                          </td>
                          <td className="py-2 pe-3 text-end tabular-nums">
                            {fmt.usd(row.pricePerGram)}
                          </td>
                          <td className="py-2 pe-3 text-end tabular-nums">
                            {fmt.usd(row.pricePerTroyOz)}
                          </td>
                          {hasWeight ? (
                            <td className="py-2 text-end font-semibold tabular-nums">
                              {fmt.usd(row.value)}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-muted-foreground mt-3 text-xs">
                  {t("tableNote")}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ToolGrid>
  );
}
