"use client";

import { useState, useEffect, useId } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, Link2, Check, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { useFormat } from "@/lib/use-format";
import {
  calculate,
  GOLD_PURITIES,
  type PurityKey,
  type CalcResults,
} from "@/lib/calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Num, SignedUsd } from "@/components/market/num";
import {
  useCurrencyAffix,
  useKaratLabel,
  usePurityOptions,
} from "@/components/calculator/tool-fields";

type Unit = "oz" | "g";

interface Props {
  initialSpot: number | null;
  isStale: boolean;
}

const inputClass =
  "w-full rounded-lg border border-input bg-background py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring";

export function GoldCalculator({ initialSpot, isStale }: Props) {
  const searchParams = useSearchParams();
  const t = useTranslations("calc");
  const tf = useTranslations("calc.flagship");
  const purityOptions = usePurityOptions();
  const affix = useCurrencyAffix();

  const budgetId = useId();
  const purityId = useId();
  const premiumId = useId();
  const spotId = useId();

  // Initialize state from URL params on first render (lazy initializers run once, no effect needed)
  const [budget, setBudget] = useState(() => searchParams.get("budget") ?? "");
  const [purityKey, setPurityKey] = useState<PurityKey>(() => {
    const pk = searchParams.get("purity") as PurityKey | null;
    return pk && GOLD_PURITIES.some((x) => x.key === pk) ? pk : "24K";
  });
  const [premiumPct, setPremiumPct] = useState(() => {
    const pr = parseFloat(searchParams.get("premium") ?? "");
    return !isNaN(pr) && pr >= 0 && pr <= 15 ? pr : 5;
  });
  const [spotStr, setSpotStr] = useState(() => {
    const sv = parseFloat(searchParams.get("spot") ?? "");
    if (!isNaN(sv) && sv > 0) return sv.toFixed(2);
    return initialSpot != null ? initialSpot.toFixed(2) : "";
  });
  const [spotOverridden, setSpotOverridden] = useState(
    () => !isNaN(parseFloat(searchParams.get("spot") ?? "")) && parseFloat(searchParams.get("spot") ?? "") > 0
  );
  const [unit, setUnit] = useState<Unit>(
    () => (searchParams.get("unit") === "g" ? "g" : "oz")
  );
  const [copied, setCopied] = useState(false);

  // Write inputs to URL without triggering a navigation (shareable link)
  // No setState calls here → lint-clean
  useEffect(() => {
    const p = new URLSearchParams();
    if (budget) p.set("budget", budget);
    if (purityKey !== "24K") p.set("purity", purityKey);
    if (premiumPct !== 5) p.set("premium", String(premiumPct));
    if (unit !== "oz") p.set("unit", unit);
    if (spotOverridden && spotStr) p.set("spot", spotStr);
    const qs = p.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [budget, purityKey, premiumPct, spotStr, spotOverridden, unit]);

  const purityFactor = GOLD_PURITIES.find((x) => x.key === purityKey)?.factor ?? 1;
  const results = calculate({
    budgetUsd: parseFloat(budget),
    spotUsd: parseFloat(spotStr),
    purityFactor,
    premiumPct,
  });

  function resetSpot() {
    if (initialSpot != null) {
      setSpotStr(initialSpot.toFixed(2));
      setSpotOverridden(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      window.prompt(tf("copyPrompt"), window.location.href);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    // grid-cols-1 below lg — see ToolGrid: an implicit auto column overflows phones.
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      {/* ── Inputs ── */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tf("inputsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Budget */}
            <div className="space-y-1.5">
              <label htmlFor={budgetId} className="text-sm font-medium">
                {tf("budget")}
              </label>
              <div className="relative">
                <CurrencyAffix affix={affix} />
                <input
                  id={budgetId}
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="100"
                  placeholder="10,000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className={cn(inputClass, affixPadding(affix))}
                />
              </div>
            </div>

            {/* Purity */}
            <div className="space-y-1.5">
              <label htmlFor={purityId} className="text-sm font-medium">
                {tf("purity")}
              </label>
              <select
                id={purityId}
                value={purityKey}
                onChange={(e) => setPurityKey(e.target.value as PurityKey)}
                className={cn(inputClass, "px-3 cursor-pointer")}
              >
                {purityOptions.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dealer premium */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor={premiumId} className="text-sm font-medium">
                  {tf("premium")}
                </label>
                <span className="text-sm font-semibold tabular-nums text-gold-strong">
                  {premiumPct.toFixed(1)}%
                </span>
              </div>
              <input
                id={premiumId}
                type="range"
                min="0"
                max="15"
                step="0.5"
                value={premiumPct}
                onChange={(e) => setPremiumPct(parseFloat(e.target.value))}
                aria-valuetext={t("percentValue", { value: premiumPct.toFixed(1) })}
                className="w-full cursor-pointer accent-[var(--color-gold)]"
              />
              <p className="text-xs text-muted-foreground">
                {tf("premiumHint")}
              </p>
            </div>

            {/* Spot price */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={spotId} className="text-sm font-medium">
                  {t("spotLabel")}
                  {isStale && !spotOverridden && (
                    <Badge variant="outline" className="ms-1.5 h-4 text-[10px]">
                      {t("stale")}
                    </Badge>
                  )}
                </label>
                {spotOverridden && initialSpot != null && (
                  <button
                    onClick={resetSpot}
                    className="inline-flex items-center gap-1 text-xs text-gold-strong hover:underline"
                    aria-label={t("resetLabel")}
                  >
                    <RotateCcw className="size-3" />
                    {t("reset")}
                  </button>
                )}
              </div>
              <div className="relative">
                <CurrencyAffix affix={affix} />
                <input
                  id={spotId}
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={spotStr}
                  onChange={(e) => {
                    setSpotStr(e.target.value);
                    setSpotOverridden(true);
                  }}
                  className={cn(inputClass, affixPadding(affix))}
                />
              </div>
              {initialSpot == null && (
                <p className="text-xs text-muted-foreground">
                  {t("spotUnavailable")}
                </p>
              )}
            </div>

            {/* Unit toggle */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{tf("displayUnit")}</p>
              <div role="group" aria-label={tf("displayUnit")} className="grid grid-cols-2 gap-2">
                {(["oz", "g"] as Unit[]).map((u) => (
                  <button
                    key={u}
                    role="radio"
                    aria-checked={unit === u}
                    onClick={() => setUnit(u)}
                    className={cn(
                      "rounded-lg border py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      unit === u
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border bg-background hover:bg-muted"
                    )}
                  >
                    {u === "oz" ? tf("troyOz") : tf("grams")}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Results ── */}
      <div aria-live="polite" aria-label={tf("resultsLabel")}>
        {!results ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            <QuantityCard results={results} unit={unit} purityKey={purityKey} />
            <BreakEvenCard results={results} />
            <ScenariosCard results={results} />
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5">
                {copied ? (
                  <>
                    <Check className="size-3.5 text-bull" />
                    {tf("copied")}
                  </>
                ) : (
                  <>
                    <Link2 className="size-3.5" />
                    {tf("share")}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Currency unit inside a money input: `$` before the number, or `دولار` after it. */
function CurrencyAffix({ affix }: { affix: { prefix?: string; suffix?: string } }) {
  const text = affix.prefix ?? affix.suffix;
  if (!text) return null;
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground text-sm",
        affix.prefix ? "start-3" : "end-3",
      )}
    >
      {text}
    </span>
  );
}

function affixPadding(affix: { prefix?: string; suffix?: string }) {
  return affix.prefix ? "ps-7 pe-3" : "ps-3 pe-14";
}

function EmptyState() {
  const t = useTranslations("calc.flagship");
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
      <span className="mb-3 text-3xl" aria-hidden="true">
        🪙
      </span>
      <p className="font-medium text-foreground">{t("emptyTitle")}</p>
      <p className="mt-1 max-w-xs text-sm">
        {t("emptyBody")}
      </p>
    </div>
  );
}

function QuantityCard({
  results,
  unit,
  purityKey,
}: {
  results: CalcResults;
  unit: Unit;
  purityKey: PurityKey;
}) {
  const t = useTranslations("calc.flagship");
  const karatLabel = useKaratLabel();
  const isOz = unit === "oz";
  const itemQty = isOz ? results.itemTroyOz : results.itemGrams;
  const pureQty = isOz ? results.pureTroyOz : results.pureGrams;
  const unitLabel = isOz ? t("unitTroyOz") : t("unitG");
  const is24k = purityKey === "24K";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {t("youCanBuy")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-4xl font-bold tabular-nums">
          {itemQty.toFixed(isOz ? 4 : 2)}
          <span className="ms-1.5 text-lg font-medium text-muted-foreground">
            {is24k
              ? t("pure", { unit: unitLabel })
              : t("ofKarat", { unit: unitLabel, karat: karatLabel(purityKey) })}
          </span>
        </p>
        {!is24k && (
          <div className="rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t("pureEquivalent")} </span>
            <span className="font-semibold tabular-nums">
              {pureQty.toFixed(isOz ? 4 : 2)} {unitLabel}
            </span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {t("quantityNote")}
        </p>
      </CardContent>
    </Card>
  );
}

function BreakEvenCard({ results }: { results: CalcResults }) {
  const fmt = useFormat();
  const t = useTranslations("calc.flagship");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {t("breakEven")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-end gap-3">
          <p className="text-4xl font-bold tabular-nums">
            {fmt.usd(results.breakEvenSpot)}
          </p>
          <p className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
            <TrendingUp className="size-4 text-bull" aria-hidden="true" />
            <span>
              {t.rich("mustRise", {
                rise: `+${results.breakEvenPct.toFixed(1)}%`,
                strong: (chunks) => (
                  <strong className="text-foreground">
                    <Num>{chunks}</Num>
                  </strong>
                ),
              })}
            </span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("breakEvenNote")}
        </p>
      </CardContent>
    </Card>
  );
}

function ScenariosCard({ results }: { results: CalcResults }) {
  const fmt = useFormat();
  const t = useTranslations("calc.flagship");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {t("scenarios")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="pb-2 pe-3 text-start font-medium">
                  {t("colChange")}
                </th>
                <th scope="col" className="pb-2 pe-3 text-end font-medium">
                  {t("colSpot")}
                </th>
                <th scope="col" className="pb-2 pe-3 text-end font-medium">
                  {t("colValue")}
                </th>
                <th scope="col" className="pb-2 text-end font-medium">
                  {t("colPnl")}
                </th>
              </tr>
            </thead>
            <tbody>
              {results.scenarios.map((s) => {
                const isNow = s.spotPct === 0;
                const isProfit = s.pnlUsd > 0;
                const isLoss = s.pnlUsd < 0;
                return (
                  <tr
                    key={s.spotPct}
                    className={cn(
                      "border-b border-border/50 last:border-0",
                      isNow && "bg-muted/50 font-medium"
                    )}
                  >
                    <td className="py-2 pe-3 text-start">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          !isNow && s.spotPct > 0 && "text-bull",
                          !isNow && s.spotPct < 0 && "text-bear"
                        )}
                      >
                        {s.spotPct > 0 ? (
                          <TrendingUp className="size-3.5" aria-hidden="true" />
                        ) : s.spotPct < 0 ? (
                          <TrendingDown className="size-3.5" aria-hidden="true" />
                        ) : null}
                        {s.spotPct === 0 ? (
                          t("today")
                        ) : (
                          <Num>{`${s.spotPct > 0 ? "+" : ""}${s.spotPct}%`}</Num>
                        )}
                      </span>
                    </td>
                    <td className="py-2 pe-3 text-end tabular-nums text-muted-foreground">
                      {fmt.usd(s.spotPrice)}
                    </td>
                    <td className="py-2 pe-3 text-end tabular-nums">
                      {fmt.usd(s.sellValue)}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-end tabular-nums font-semibold",
                        isProfit && "text-bull",
                        isLoss && "text-bear",
                        !isProfit && !isLoss && "text-muted-foreground"
                      )}
                    >
                      <SignedUsd value={s.pnlUsd} />
                      <span className="ms-1 text-xs font-normal">
                        (<Num>{`${s.pnlPct >= 0 ? "+" : ""}${s.pnlPct.toFixed(1)}%`}</Num>)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("scenariosNote")}
        </p>
      </CardContent>
    </Card>
  );
}
