import type { NextConfig } from "next";

// Content-Security-Policy. Everything the browser loads is same-origin
// (self-hosted next/font, no third-party scripts/images), so the policy is
// tight. `unsafe-inline` is required for scripts because Next injects an inline
// bootstrap script and we emit inline JSON-LD (<script type="application/ld+json">),
// and for styles because Next/Tailwind inject inline styles — there is no nonce
// pipeline. This is defense-in-depth: the app renders no user/model raw HTML, so
// there is no known injection sink. `img-src` allows https:/data: to leave room
// for OG/remote images later.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
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
    // Insights and Articles were merged into one hub (/insights). Permanently
    // redirect the old /articles routes so links and search rankings carry over.
    return [
      { source: "/articles", destination: "/insights", permanent: true },
      { source: "/articles/rss.xml", destination: "/insights/rss.xml", permanent: true },
      { source: "/articles/:slug", destination: "/insights/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
