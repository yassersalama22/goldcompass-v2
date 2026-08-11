import { DEFAULT_LOCALE, getLocale } from "@/config/locales";

/**
 * Locale-aware number, currency and date formatting.
 *
 * One utility for the whole app — Server Components, the Markdown builder, and
 * the `.mts` pipeline scripts all call these, and only the first of those could
 * use a `next-intl` formatter. Keeping it here means every surface formats a
 * price the same way.
 *
 * The locale code is resolved through the registry to its `intlLocale`, which
 * carries Unicode extensions the route segment does not: `ar` becomes
 * `ar-u-nu-latn`, forcing **Latin digits** in Arabic. Without that, `Intl` emits
 * Arabic-Indic digits (٤٬١٦٠) which would clash with the Latin numerals drawn on
 * the SVG price chart's axis, in the same page.
 *
 * `locale` defaults to the canonical one so a call site that has no locale in
 * hand still produces exactly what it did before this site was multilingual.
 */
function intlTag(locale: string): string {
  return getLocale(locale)?.intlLocale ?? locale;
}

/**
 * `Intl` constructors are expensive enough that the pre-i18n version of this
 * file held module-level singletons. Locale-awareness means one instance per
 * (locale, kind) rather than one overall — so they are memoized instead, which
 * keeps the hot render path allocation-free after the first call.
 */
function memo<T>(create: (tag: string) => T): (locale: string) => T {
  const cache = new Map<string, T>();
  return (locale: string) => {
    const tag = intlTag(locale);
    let value = cache.get(tag);
    if (value === undefined) {
      value = create(tag);
      cache.set(tag, value);
    }
    return value;
  };
}

/*
 * Currency is formatted as a locale-aware *number* with the `$` placed by us,
 * rather than with `style: "currency"`.
 *
 * `Intl` is right but not what we want here. For Arabic it renders
 * `\u200f4,283.61 US$` — symbol trailing, prefixed with an invisible RLM — while
 * every other surface on this site (the SVG chart axis, the OG cards, the
 * Markdown representations, the JSON API) shows `$4,283.61`. Following CLDR only
 * where a React component happens to know the locale produced two currency
 * formats on one site, which reads as a bug rather than as localization.
 *
 * So: the locale still governs everything that is genuinely locale-dependent —
 * digit grouping, the decimal separator, and Latin vs Arabic-Indic digits (see
 * `intlLocale`) — and the `$` sits in front in every language. That matches how
 * Arabic financial media writes USD prices, and it keeps invisible bidi control
 * characters out of strings that end up in JSON and Markdown.
 *
 * This is a presentation decision, not a technical constraint: to follow CLDR
 * instead, switch these two back to `style: "currency"` and the whole site
 * changes together. The site is USD-only by contract (`Spot.currency` is
 * `z.literal("USD")`), so placing the symbol ourselves is honest rather than a
 * shortcut.
 */
const usd = memo(
  (tag) =>
    new Intl.NumberFormat(tag, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
);

const usd0 = memo((tag) => new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }));

// Pinned to UTC on purpose: these label daily price points (which upstream keys
// by UTC day), and the chart is server-rendered, so an unpinned zone would make
// the server and the browser disagree near midnight and break hydration.
const shortDate = memo(
  (tag) =>
    new Intl.DateTimeFormat(tag, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
);

const longDate = memo(
  (tag) =>
    new Intl.DateTimeFormat(tag, {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }),
);

const longDateTime = memo(
  (tag) =>
    new Intl.DateTimeFormat(tag, {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }),
);

export function formatUsd(value: number, locale: string = DEFAULT_LOCALE): string {
  return `$${usd(locale).format(value)}`;
}

/** Whole-dollar USD (for compact axis labels). */
export function formatUsdCompact(
  value: number,
  locale: string = DEFAULT_LOCALE,
): string {
  return `$${usd0(locale).format(value)}`;
}

/**
 * Signed percentage, e.g. "+1.24%" / "-0.16%".
 *
 * Built by hand rather than through `Intl` so the sign, the digits and the `%`
 * stay one inseparable token. Note for RTL: this string must be rendered inside
 * a bidi-isolating element when it appears in Arabic prose, or the leading sign
 * detaches and reorders. See the `<Num>` component.
 */
export function formatSignedPct(value: number, digits = 2): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatShortDate(ms: number, locale: string = DEFAULT_LOCALE): string {
  return shortDate(locale).format(new Date(ms));
}

/**
 * Long date, no time — article publication dates.
 *
 * Pinned to UTC like everything else here: an article dated `2026-08-07` parses
 * as UTC midnight, which a westward browser would otherwise render as the 6th.
 */
export function formatLongDate(
  value: Date | string | number,
  locale: string = DEFAULT_LOCALE,
): string {
  return longDate(locale).format(new Date(value));
}

/** Long date + short time, always UTC — used for "last updated" stamps. */
export function formatLongDateTime(
  value: Date | string | number,
  locale: string = DEFAULT_LOCALE,
): string {
  return longDateTime(locale).format(new Date(value));
}
