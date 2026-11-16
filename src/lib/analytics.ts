/**
 * Google Analytics 4 — configuration, consent, and a client-safe event helper.
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
 * allowance, no consent prompt, and `trackEvent` is a no-op — dev, CI and forks
 * stay clean.
 */

/** `G-XXXXXXXXXX`, or undefined when analytics is off. */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || undefined;

/**
 * Regions where consent is required before analytics/ads storage: the EEA, the
 * UK and Switzerland (Google's EU user consent policy).
 *
 * Visitors there are ASKED (`<ConsentBanner>`), and until they accept, Google's
 * tag is **not loaded at all** ("basic" consent mode): no request, no IP, no
 * page address reaches Google. Declining keeps it that way. Owner decision,
 * 2026-11-16 — the earlier "advanced" mode sent cookieless pings without
 * consent, which some EU regulators consider to need consent too.
 *
 * Everywhere else (including the Gulf, where the campaigns run) the tag loads
 * with analytics and ad measurement granted by default, as before; the footer's
 * "Cookie settings" lets anyone opt out. `ad_personalization` stays denied
 * everywhere: we do not run remarketing, so there is no reason to build ad
 * audiences from our visitors. Changing any of this is a privacy-page change in
 * the same PR.
 */
const CONSENT_REQUIRED_REGIONS = [
  // EEA
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES",
  "SE", "IS", "LI", "NO",
  // Outside the EEA, same policy
  "GB", "CH",
  // Cloudflare's "unknown" and "Tor" codes: we cannot tell, so we ask.
  "XX", "T1",
];

/** localStorage: the visitor's explicit choice, "granted" | "denied". */
export const CONSENT_STORAGE_KEY = "gc-consent";
/** sessionStorage: cached region lookup, "ask" | "free". */
export const REGION_STORAGE_KEY = "gc-region";

/**
 * Query parameters that may reach Google: ad-click identifiers and campaign
 * tags, which attribution needs. Everything else is dropped from the URL we
 * report — chiefly the calculators' inputs (budget, spot, premium), which they
 * mirror into the query string so a result can be shared. Those are a visitor's
 * own financial figures and have no business in an analytics property.
 */
const ATTRIBUTION_PARAM = "^(gclid|gbraid|wbraid|dclid|utm_[a-z_]+|gad_[a-z_]+)$";

/**
 * Consent states, as the banner sees them:
 * - `pending`  — deciding (region lookup in flight). Nothing shown, nothing sent.
 * - `ask`      — consent required and not yet given: the banner is shown.
 * - `free`     — outside the consent regions, no explicit choice: tag running.
 * - `granted`  — the visitor accepted: tag running.
 * - `denied`   — the visitor declined: tag never loaded (or disabled).
 */
export type ConsentState = "pending" | "ask" | "free" | "granted" | "denied";

/** The controller the bootstrap installs on `window.__gcConsent`. */
export interface ConsentController {
  getState(): ConsentState;
  /** The stored explicit choice, independent of whether the banner is open. */
  getChoice(): "granted" | "denied" | null;
  subscribe(listener: () => void): () => void;
  grant(): void;
  deny(): void;
  /** Re-open the banner (footer "Cookie settings"). */
  open(): void;
}

/**
 * The inline bootstrap (`beforeInteractive`). It decides, before any client
 * component mounts, whether Google's tag may load — and loads it only then.
 *
 * **`gtag()` buffers until consent is settled.** Every caller (`trackEvent`,
 * `<GaPageViews>`, this script's own landing page view) calls `window.gtag`,
 * which holds commands in memory — they never leave the device — until the tag
 * starts. Starting pushes the consent defaults, `js` and `config` FIRST, then
 * the buffered commands, so a visitor who accepts mid-visit still gets their
 * landing page view (with its `gclid`) counted, and nothing reaches Google
 * before they accept. A denial drops the buffer and turns `gtag` into a no-op.
 *
 * **Region lookup without breaking the edge cache.** The HTML is identical for
 * every visitor and cached at Cloudflare, so the server cannot vary it by
 * country. Instead the browser asks Cloudflare's own `/cdn-cgi/trace`, which
 * every proxied zone answers AT THE EDGE (never reaching the EC2 box; same
 * origin, so no CSP change) with `loc=<ISO country>`. The answer is cached in
 * sessionStorage. Any failure — no Cloudflare in front (local dev), a blocked
 * request, an unparseable body — **fails closed to `ask`**: a non-EU visitor
 * seeing the prompt is a small cost; an EU visitor tracked without consent is
 * the thing being prevented. `/cdn-cgi/trace` is not a documented API — if
 * Cloudflare ever drops it, everyone gets asked, nothing breaks.
 *
 * The consent defaults (denied for the consent regions by Google's own geo,
 * granted elsewhere) are still pushed on start: if Cloudflare and Google ever
 * disagree about where a visitor is, Google's side errs towards denied. An
 * explicit choice is pushed as a `consent update`, which overrides both.
 *
 * gtag.js itself is injected after the window `load` event, so it never
 * competes with the page's own resources (it was `afterInteractive` before).
 *
 * Page views are sent manually (`send_page_view: false`) with a sanitized
 * `page_location`, never by GA4's history-change listener: the calculators call
 * `history.replaceState` on every input, so that listener would log a page view
 * per keystroke AND leak the inputs. **Turn off "Page changes based on browser
 * history events" in the GA4 web stream's enhanced-measurement settings** —
 * see the runbook in CLAUDE.md. Later page views come from `<GaPageViews>`.
 *
 * Hand-written ES5 on purpose: this string is not transpiled, and it runs
 * before anything else on the page.
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
  const j = JSON.stringify;
  return [
    "(function(){",
    `var ID=${j(measurementId)},REGIONS=${j(CONSENT_REQUIRED_REGIONS)};`,
    `var CK=${j(CONSENT_STORAGE_KEY)},RK=${j(REGION_STORAGE_KEY)};`,
    `var DENIED=${j(denied)},GRANTED=${j(granted)};`,
    "var w=window,d=document,dl=w.dataLayer=w.dataLayer||[];",
    "var q=[],live=false,injected=false,off=false,state='pending',subs=[];",
    "function push(){dl.push(arguments);}",
    "function gtag(){if(off)return;if(live)dl.push(arguments);else q.push(arguments);}",
    "w.gtag=gtag;",
    // One implementation of the sanitizer, shared with <GaPageViews> via
    // window — so the first page view and later ones can never disagree.
    "w.__gcPageLocation=function(){",
    "var u=new URL(location.href),k=[],r=new RegExp(" + j(ATTRIBUTION_PARAM) + ");",
    "u.searchParams.forEach(function(_,n){if(!r.test(n))k.push(n);});",
    "k.forEach(function(n){u.searchParams.delete(n);});",
    "u.hash='';return u.toString();};",
    "function get(s,k){try{return w[s].getItem(k);}catch(e){return null;}}",
    "function put(s,k,v){try{w[s].setItem(k,v);}catch(e){}}",
    "function set(s){state=s;for(var i=0;i<subs.length;i++){try{subs[i]();}catch(e){}}}",
    "function inject(){if(injected||!live)return;injected=true;var s=d.createElement('script');s.async=true;",
    "s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(ID);d.head.appendChild(s);}",
    "function start(explicit){",
    "w['ga-disable-'+ID]=false;off=false;",
    "if(live){if(explicit)push('consent','update',GRANTED);return;}",
    "live=true;",
    "var dd={};for(var k in DENIED)dd[k]=DENIED[k];dd.region=REGIONS;",
    "push('consent','default',dd);push('consent','default',GRANTED);",
    "if(explicit)push('consent','update',GRANTED);",
    "push('js',new Date());push('config',ID,{send_page_view:false});",
    "for(var i=0;i<q.length;i++)dl.push(q[i]);q=[];",
    "if(d.readyState==='complete')inject();else w.addEventListener('load',inject);}",
    // Withdrawal: if gtag.js has not been injected yet (still waiting for
    // `load`), nothing has left the device — empty the queue and stand down,
    // so `inject` becomes a no-op. Otherwise GA's documented kill switch stops
    // further hits and the update covers anything it still holds. The
    // first-party cookies are removed at every domain level GA may have used.
    "function stop(){off=true;q=[];w['ga-disable-'+ID]=true;",
    "if(live&&!injected){dl.length=0;live=false;}",
    "else if(live)push('consent','update',DENIED);",
    "var h=location.hostname.split('.'),ds=[''];",
    "for(var i=0;i<h.length-1;i++)ds.push(';domain=.'+h.slice(i).join('.'));",
    "d.cookie.split(';').forEach(function(c){var n=c.split('=')[0].trim();",
    "if(/^(_ga|_gid|_gcl_)/.test(n))ds.forEach(function(x){d.cookie=n+'=;Max-Age=0;path=/'+x;});});}",
    "function decide(r){if(r==='free'){start(false);set('free');}else set('ask');}",
    "w.__gcConsent={",
    "getState:function(){return state;},",
    "getChoice:function(){var c=get('localStorage',CK);return c==='granted'||c==='denied'?c:null;},",
    "subscribe:function(f){subs.push(f);return function(){subs=subs.filter(function(g){return g!==f;});};},",
    "grant:function(){put('localStorage',CK,'granted');start(true);set('granted');},",
    "deny:function(){put('localStorage',CK,'denied');stop();set('denied');},",
    "open:function(){set('ask');}};",
    // The landing page view: buffered like everything else.
    "(function(l){gtag('set',{page_location:l});",
    "gtag('event','page_view',{page_location:l,page_title:d.title});",
    "})(w.__gcPageLocation());",
    "var c=get('localStorage',CK);",
    "if(c==='granted'){start(true);set('granted');}",
    "else if(c==='denied'){off=true;q=[];set('denied');}",
    "else{var r=get('sessionStorage',RK);",
    "if(r==='ask'||r==='free')decide(r);",
    "else if(!w.fetch)decide('ask');",
    "else fetch('/cdn-cgi/trace',{cache:'no-store',credentials:'omit'})",
    ".then(function(res){return res.ok?res.text():'';})",
    ".then(function(t){var m=/(?:^|\\n)loc=([A-Z0-9]{2})/.exec(t);",
    "if(!m){decide('ask');return;}",
    "var r=REGIONS.indexOf(m[1])<0?'free':'ask';put('sessionStorage',RK,r);decide(r);},",
    "function(){decide('ask');});}",
    "})();",
  ].join("");
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    /** Defined by the bootstrap script; see `gaBootstrapScript`. */
    __gcPageLocation?: () => string;
    /** Defined by the bootstrap script; see `gaBootstrapScript`. */
    __gcConsent?: ConsentController;
  }
}

/** The consent controller, or undefined when analytics is off (or on the server). */
export function consentController(): ConsentController | undefined {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return undefined;
  return window.__gcConsent;
}

/** The sanitized URL of the current page, or undefined when analytics is off. */
export function currentPageLocation(): string | undefined {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return undefined;
  return window.__gcPageLocation?.();
}

/**
 * Record a client-side navigation as a page view. The initial page view is sent
 * by the bootstrap script, so callers skip the first render. `location` comes
 * from `currentPageLocation()` captured when the navigation happened.
 *
 * Goes through `window.gtag`, so it is buffered or dropped by the consent logic
 * exactly like every other command.
 */
export function trackPageView(location: string | undefined, title: string): void {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return;
  if (!location || !window.gtag) return;
  try {
    window.gtag("set", { page_location: location });
    window.gtag("event", "page_view", {
      page_location: location,
      page_title: title,
    });
  } catch {
    // See trackEvent.
  }
}

/**
 * Send a GA4 event. A no-op when analytics is off or declined, and buffered
 * on the device until the visitor decides when consent is still pending —
 * tracking must never break the page.
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
