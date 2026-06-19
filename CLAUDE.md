# GoldCompass v2 — Project Guide

> This file is the source of truth for the GoldCompass rewrite. Read it at the start of
> every session. Keep it updated as decisions are made and phases complete.

## 1. What this project is

GoldCompass is a **gold-investing guidance platform** for everyday investors. It provides:

- **Market outlook / recommendations** — short-term (e.g. "SELL — next 30 days") and
  long-term (e.g. "BUY — next 12 months") calls with supporting rationale.
- **Live gold price tracking** — current XAU/USD spot price + interactive 30-day chart.
- **Smart Gold Calculator** — user enters a budget + gold purity; returns estimated
  quantity purchasable, break-even price (incl. dealer premiums), and profit/loss scenarios.
- **Market insights & articles** — curated news/analysis on gold markets, central banks, prices.
- **Accounts** (deferred) — personalized portfolio tracking, P/L monitoring, price alerts.

Existing site: https://goldcompass.app/ — built with Lovable AI as a client-rendered SPA.

### Why the rewrite

The current site is **not search-engine friendly** (client-rendered SPA → poor crawlability).
The rewrite must be **fully independent** (no Lovable lock-in) and is being built with Claude Code.

## 2. Primary goals (in priority order)

1. **SEO** — the whole point. Server-rendered/static HTML, proper metadata, structured data,
   sitemaps, fast indexing. Organic search traffic is the main acquisition channel.
2. **Performance** — superior Core Web Vitals (LCP, INP, CLS). Fast on mobile + slow networks.
3. **Responsive design** — mobile-first; works on all screen sizes.
4. **Accessibility** — WCAG 2.1 AA: semantic HTML, keyboard nav, ARIA, contrast, focus states.
5. **Ease of use** — clear IA, obvious CTAs, low-friction calculator.
6. **Low cost** — single smallest viable EC2 instance; offload work to caching/CDN/S3.

## 3. Tech stack (decided)

| Concern            | Choice                                              | Why |
|--------------------|-----------------------------------------------------|-----|
| Framework          | **Next.js (App Router) + TypeScript**               | SSR/SSG/ISR → great SEO + perf; React (familiar from Lovable) |
| Styling            | **Tailwind CSS**                                    | Fast, consistent, small CSS, easy responsive |
| UI components      | **shadcn/ui** (Radix primitives)                    | Accessible by default; matches current clean look; no runtime lock-in |
| Charts             | **Recharts** (or lightweight alt) — decide in Phase 3 | React-native, responsive |
| Data fetching      | Server Components + Route Handlers; `fetch` w/ caching | Keep data server-side for SEO + caching |
| Gold price source  | **CoinGecko (free)**, behind a `PriceProvider` interface | Free, low traffic; swappable later |
| Content/articles   | **Markdown/MDX in-repo** (Phase 4) — no CMS for now | Static, SEO-friendly, zero infra |
| Auth/DB            | **Deferred** — not in initial scope                 | Keeps tiny instance lean; ship public SEO pages first |
| Process/deploy     | **Docker** (Next.js standalone) + **Caddy or Nginx** reverse proxy | Reproducible; easy redeploy |
| CDN/cache/DNS/TLS  | **Cloudflare** in front of EC2                      | Edge caching, TLS, DDoS, free tier |
| Static assets      | **S3** for large/media assets where useful          | Offload bandwidth from the instance |
| Hosting            | **Single smallest viable EC2** (start small, e.g. t3/t4g.micro) | Cost; scale later if traffic grows |

> Note: Next.js SSR needs ~512MB+ RAM. t4g.nano (0.5GB) is risky; **t4g.micro / t3.micro (1GB)**
> is the realistic floor. Static export (`output: 'export'`) is an option for fully-static pages
> if we want to drop the Node server entirely for SEO pages — revisit at deploy time.

## 4. Architecture principles

- **Server-first**: render HTML on the server (RSC/SSG/ISR). Client JS only where interactivity
  is needed (calculator, live price ticker, charts). Keep client bundles small.
- **Caching layers**: (1) Next.js data cache / ISR revalidation, (2) Cloudflare edge cache,
  (3) server-side cache for upstream price API to respect rate limits.
- **Provider abstraction**: external data (gold price) sits behind a typed interface so the
  source can change without touching UI.
- **Static where possible**: articles, about, outlook pages should be statically generated and
  revalidated on a schedule (ISR) rather than rendered per-request.
- **Progressive enhancement**: core content readable without JS; interactivity layers on top.

## 5. Branding & visual identity

Match the current site's look and feel:

- **Concept**: gold + compass → trust, guidance, precision. Clean, professional, minimal.
- **Palette**: gold/amber accent over neutral (light) backgrounds; high-contrast text.
  *(Exact hex values to be sampled from the live site when building the design system — Phase 1.)*
- **Tone**: trustworthy, clear, educational. Prominent "educational only, not financial advice"
  disclaimers.
- **Logo**: "GoldCompass" wordmark (+ compass mark). Recreate/source assets in Phase 1.
- **Typography**: clean sans-serif; finalize in Phase 1 design system.

### Navigation (from current site)
- Header: **Outlook · Trends · Insights · Articles · About** + (deferred) Sign In
- Footer: Quick Links · Resources · Weekly Gold Updates (subscribe)

### Key CTAs
"View Full Analysis" · "Gold Calculator" · "Create My Free Account" (deferred) · "Subscribe"

## 6. SEO checklist (apply to every page)

- Unique `<title>` + meta description via Next.js Metadata API.
- Semantic headings (one `<h1>` per page), landmark elements.
- Open Graph + Twitter cards; canonical URLs.
- **Structured data (JSON-LD)**: Organization, WebSite (+ SearchAction), Article (for posts),
  FAQ where relevant, BreadcrumbList.
- `sitemap.xml` + `robots.txt` (Next.js metadata routes).
- Clean, descriptive, stable URLs.
- Server-rendered content (no critical content behind client-only JS).
- Image `alt` text; `next/image` for sizing/lazy-load.
- Fast LCP (optimize hero, fonts via `next/font`), good INP/CLS.

## 7. Performance checklist

- `next/font` (self-hosted, no layout shift), `next/image`, route-level code splitting.
- Minimize client components; prefer Server Components.
- ISR / static generation for content pages; short revalidate for price data.
- Cloudflare caching rules for static assets + cacheable HTML.
- Lighthouse / PageSpeed target: 90+ across Performance, SEO, Accessibility, Best Practices.

## 8. Accessibility checklist

- Keyboard-operable everything; visible focus rings.
- Color contrast ≥ 4.5:1 (text). Don't rely on color alone (esp. BUY/SELL signals).
- Form labels + error messaging on the calculator.
- `prefers-reduced-motion` respected for chart/animation.
- Test with axe / Lighthouse a11y audit each phase.

## 9. Phased roadmap — build piece by piece, test each

> Rule: **don't build everything at once.** Implement one phase, verify it works
> (build passes, manual check, Lighthouse), then move on. Update this file after each phase.

- **Phase 0 — Scaffold & design system**
  Next.js + TS + Tailwind + shadcn/ui init. Sample brand colors, set up tokens/theme,
  fonts, base layout (header/footer), responsive shell. Verify dev server + build.
- **Phase 1 — Home page**
  Hero, recommendations preview (short/long-term), price teaser, calculator teaser,
  insights teaser, CTAs, disclaimers. Full SEO metadata + JSON-LD. Lighthouse pass.
- **Phase 2 — Outlook / Recommendations page**
  Detailed short & long-term analysis. Static + ISR.
- **Phase 3 — Trends (live price + chart)**
  CoinGecko provider w/ server-side caching, live price ticker, 30-day interactive chart.
  Handle loading/error/stale states. Keep client bundle small.
- **Phase 4 — Articles / Insights**
  MDX-based articles, list + detail pages, Article JSON-LD, RSS optional.
- **Phase 5 — Smart Gold Calculator**
  Budget + purity inputs → quantity, break-even (w/ premiums), P/L scenarios.
  Accessible forms, client-side calc, shareable. Validate math thoroughly.
- **Phase 6 — About + legal/disclaimer + Subscribe**
  About page, disclaimer, newsletter subscribe (capture mechanism TBD).
- **Phase 7 — Deployment**
  Dockerize (standalone), reverse proxy (Caddy/Nginx), EC2 provisioning notes,
  Cloudflare DNS/cache/TLS, S3 for assets. Document the deploy runbook here.
- **Phase 8 — Auth & accounts (deferred / future)**
  Sign-in, portfolio tracking, P/L, price alerts. Revisit DB + instance sizing.

## 10. Conventions

- TypeScript strict. Prefer Server Components; mark client components with `"use client"` only
  when needed. Co-locate components; shared UI under `components/`.
- Keep secrets in env (`.env.local`, never committed). Document required vars in `.env.example`.
- Small, verifiable commits per feature. Run `next build` + lint before declaring a phase done.
- This is **not yet a git repo** — initialize in Phase 0.

## 11. Open questions / to confirm later

- Exact brand hex values + logo asset source (sample from live site in Phase 1).
- Newsletter "Subscribe" backend (e.g. a hosted service vs. self-managed) — Phase 6.
- Where recommendation content comes from (hand-authored vs. data-driven) — Phase 2.
- Chart library final choice — Phase 3.
- Final EC2 instance type + whether to go fully static export — Phase 7.

## 12. Status log

- 2026-06-19: Project kicked off. Decisions locked: defer auth, CoinGecko (abstracted),
  Docker + reverse proxy, Next.js + TS + Tailwind + shadcn/ui. CLAUDE.md created.
- 2026-06-19: **Phase 0 complete.** Scaffolded Next.js 16 (App Router, TS, Turbopack) +
  Tailwind v4 + shadcn/ui (base-nova / Base UI primitives, lucide icons). Stack details:
  - Fonts: Geist Sans (`--font-sans`) + Geist Mono (`--font-mono`) via `next/font`.
  - Design system in `src/app/globals.css`: gold primary palette (oklch), warm neutrals,
    dark mode, and brand/signal tokens `--gold`, `--bull` (BUY/green), `--bear` (SELL/red),
    exposed as Tailwind colors (`bg-gold`, `text-bull`, etc.).
  - Layout shell: `SiteHeader` (sticky, skip-link, `MainNav` desktop + `MobileNav` sheet,
    Gold Calculator CTA), `SiteFooter` (quick links / resources / newsletter teaser),
    `Logo` (inline compass SVG + wordmark), `Container` helper. Nav source: `src/config/site.ts`.
  - SEO foundation: root `metadata` (title template, OG/Twitter, robots, metadataBase via
    `NEXT_PUBLIC_SITE_URL`), `app/robots.ts`, `app/sitemap.ts` (8 routes).
  - Placeholder routes (`ComingSoon`) for /outlook, /trends, /insights, /articles, /about,
    /calculator + a real /disclaimer page — so nav has no dead links.
  - Verified: `next build` ✓ (all 13 routes prerendered **static**), `eslint` ✓, dev server
    serves SSR HTML with correct per-page `<title>`s, robots.txt + sitemap.xml (8 urls) ✓.
  - Not yet done (later): exact brand hex sampling from live site, OG image, favicon/app
    icons, dark-mode toggle, `next build` not yet containerized. Repo initialized by
    create-next-app but **not committed** (awaiting user go-ahead).
  - Next: **Phase 1 — Home page** (hero, recommendations/price/calculator/insights teasers,
    JSON-LD, Lighthouse pass).
