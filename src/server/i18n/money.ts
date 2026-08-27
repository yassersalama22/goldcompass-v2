import { requireLocale, type LocaleDef } from "@/config/locales";

/**
 * Reformat a pre-formatted money string for a target locale.
 *
 * These values live in the artifact as display strings — `"$4,283.61"`,
 * `"$4,000–$4,070"`, sometimes `"$4,300"` — because that is what the key-levels
 * grid renders. They still have to change per locale: leaving them alone puts
 * `$4,283.61` in the grid directly below a header reading `4,283.61 دولار`.
 *
 * They are handled **here, deterministically, and never sent to the model.**
 * Asking a translator to "keep every digit and move the currency symbol" is
 * asking it not to make the one mistake that matters most on this site, when a
 * regex cannot make that mistake at all. It is also free, whereas tokens are not.
 *
 * Only the currency mark moves. Digits, separators, dashes and any surrounding
 * words are untouched, which is what lets `i18n:check` assert numeral parity as
 * an absolute rule.
 */
export function reformatMoney(value: string, locale: LocaleDef | string): string {
  const def = typeof locale === "string" ? requireLocale(locale) : locale;
  const { unit, position } = def.currency;

  // Already in the target form (or no currency mark at all) — leave it alone.
  if (!/\$/.test(value)) return value;

  if (position === "prefix") {
    return unit === "$" ? value : value.replace(/\$/g, unit);
  }

  // `$4,000–$4,070` → `4,000–4,070 دولار`: strip the marks, append the unit once,
  // so a range does not end up saying "دولار" twice.
  const stripped = value.replace(/\$\s?/g, "");
  return `${stripped} ${unit}`;
}
