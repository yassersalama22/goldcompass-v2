"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics";

/**
 * Sends a GA4 page view on each client-side navigation.
 *
 * Keyed on the PATHNAME only, deliberately: the calculators rewrite the query
 * string on every input, and a query change is not a new page. The first render
 * is skipped because the bootstrap script already sent the landing page view
 * (and may not have defined `gtag` yet when this first runs).
 *
 * The `useEffect` runs after the router commits, but `document.title` can lag a
 * tick behind on soft navigation — the rAF lets the new <title> land first.
 */
export function GaPageViews() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = requestAnimationFrame(() => trackPageView());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
