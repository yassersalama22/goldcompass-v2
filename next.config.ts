import type { NextConfig } from "next";

// Content-Security-Policy. Everything the browser loads is same-origin
// (self-hosted next/font, no third-party scripts/images), so the policy is
// tight. `unsafe-inline` is required for scripts because Next injects an inline
// bootstrap script and we emit inline JSON-LD (<script type="application/ld+json">),
// and for styles because Next/Tailwind inject inline styles — there is no nonce
// pipeline. This is defense-in-depth: the app renders no user/model raw HTML, so
// there is no known injection sink. `img-src` allows https:/data: to leave room
// for OG/remote images later.
// challenges.cloudflare.com is Cloudflare Turnstile (bot check on the subscribe
// form): its script, the iframe it renders the widget in, and its callbacks.
// static.cloudflareinsights.com serves the Cloudflare Web Analytics beacon
// script; it reports page views back to cloudflareinsights.com.
const TURNSTILE = "https://challenges.cloudflare.com";
const CF_INSIGHTS_SCRIPT = "https://static.cloudflareinsights.com";
const CF_INSIGHTS_CONNECT = "https://cloudflareinsights.com";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${TURNSTILE} ${CF_INSIGHTS_SCRIPT}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  `connect-src 'self' ${TURNSTILE} ${CF_INSIGHTS_CONNECT}`,
  `frame-src ${TURNSTILE}`,
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // Redundant with CSP frame-ancestors, but covers legacy browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./src/content/**/*.json"],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [
      // Insights and Articles were merged into one hub (/insights). Permanently
      // redirect the old /articles routes so links and search rankings carry over.
      { source: "/articles", destination: "/insights", permanent: true },
      { source: "/articles/rss.xml", destination: "/insights/rss.xml", permanent: true },
      { source: "/articles/:slug", destination: "/insights/:slug", permanent: true },

      // Generated articles used to bake the publish date into the slug
      // (`2026-07-30-fed-holds-…`), which buried the keywords and permanently
      // dated the URL; one was also truncated mid-word (`…means-for-go`).
      // The date now lives only in the artifact filename. These five URLs were
      // indexed under the old scheme, so redirect them explicitly — a generic
      // date-stripping rule would miss the truncated one, whose new slug
      // differs by more than the prefix.
      {
        source: "/insights/2026-07-01-what-a-4-000-gold-price-really-means-for-everyday-investors",
        destination: "/insights/what-a-4-000-gold-price-really-means-for-everyday-investors",
        permanent: true,
      },
      {
        source: "/insights/2026-07-12-why-gold-slipped-this-week-even-as-u-s-iran-tensions-flared",
        destination: "/insights/why-gold-slipped-this-week-even-as-u-s-iran-tensions-flared",
        permanent: true,
      },
      {
        source: "/insights/2026-07-14-energy-driven-inflation-and-gold-what-rising-fuel-costs-mean",
        destination: "/insights/energy-driven-inflation-and-gold-what-rising-fuel-costs-mean",
        permanent: true,
      },
      {
        source: "/insights/2026-07-27-why-fed-rate-cuts-matter-for-gold-and-where-2026-stands",
        destination: "/insights/why-fed-rate-cuts-matter-for-gold-and-where-2026-stands",
        permanent: true,
      },
      {
        source: "/insights/2026-07-30-fed-holds-rates-again-what-warsh-s-hawkish-hold-means-for-go",
        destination: "/insights/fed-holds-rates-again-what-warsh-s-hawkish-hold-means-for-gold",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
