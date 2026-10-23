"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Num, SignedUsd } from "@/components/market/num";
import { useFormat } from "@/lib/use-format";
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
  useCurrencyAffix,
  usePurityOptions,
  useUnitOptions,
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

function clampPct(raw: string | null, fallback: number, max: number): number {
  const value = parseFloat(raw ?? "");
  return !isNaN(value) && value >= 0 && value <= max ? value : fallback;
}

export function ProfitLossCalculator({ initialSpot }: Props) {
  const fmt = useFormat();
  const t = useTranslations("calc.profitLoss");
  const unitOptions = useUnitOptions();
  const purityOptions = usePurityOptions();
  const affix = useCurrencyAffix();
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
      <InputsCard title={t("inputsTitle")}>
        <NumberField
          label={t("entry")}
          value={entry}
          onChange={setEntry}
          {...affix}
          min="1"
          step="1"
          placeholder="3,800"
        />
        <NumberField
          label={t("exit")}
          value={exit}
          onChange={setExit}
          {...affix}
          min="1"
          step="1"
          placeholder="4,200"
          hint={
            initialSpot != null
              ? t("exitHint", { spot: fmt.usd(initialSpot) })
              : undefined
          }
        />
        <NumberField
          label={t("quantity")}
          value={quantity}
          onChange={setQuantity}
          min="0"
          step="0.1"
          placeholder="2"
        />
        <SelectField label={t("quantityUnit")} value={unit} onChange={setUnit} options={unitOptions} />
        <SelectField label={t("purity")} value={karat} onChange={setKarat} options={purityOptions} />
        <PercentSlider
          label={t("premium")}
          value={premiumPct}
          onChange={setPremiumPct}
          max={20}
        />
        <PercentSlider
          label={t("sellFee")}
          value={sellFeePct}
          onChange={setSellFeePct}
          max={20}
        />
      </InputsCard>

      <div aria-live="polite" aria-label={t("resultsLabel")}>
        {!result ? (
          <EmptyResults message={t("empty")} />
        ) : (
          <div className="space-y-4">
            <ResultStat
              label={isLoss ? t("netLoss") : t("netProfit")}
              tone={isProfit ? "bull" : isLoss ? "bear" : "default"}
              value={<SignedUsd value={result.pnlUsd} />}
              sub={
                <span className="flex items-center gap-1.5">
                  {isProfit ? (
                    <TrendingUp className="text-bull size-4" aria-hidden="true" />
                  ) : isLoss ? (
                    <TrendingDown className="text-bear size-4" aria-hidden="true" />
                  ) : null}
                  <span>
                    {t.rich("returnOn", {
                      pct: fmt.signedPct(result.pnlPct, 1),
                      cost: fmt.usd(result.costBasis),
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

            <div className="grid gap-4 sm:grid-cols-2">
              <ResultStat
                label={t("totalCost")}
                value={fmt.usd(result.costBasis)}
                sub={t("totalCostSub", { oz: result.pureTroyOz.toFixed(4), premium: premiumPct.toFixed(1) })}
              />
              <ResultStat
                label={t("proceeds")}
                value={fmt.usd(result.proceeds)}
                sub={t("proceedsSub", { sellFee: sellFeePct.toFixed(1) })}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm font-normal">
                  {t("whyTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-border divide-y text-sm">
                  <div className="flex items-baseline justify-between gap-4 pb-2">
                    <dt className="text-muted-foreground">{t("priceMove")}</dt>
                    <dd className="font-semibold tabular-nums">
                      <Num>{fmt.signedPct(result.spotMovePct, 1)}</Num>
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">{t("breakEven")}</dt>
                    <dd className="font-semibold tabular-nums">
                      {fmt.usd(result.breakEvenSpot)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 pt-2">
                    <dt className="text-muted-foreground">{t("actualReturn")}</dt>
                    <dd className="font-semibold tabular-nums">
                      <Num>{fmt.signedPct(result.pnlPct, 1)}</Num>
                    </dd>
                  </div>
                </dl>
                <p className="text-muted-foreground mt-3 text-xs">
                  {t("whyNote", { breakEven: fmt.usd(result.breakEvenSpot) })}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ToolGrid>
  );
}
