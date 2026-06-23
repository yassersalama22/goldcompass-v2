"use client";

import { useState, useEffect, useId } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingUp, TrendingDown, Link2, Check, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatUsd } from "@/lib/format";
import {
  calculate,
  GOLD_PURITIES,
  type PurityKey,
  type CalcResults,
} from "@/lib/calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Unit = "oz" | "g";

interface Props {
  initialSpot: number | null;
  isStale: boolean;
}

const inputClass =
  "w-full rounded-lg border border-input bg-background py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring";

export function GoldCalculator({ initialSpot, isStale }: Props) {
  const searchParams = useSearchParams();

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
      window.prompt("Copy this link:", window.location.href);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* ── Inputs ── */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Purchase Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Budget */}
            <div className="space-y-1.5">
              <label htmlFor={budgetId} className="text-sm font-medium">
                Your budget (USD)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <input
                  id={budgetId}
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="100"
                  placeholder="10,000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className={cn(inputClass, "pl-7 pr-3")}
                />
              </div>
            </div>

            {/* Purity */}
            <div className="space-y-1.5">
              <label htmlFor={purityId} className="text-sm font-medium">
                Gold purity
              </label>
              <select
                id={purityId}
                value={purityKey}
                onChange={(e) => setPurityKey(e.target.value as PurityKey)}
                className={cn(inputClass, "px-3 cursor-pointer")}
              >
                {GOLD_PURITIES.map((p) => (
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
                  Dealer premium
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
                aria-valuetext={`${premiumPct.toFixed(1)} percent`}
                className="w-full cursor-pointer accent-[var(--color-gold)]"
              />
              <p className="text-xs text-muted-foreground">
                Markup over spot. Bars/coins: 3–8% · Jewelry: 10–15%
              </p>
            </div>

            {/* Spot price */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={spotId} className="text-sm font-medium">
                  Spot price (XAU/USD)
                  {isStale && !spotOverridden && (
                    <Badge variant="outline" className="ml-1.5 h-4 text-[10px]">
                      stale
                    </Badge>
                  )}
                </label>
                {spotOverridden && initialSpot != null && (
                  <button
                    onClick={resetSpot}
                    className="inline-flex items-center gap-1 text-xs text-gold-strong hover:underline"
                    aria-label="Reset spot price to live price"
                  >
                    <RotateCcw className="size-3" />
                    Reset to live
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
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
                  className={cn(inputClass, "pl-7 pr-3")}
                />
              </div>
              {initialSpot == null && (
                <p className="text-xs text-muted-foreground">
                  Live price unavailable — enter the current spot price manually.
                </p>
              )}
            </div>

            {/* Unit toggle */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Display unit</p>
              <div role="group" aria-label="Display unit" className="grid grid-cols-2 gap-2">
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
                    {u === "oz" ? "Troy oz" : "Grams"}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Results ── */}
      <div aria-live="polite" aria-label="Calculation results">
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
                    Copied!
                  </>
                ) : (
                  <>
                    <Link2 className="size-3.5" />
                    Share this calculation
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
      <span className="mb-3 text-3xl" aria-hidden="true">
        🪙
      </span>
      <p className="font-medium text-foreground">Enter your budget to see results</p>
      <p className="mt-1 max-w-xs text-sm">
        Fill in the purchase details to calculate gold quantity, break-even price, and scenarios.
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
  const isOz = unit === "oz";
  const itemQty = isOz ? results.itemTroyOz : results.itemGrams;
  const pureQty = isOz ? results.pureTroyOz : results.pureGrams;
  const unitLabel = isOz ? "troy oz" : "g";
  const is24k = purityKey === "24K";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">
          Gold you can buy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-4xl font-bold tabular-nums">
          {itemQty.toFixed(isOz ? 4 : 2)}
          <span className="ml-1.5 text-lg font-medium text-muted-foreground">
            {unitLabel} {is24k ? "pure" : `of ${purityKey} gold`}
          </span>
        </p>
        {!is24k && (
          <div className="rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Pure gold equivalent: </span>
            <span className="font-semibold tabular-nums">
              {pureQty.toFixed(isOz ? 4 : 2)} {unitLabel}
            </span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          1 troy oz = 31.1035 g · Dealer price = spot × purity × (1 + premium%)
        </p>
      </CardContent>
    </Card>
  );
}

function BreakEvenCard({ results }: { results: CalcResults }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">
          Break-even price
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-end gap-3">
          <p className="text-4xl font-bold tabular-nums">
            {formatUsd(results.breakEvenSpot)}
          </p>
          <p className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
            <TrendingUp className="size-4 text-bull" aria-hidden="true" />
            Gold must rise{" "}
            <strong className="text-foreground">+{results.breakEvenPct.toFixed(1)}%</strong>{" "}
            to break even
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Assumes selling at spot with no sell-side commission or storage costs.
        </p>
      </CardContent>
    </Card>
  );
}

function ScenariosCard({ results }: { results: CalcResults }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">
          Profit / Loss scenarios
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="pb-2 pr-3 text-left font-medium">
                  Spot change
                </th>
                <th scope="col" className="pb-2 pr-3 text-right font-medium">
                  XAU/USD
                </th>
                <th scope="col" className="pb-2 pr-3 text-right font-medium">
                  Gold value
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  P/L
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
                    <td className="py-2 pr-3 text-left">
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
                        {s.spotPct === 0
                          ? "Today's spot"
                          : `${s.spotPct > 0 ? "+" : ""}${s.spotPct}%`}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                      {formatUsd(s.spotPrice)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatUsd(s.sellValue)}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right tabular-nums font-semibold",
                        isProfit && "text-bull",
                        isLoss && "text-bear",
                        !isProfit && !isLoss && "text-muted-foreground"
                      )}
                    >
                      {s.pnlUsd >= 0 ? "+" : ""}
                      {formatUsd(s.pnlUsd)}
                      <span className="ml-1 text-xs font-normal opacity-75">
                        ({s.pnlPct >= 0 ? "+" : ""}
                        {s.pnlPct.toFixed(1)}%)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Assumes selling pure gold equivalent at spot with no buy-back commission.
          Actual returns will vary.
        </p>
      </CardContent>
    </Card>
  );
}
