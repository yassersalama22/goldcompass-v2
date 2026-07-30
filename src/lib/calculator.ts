/** Pure gold-calculator math. No React, no side-effects — easy to test. */

export const GOLD_PURITIES = [
  { label: "24K (999.9 fine)", key: "24K", factor: 1, fineness: 999.9 },
  { label: "22K (916.7 fine)", key: "22K", factor: 22 / 24, fineness: 916.7 },
  { label: "18K (750 fine)", key: "18K", factor: 18 / 24, fineness: 750 },
  { label: "14K (583.3 fine)", key: "14K", factor: 14 / 24, fineness: 583.3 },
  { label: "10K (416.7 fine)", key: "10K", factor: 10 / 24, fineness: 416.7 },
] as const;

export type PurityKey = (typeof GOLD_PURITIES)[number]["key"];

export const TROY_OZ_TO_GRAMS = 31.1035;

export function purityFactorFor(key: PurityKey): number {
  return GOLD_PURITIES.find((p) => p.key === key)?.factor ?? 1;
}

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

/* ────────────────────────────────────────────────────────────────────────────
 * Weight units
 * Every conversion goes through grams as the base unit, so adding a unit is a
 * one-line change and no unit ever converts directly to another.
 * ──────────────────────────────────────────────────────────────────────────── */

export const WEIGHT_UNITS = [
  { key: "g", label: "Gram", short: "g", grams: 1 },
  { key: "kg", label: "Kilogram", short: "kg", grams: 1000 },
  { key: "ozt", label: "Troy ounce", short: "ozt", grams: TROY_OZ_TO_GRAMS },
  { key: "oz", label: "Ounce (avoirdupois)", short: "oz", grams: 28.349523125 },
  { key: "dwt", label: "Pennyweight", short: "dwt", grams: 1.55517384 },
  { key: "tola", label: "Tola", short: "tola", grams: 11.6638038 },
] as const;

export type WeightUnitKey = (typeof WEIGHT_UNITS)[number]["key"];

export function unitGrams(key: WeightUnitKey): number {
  return WEIGHT_UNITS.find((u) => u.key === key)?.grams ?? 1;
}

export function toGrams(value: number, unit: WeightUnitKey): number {
  return value * unitGrams(unit);
}

export function fromGrams(grams: number, unit: WeightUnitKey): number {
  return grams / unitGrams(unit);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Karat price — what a given purity is worth per unit weight at a given spot
 * ──────────────────────────────────────────────────────────────────────────── */

export interface KaratQuote {
  key: PurityKey;
  label: string;
  fineness: number;
  factor: number;
  pricePerGram: number;
  pricePerTroyOz: number;
  /** Melt value of the entered weight at this purity. */
  value: number;
  /** Pure gold content of the entered weight at this purity, in grams. */
  pureGrams: number;
}

/**
 * Melt (intrinsic) value per karat. This is the metal value only — it is what
 * the gold in an item is worth, not what a dealer pays for it or charges for it.
 */
export function karatPriceTable(spotUsd: number, weightGrams: number): KaratQuote[] | null {
  if (!Number.isFinite(spotUsd) || spotUsd <= 0) return null;
  if (!Number.isFinite(weightGrams) || weightGrams < 0) return null;

  return GOLD_PURITIES.map((p) => {
    const pricePerTroyOz = spotUsd * p.factor;
    const pricePerGram = pricePerTroyOz / TROY_OZ_TO_GRAMS;
    return {
      key: p.key,
      label: p.label,
      fineness: p.fineness,
      factor: p.factor,
      pricePerGram,
      pricePerTroyOz,
      value: pricePerGram * weightGrams,
      pureGrams: weightGrams * p.factor,
    };
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Break-even — the spot price that returns your money after both sides' costs
 * ──────────────────────────────────────────────────────────────────────────── */

export interface BreakEvenInputs {
  spotUsd: number;
  premiumPct: number;  // paid over spot when buying
  sellFeePct: number;  // buy-back spread / commission lost when selling
}

export interface BreakEvenResult {
  /** What you effectively pay per troy oz of *pure* gold content. */
  costPerPureTroyOz: number;
  breakEvenSpot: number;
  /** % the spot price must rise from purchase spot to break even. */
  requiredRisePct: number;
}

/**
 * Purity deliberately does not appear here: it scales cost and proceeds by the
 * same factor, so it cancels out. A 10K buyer and a 24K buyer paying the same
 * premium need the same *percentage* move in spot to break even.
 */
export function breakEven(inputs: BreakEvenInputs): BreakEvenResult | null {
  const { spotUsd, premiumPct, sellFeePct } = inputs;
  if (
    !Number.isFinite(spotUsd) || spotUsd <= 0 ||
    !Number.isFinite(premiumPct) || premiumPct < 0 || premiumPct > 100 ||
    !Number.isFinite(sellFeePct) || sellFeePct < 0 || sellFeePct >= 100
  ) {
    return null;
  }

  const costPerPureTroyOz = spotUsd * (1 + premiumPct / 100);
  // pure oz × S × (1 − sellFee) = pure oz × costPerPureTroyOz
  const breakEvenSpot = costPerPureTroyOz / (1 - sellFeePct / 100);

  return {
    costPerPureTroyOz,
    breakEvenSpot,
    requiredRisePct: (breakEvenSpot / spotUsd - 1) * 100,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Profit / loss on a completed (or hypothetical) round trip
 * ──────────────────────────────────────────────────────────────────────────── */

export interface PnlInputs {
  entrySpot: number;
  exitSpot: number;
  quantity: number;
  unit: WeightUnitKey;
  purityFactor: number;
  premiumPct: number;
  sellFeePct: number;
}

export interface PnlResult {
  pureTroyOz: number;
  costBasis: number;
  proceeds: number;
  pnlUsd: number;
  pnlPct: number;
  breakEvenSpot: number;
  /** Spot move actually delivered, for comparison against the break-even move. */
  spotMovePct: number;
}

export function profitLoss(inputs: PnlInputs): PnlResult | null {
  const { entrySpot, exitSpot, quantity, unit, purityFactor, premiumPct, sellFeePct } = inputs;
  if (
    !Number.isFinite(entrySpot) || entrySpot <= 0 ||
    !Number.isFinite(exitSpot) || exitSpot <= 0 ||
    !Number.isFinite(quantity) || quantity <= 0 ||
    !Number.isFinite(purityFactor) || purityFactor <= 0 || purityFactor > 1 ||
    !Number.isFinite(premiumPct) || premiumPct < 0 || premiumPct > 100 ||
    !Number.isFinite(sellFeePct) || sellFeePct < 0 || sellFeePct >= 100
  ) {
    return null;
  }

  const itemTroyOz = fromGrams(toGrams(quantity, unit), "ozt");
  const pureTroyOz = itemTroyOz * purityFactor;

  const costBasis = pureTroyOz * entrySpot * (1 + premiumPct / 100);
  const proceeds = pureTroyOz * exitSpot * (1 - sellFeePct / 100);
  const pnlUsd = proceeds - costBasis;

  const be = breakEven({ spotUsd: entrySpot, premiumPct, sellFeePct });

  return {
    pureTroyOz,
    costBasis,
    proceeds,
    pnlUsd,
    pnlPct: (pnlUsd / costBasis) * 100,
    breakEvenSpot: be?.breakEvenSpot ?? entrySpot,
    spotMovePct: (exitSpot / entrySpot - 1) * 100,
  };
}
