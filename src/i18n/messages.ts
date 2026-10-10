import ar from "@/content/i18n/ui/ar.json";
import en from "@/content/i18n/ui/en.json";

import { DEFAULT_LOCALE } from "@/config/locales";

/**
 * Synchronous access to the UI catalogs, for code that formats strings *outside*
 * a React render: `src/lib/structured-data.ts` (called inline from JSX and
 * needs to stay sync), `src/server/markdown/index.ts`, and the `.mts` pipeline
 * scripts.
 *
 * Inside a Server Component, prefer `getTranslations()` from `next-intl/server`
 * — it participates in the request's locale resolution rather than being handed
 * one. This module is the escape hatch, not the main road.
 *
 * Catalogs are imported statically so the standalone build traces them. Each new
 * locale adds one import and one map entry; they are a few KB of chrome strings,
 * so holding them all in memory is cheaper than the machinery to avoid it.
 */
export type UiMessages = typeof en;

/**
 * Layer a translated catalog over the canonical one, key by key. A key that is
 * missing from a translation (new English not yet translated) falls back to
 * English rather than to `undefined` — the same outcome a reader gets in a
 * rendered page, and it keeps a partial catalog from crashing a schema builder.
 */
function withFallback(base: unknown, over: unknown): unknown {
  if (typeof base !== "object" || base === null || Array.isArray(base)) {
    return typeof over === typeof base ? over : base;
  }
  const o = (typeof over === "object" && over !== null ? over : {}) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(base).map(([k, v]) => [k, withFallback(v, o[k])]),
  );
}

/**
 * Every catalog in `src/content/i18n/ui/` must be registered here. A locale
 * missing from this map silently serves ENGLISH from every caller of
 * `messages()` — which is how `/ar/*` pages shipped English JSON-LD (including
 * an English FAQPage under Arabic visible FAQs) until 2026-10-10.
 */
const CATALOGS: Record<string, UiMessages> = {
  en,
  ar: withFallback(en, ar) as UiMessages,
};

/** Whether a locale's catalog is registered above. Checked by `i18n:check`. */
export function hasCatalog(locale: string): boolean {
  return locale in CATALOGS;
}

/** Catalog for a locale, falling back to the canonical one. */
export function messages(locale: string): UiMessages {
  return CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE]!;
}

/**
 * Interpolate `{placeholder}` tokens. A deliberately tiny subset of ICU: this
 * helper only ever formats catalog strings that take simple named values
 * (a site name, a date). Anything needing plurals or gender — where Arabic has
 * six forms and a naive helper would be wrong — must go through `next-intl`'s
 * full ICU formatter inside a render instead.
 */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
