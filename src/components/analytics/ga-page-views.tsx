"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { currentPageLocation, trackPageView } from "@/lib/analytics";

/** Longest we wait for the new page's <title> before sending anyway. */
const TITLE_TIMEOUT_MS = 2000;

/**
 * Sends a GA4 page view on each client-side navigation.
 *
 * Keyed on the PATHNAME only, deliberately: the calculators rewrite the query
 * string on every input, and a query change is not a new page. The first render
 * is skipped because the bootstrap script already sent the landing page view
 * (and may not have defined `gtag` yet when this first runs).
 *
 * **Waits for the new <title>.** Next streams metadata, so the pathname commits
 * before the new <title> lands — on production it was still the old (or empty)
 * title a frame later, and GA's page-title report filed in-site navigations
 * under a blank row. We send once `document.title` changes, or after
 * TITLE_TIMEOUT_MS for pages that happen to share a title.
 *
 * The URL is captured up front, so a page view sent late (or flushed early
 * because the visitor navigated on) is still attributed to the page it was for.
 */
export function GaPageViews() {
  const pathname = usePathname();
  const first = useRef(true);
  const lastTitle = useRef("");

  useEffect(() => {
    if (first.current) {
      first.current = false;
      lastTitle.current = document.title;
      return;
    }

    const location = currentPageLocation();
    const previous = lastTitle.current;
    let sent = false;

    const send = () => {
      if (sent) return;
      sent = true;
      observer.disconnect();
      clearTimeout(timer);
      lastTitle.current = document.title;
      trackPageView(location, document.title);
    };

    const titleChanged = () => Boolean(document.title) && document.title !== previous;

    // React hoists <title> into <head>, but observe the whole document so a
    // title rendered elsewhere first is still seen.
    const observer = new MutationObserver(() => {
      if (titleChanged()) send();
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    const timer = setTimeout(send, TITLE_TIMEOUT_MS);
    if (titleChanged()) send();

    // Navigating on before the title arrived: send now rather than drop the
    // view — the captured URL is still right, only the title may be stale.
    return send;
  }, [pathname]);

  return null;
}
