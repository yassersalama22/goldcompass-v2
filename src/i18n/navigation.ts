import { createElement, type ComponentProps } from "react";
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
const navigation = createNavigation(routing);

export const { redirect, usePathname, useRouter, getPathname } = navigation;

/**
 * The locale-aware `Link`, with **prefetching off by default** (decided with the
 * owner, 2026-11-11).
 *
 * Next.js prefetches every in-viewport link's flight data (`?_rsc=`). Here those
 * requests can't be edge-cached — the Cloudflare rule deliberately bypasses
 * anything with an `RSC` header, or flight payloads poison the HTML cache
 * (2026-07-27) — so every prefetch, clicked or not, is a render on a single
 * t4g.micro. With prefetch off, a click costs one origin request instead of
 * several speculative ones, while first loads still come from the edge cache.
 * The price is a short wait on in-site clicks instead of an instant swap.
 *
 * A call site can still opt in with `prefetch` explicitly. `false` disables both
 * viewport and hover prefetching in the App Router (next/link docs, 16.4).
 */
export function Link(props: ComponentProps<typeof navigation.Link>) {
  return createElement(navigation.Link, {
    ...props,
    prefetch: props.prefetch ?? false,
  });
}
