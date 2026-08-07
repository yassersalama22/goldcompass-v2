import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware replacements for `next/link` and the `next/navigation` hooks.
 *
 * Use these anywhere an internal link is rendered, so `href="/outlook"` resolves
 * to `/outlook` in English and `/ar/outlook` in Arabic without every call site
 * having to know about prefixes. `usePathname()` from here returns the path
 * *without* the locale prefix, which is what the language switcher needs to
 * offer "this same page, in that language".
 *
 * External links, and anchors that must not be rewritten (RSS, the API, mailto),
 * keep using a plain `<a>` / `next/link`.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
