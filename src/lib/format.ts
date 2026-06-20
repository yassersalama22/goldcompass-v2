const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUsd(value: number): string {
  return usd.format(value);
}

/** Whole-dollar USD (for compact axis labels). */
export function formatUsdCompact(value: number): string {
  return usd0.format(value);
}

/** Signed percentage, e.g. "+1.24%" / "-0.16%". */
export function formatSignedPct(value: number, digits = 2): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function formatShortDate(ms: number): string {
  return shortDate.format(new Date(ms));
}
