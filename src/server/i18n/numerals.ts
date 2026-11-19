/**
 * Number extraction shared by the translation gate (`check.ts`) and the
 * translator's own repair pass (`translate/claude.ts`).
 *
 * One implementation on purpose: the repair pass exists to make a translation
 * pass the gate, so the two must agree on what a "number" is. If they diverged,
 * the translator could "fix" a field the gate still rejects — or leave one the
 * gate would fail.
 */

/** Eastern Arabic-Indic and Persian digits — never allowed in a translation. */
export const ARABIC_INDIC = /[٠-٩۰-۹]/u;

/**
 * Every number in a string, normalised for comparison.
 *
 * Separators are stripped rather than compared, because locales legitimately
 * differ on them; the *digits* are what must not move. Returned sorted so field
 * order inside a sentence can change (which translation constantly requires)
 * without tripping the check.
 */
export function numerals(text: string): string[] {
  return (text.match(/\d[\d.,٫٬]*/g) ?? [])
    .map((n) => n.replace(/[.,٫٬]/g, ""))
    .filter(Boolean)
    .sort();
}

/**
 * How the numbers of a translation differ from its source, as multisets.
 *
 * `missing` lists each number the source has more often than the translation
 * (once per missing occurrence); `extra` the reverse. Both empty means the
 * numeral-parity rule in `check.ts` passes.
 */
export function numeralDiff(
  source: string,
  translation: string,
): { missing: string[]; extra: string[] } {
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const a = count(numerals(source));
  const b = count(numerals(translation));
  const surplus = (from: Map<string, number>, to: Map<string, number>) =>
    [...from].flatMap(([n, c]) => Array(Math.max(0, c - (to.get(n) ?? 0))).fill(n));
  return { missing: surplus(a, b), extra: surplus(b, a) };
}
