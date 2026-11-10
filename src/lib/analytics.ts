/**
 * Google Analytics 4 — configuration and a client-safe event helper.
 *
 * GA4 is the only Google tag on the site. Google Ads conversions are IMPORTED
 * from GA4 key events (Ads → Goals → Conversions → Import → Google Analytics 4)
 * rather than measured by a second Ads tag: one script, one CSP allowance, one
 * consent configuration. Ads auto-tagging puts `gclid` on the landing URL and
 * GA4 attributes the session from it, once the two accounts are linked.
 *
 * Everything is gated on `NEXT_PUBLIC_GA_MEASUREMENT_ID`, a public value inlined
 * at BUILD time (Docker ARG → deploy.yml build-arg from a repo variable, the
 * same pattern as the Cloudflare beacon token). Unset = no script, no CSP
 * allowance, and `trackEvent` is a no-op — dev, CI and forks stay clean.
 */

/** `G-XXXXXXXXXX`, or undefined when analytics is off. */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || undefined;

/**
 * Regions where consent is required before analytics/ads storage: the EEA, the
 * UK and Switzerland (Google's EU user consent policy). We have no consent
 * banner, so visitors there stay at the "denied" default — GA4 then sends
 * cookieless pings only, and nothing is stored on their device.
 *
 * Everywhere else (including the Gulf, where the campaigns run) analytics and
 * ad measurement are granted by default. `ad_personalization` stays denied
 * everywhere: we do not run remarketing, so there is no reason to build ad
 * audiences from our visitors. Flip it deliberately if that ever changes, and
 * update the privacy page in the same PR.
 */
const CONSENT_REQUIRED_REGIONS = [
  // EEA
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES",
  "SE", "IS", "LI", "NO",
  // Outside the EEA, same policy
  "GB", "CH",
];

/**
 * Query parameters that may reach Google: ad-click identifiers and campaign
 * tags, which attribution needs. Everything else is dropped from the URL we
 * report — chiefly the calculators' inputs (budget, spot, premium), which they
 * mirror into the query string so a result can be shared. Those are a visitor's
 * own financial figures and have no business in an analytics property.
 */
const ATTRIBUTION_PARAM = "^(gclid|gbraid|wbraid|dclid|utm_[a-z_]+|gad_[a-z_]+)$";

/**
 * The inline bootstrap: consent defaults FIRST, then config, then the first
 * page view. All are pushed to `dataLayer`, which gtag.js drains in order when
 * it loads, so it does not matter whether this runs before or after the
 * library arrives.
 *
 * Region-specific defaults must precede the global default — gtag applies the
 * most specific matching region.
 *
 * Page views are sent manually (`send_page_view: false`) with a sanitized
 * `page_location`, never by GA4's history-change listener: the calculators call
 * `history.replaceState` on every input, so that listener would log a page view
 * per keystroke AND leak the inputs. **Turn off "Page changes based on browser
 * history events" in the GA4 web stream's enhanced-measurement settings** —
 * see the runbook in CLAUDE.md. Later page views come from `<GaPageViews>`.
 */
export function gaBootstrapScript(measurementId: string): string {
  const denied = {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  };
  const granted = {
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "denied",
    analytics_storage: "granted",
  };
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    "window.gtag=gtag;",
    // One implementation of the sanitizer, shared with <GaPageViews> via
    // window — so the first page view and later ones can never disagree.
    "window.__gcPageLocation=function(){",
    "var u=new URL(location.href),k=[],r=new RegExp(" + JSON.stringify(ATTRIBUTION_PARAM) + ");",
    "u.searchParams.forEach(function(_,n){if(!r.test(n))k.push(n);});",
    "k.forEach(function(n){u.searchParams.delete(n);});",
    "u.hash='';return u.toString();};",
    `gtag('consent','default',${JSON.stringify({ ...denied, region: CONSENT_REQUIRED_REGIONS })});`,
    `gtag('consent','default',${JSON.stringify(granted)});`,
    "gtag('js',new Date());",
    // `set` makes every later event (generate_lead, sign_up) inherit the
    // sanitized location too, not just the page view.
    "(function(l){",
    "gtag('set',{page_location:l});",
    `gtag('config',${JSON.stringify(measurementId)},{send_page_view:false});`,
    "gtag('event','page_view',{page_location:l,page_title:document.title});",
    "})(window.__gcPageLocation());",
  ].join("");
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    /** Defined by the bootstrap script; see `gaBootstrapScript`. */
    __gcPageLocation?: () => string;
  }
}

/**
 * Record a client-side navigation as a page view. The initial page view is sent
 * by the bootstrap script, so callers skip the first render.
 */
export function trackPageView(): void {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return;
  const location = window.__gcPageLocation?.();
  if (!location || !window.gtag) return;
  try {
    window.gtag("set", { page_location: location });
    window.gtag("event", "page_view", {
      page_location: location,
      page_title: document.title,
    });
  } catch {
    // See trackEvent.
  }
}

/**
 * Send a GA4 event. A no-op when analytics is off or the tag has not loaded
 * (an ad blocker, a failed request) — tracking must never break the page.
 *
 * Never pass personal data (email addresses, names) as parameters: GA4's terms
 * forbid it, and the privacy page says we do not.
 */
export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return;
  try {
    window.gtag?.("event", name, params ?? {});
  } catch {
    // Swallow: analytics is never worth an error on the page.
  }
}
