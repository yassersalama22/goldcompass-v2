"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Fires one GA4 event when the page it sits on is viewed. Renders nothing.
 *
 * `oncePerSession` guards against reloads and back-navigation double counting
 * (best effort — storage can be unavailable, in which case the event still
 * fires). Pair it with "count: one per click" on the imported Google Ads
 * conversion, which is the authoritative dedupe.
 */
export function TrackOnMount({
  event,
  params,
  oncePerSession = false,
}: {
  event: string;
  params?: Record<string, string | number | boolean>;
  oncePerSession?: boolean;
}) {
  useEffect(() => {
    const key = `gc-tracked:${event}`;
    if (oncePerSession) {
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        // Storage blocked (private mode) — fall through and fire.
      }
    }
    trackEvent(event, params);
    // Fire once per mount; params are static literals at the call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
