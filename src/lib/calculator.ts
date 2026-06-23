/** Pure gold-calculator math. No React, no side-effects — easy to test. */

export const GOLD_PURITIES = [
  { label: "24K (999.9 fine)", key: "24K", factor: 1 },
  { label: "22K (916.7 fine)", key: "22K", factor: 22 / 24 },
  { label: "18K (750 fine)", key: "18K", factor: 18 / 24 },
  { label: "14K (583.3 fine)", key: "14K", factor: 14 / 24 },
  { label: "10K (416.7 fine)", key: "10K", factor: 10 / 24 },
] as const;

export type PurityKey = (typeof GOLD_PURITIES)[number]["key"];

export const TROY_OZ_TO_GRAMS = 31.1035;

export interface CalcInputs {
  budgetUsd: number;
  spotUsd: number;
  purityFactor: number; // 0 < factor ≤ 1
  premiumPct: number;   // e.g. 5 = 5% over spot
}

export interface PnlScenario {
  spotPct: number;    // % change from purchase spot
  spotPrice: number;  // absolute XAU/USD at that scenario
  sellValue: number;  // USD if sold at that spot (no sell commission)
  pnlUsd: number;
  pnlPct: number;
}

export interface CalcResults {
  itemTroyOz: number;   // troy oz of the karat item purchased
  pureTroyOz: number;   // troy oz of pure gold equivalent
  itemGrams: number;
  pureGrams: number;
  breakEvenSpot: number; // spot must reach this to break even
  breakEvenPct: number;  // = premiumPct (mathematically)
  scenarios: PnlScenario[];
}

// Spot % changes shown in the P/L table
export const SCENARIO_PCTS = [-20, -10, 0, 10, 25, 50] as const;

export function calculate(inputs: CalcInputs): CalcResults | null {
  const { budgetUsd, spotUsd, purityFactor, premiumPct } = inputs;
  if (
    !Number.isFinite(budgetUsd) || budgetUsd <= 0 ||
    !Number.isFinite(spotUsd) || spotUsd <= 0 ||
    !Number.isFinite(purityFactor) || purityFactor <= 0 || purityFactor > 1 ||
    !Number.isFinite(premiumPct) || premiumPct < 0 || premiumPct > 100
  ) {
    return null;
  }

  const premiumMult = 1 + premiumPct / 100;

  // Dealer price per item troy oz = spot × purityFactor × premiumMult
  // Item oz bought = budget / (spot × purityFactor × premiumMult)
  const itemTroyOz = budgetUsd / (spotUsd * purityFactor * premiumMult);
  const pureTroyOz = itemTroyOz * purityFactor;
  const itemGrams = itemTroyOz * TROY_OZ_TO_GRAMS;
  const pureGrams = pureTroyOz * TROY_OZ_TO_GRAMS;

  // Break-even: pureTroyOz × S_sell = budget → S_sell = spot × premiumMult
  const breakEvenSpot = spotUsd * premiumMult;
  const breakEvenPct = premiumPct;

  const scenarios: PnlScenario[] = SCENARIO_PCTS.map((pct) => {
    const targetSpot = spotUsd * (1 + pct / 100);
    const sellValue = pureTroyOz * targetSpot;
    const pnlUsd = sellValue - budgetUsd;
    const pnlPct = (pnlUsd / budgetUsd) * 100;
    return { spotPct: pct, spotPrice: targetSpot, sellValue, pnlUsd, pnlPct };
  });

  return { itemTroyOz, pureTroyOz, itemGrams, pureGrams, breakEvenSpot, breakEvenPct, scenarios };
}
