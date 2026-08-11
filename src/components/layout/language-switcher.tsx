"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import Link from "next/link";

import { ACTIVE_LOCALES, localizePath } from "@/config/locales";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Language switcher.
 *
 * Plain links, not a `<select>` or a client-side router push, and that is the
 * whole design:
 *
 *  - **Crawlable.** Each language is a real `<a href>` to the translated URL, so
 *    a crawler can follow it. That, plus the hreflang pairs in each page's
 *    metadata, is how the translations get discovered.
 *  - **It preserves the page.** `usePathname()` from `@/i18n/navigation` returns
 *    the path with the locale prefix removed, so "Arabic" from `/outlook` goes
 *    to `/ar/outlook` rather than dumping the reader on an Arabic home page.
 *  - **No automatic switching.** Nothing here reads `Accept-Language` and
 *    redirects. On a site whose HTML sits in the Cloudflare edge cache, a
 *    language redirect would be cached under the URL's key and then served to
 *    everyone — see the note in `src/i18n/routing.ts`.
 *
 * Renders nothing while a single locale is active, so it costs the English-only
 * site no markup at all.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const current = useLocale();
  const pathname = usePathname();
  const t = useTranslations();

  if (ACTIVE_LOCALES.length < 2) return null;

  return (
    <nav
      aria-label={t("language.switcherLabel")}
      className={cn("flex items-center gap-1", className)}
    >
      <Languages className="text-muted-foreground size-4" aria-hidden="true" />
      <ul className="flex items-center gap-1">
        {ACTIVE_LOCALES.map((locale) => {
          const active = locale.code === current;

          // The current language is plain text, not a link to the page you are
          // already on. Besides being the honest markup, it stops `<Link>` from
          // prefetching the current route as a subresource of itself.
          if (active) {
            return (
              <li key={locale.code}>
                <span
                  aria-current="true"
                  lang={locale.hreflang}
                  className="text-foreground px-2 py-1 text-sm font-medium"
                >
                  {locale.label}
                </span>
              </li>
            );
          }

          return (
            <li key={locale.code}>
              <Link
                /*
                 * Plain `next/link` with an explicitly built path, not the
                 * next-intl `Link` with a `locale` prop.
                 *
                 * Passing `locale` to next-intl's Link prefixes the *default*
                 * locale too, producing `/en/outlook` — a URL that only exists
                 * to 307 back to `/outlook`. That is wrong twice over here:
                 * it sends every language-switch through a redirect, and it puts
                 * a redirecting URL behind an `hreflang` attribute, which is
                 * exactly the signal crawlers are told to distrust.
                 *
                 * `localizePath` is the same helper that builds our canonicals,
                 * hreflang set and sitemap, so the switcher can never disagree
                 * with what we advertise.
                 */
                href={localizePath(pathname, locale.code)}
                // `hreflang` on the link tells a crawler what it will find on
                // the other side; `lang` makes a screen reader pronounce the
                // native language name with the right voice instead of reading
                // "العربية" as English.
                hrefLang={locale.hreflang}
                lang={locale.hreflang}
                className={cn(
                  "rounded-md px-2 py-1 text-sm transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  "text-foreground/70 hover:text-foreground",
                )}
              >
                {locale.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
