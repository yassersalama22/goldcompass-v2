/**
 * Display currencies for local gold prices.
 *
 * Gold is quoted in US dollars everywhere, so USD stays the input and the
 * contract currency (`Spot.currency` is `z.literal("USD")`). These are
 * *display* currencies only: a price is computed in USD and converted at the
 * last step, so every figure on the page traces back to the one spot price.
 *
 * Chosen for the audiences we serve in Arabic: Egypt and the six Gulf states.
 * Names and units are in the UI catalog under `currency.<code>`, so they are
 * translated with the glossary like any other string.
 *
 * Adding a currency: one entry here, its `currency.<code>` catalog keys, and
 * confirm the exchange-rate source carries it (`server/fx`).
 */
export const LOCAL_CURRENCIES = ["EGP", "SAR", "AED", "KWD", "QAR", "BHD", "OMR"] as const;

export type LocalCurrency = (typeof LOCAL_CURRENCIES)[number];
export type DisplayCurrency = "USD" | LocalCurrency;

export const DISPLAY_CURRENCIES: readonly DisplayCurrency[] = ["USD", ...LOCAL_CURRENCIES];

export function isDisplayCurrency(value: string | null | undefined): value is DisplayCurrency {
  return value != null && (DISPLAY_CURRENCIES as readonly string[]).includes(value);
}
