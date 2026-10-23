import "server-only";

import { ACTIVE_LOCALE_CODES, DEFAULT_LOCALE } from "@/config/locales";
import { isArticleTranslated } from "@/server/articles";
import { hasOutlookTranslation } from "@/server/outlook";
import { isPageTranslated } from "@/server/pages";

/**
 * Which routed locales have a real, CURRENT translation of a piece of content.
 *
 * This is what hreflang, `og:locale:alternate` and the sitemap must advertise —
 * never "every active locale". A page in a locale that only falls back to
 * English is still served (a reader following an Arabic link gets the piece),
 * but it must not be presented to search engines as an Arabic page.
 *
 * Computed across ALL locales, not just the one being rendered: the English
 * page needs to know whether to advertise an Arabic alternate too. (The first
 * version of `/disclaimer` checked only the current locale, so the English page
 * always advertised an Arabic sibling that did not exist.)
 */
export function articleLocales(slug: string): string[] {
  return ACTIVE_LOCALE_CODES.filter((l) => isArticleTranslated(slug, l));
}

export function outlookLocales(): string[] {
  return ACTIVE_LOCALE_CODES.filter((l) => l === DEFAULT_LOCALE || hasOutlookTranslation(l));
}

export function pageLocales(slug: string): string[] {
  return ACTIVE_LOCALE_CODES.filter((l) => isPageTranslated(slug, l));
}

/**
 * Attributes for content rendered in a locale it was not written in.
 *
 * Fallback English inside an Arabic page must say so: `lang` so screen readers
 * pronounce it as English, `dir="ltr"` so it lays out left-to-right — inherited
 * RTL turns "10-year real yield" into "year real yield-10" and moves sentence
 * punctuation to the wrong end. Returns nothing when the content IS in the
 * page's language, so translated pages are untouched.
 */
export type ContentLang = { lang?: string; dir?: "ltr" };

export function contentLangProps(translated: boolean, locale: string): ContentLang {
  return translated || locale === DEFAULT_LOCALE ? {} : { lang: DEFAULT_LOCALE, dir: "ltr" };
}
