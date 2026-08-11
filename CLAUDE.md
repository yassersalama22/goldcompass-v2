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

- **API-first / headless core (web + future mobile)** — **RULE.** All dynamic/data-driven
  functionality (recommendations, prices, later articles) is built as a headless core that can
  serve **multiple clients**: this website *and* a possible future mobile app or third party.
  Concretely:
  - A central **data-access layer** (`src/server/<domain>/`) returns typed domain objects. It is
    the single source of truth and contains all business logic.
  - The **website** (Server Components) calls the data-access layer **directly** for SSR/ISR — no
    HTTP hop to our own API — so SEO + performance stay optimal.
  - The **same** core is exposed via **versioned public JSON endpoints** (`/api/v1/...`, Route
    Handlers) for non-web clients (mobile app, etc.). These are thin wrappers over the data layer.
  - **Shared contract**: domain **types live in `src/types/` (or `src/server/<domain>/types.ts`)**
    and define the JSON shape once. The generated recommendation artifact *is* this contract.
    Endpoints are versioned; responses are cache-friendly (Cloudflare) and CORS-enabled for
    non-web clients. Never leak DB/internal fields; expose only the public contract.
  - Rule of thumb: **UI never talks to an external/source API directly** — it goes through the
    data-access layer, which both the web and `/api/v1` consume.
- **Server-first**: render HTML on the server (RSC/SSG/ISR). Client JS only where interactivity
  is needed (calculator, live price ticker, charts). Keep client bundles small.
- **Caching layers**: (1) Next.js data cache / ISR revalidation, (2) Cloudflare edge cache,
  (3) server-side cache for upstream price API to respect rate limits.
- **Provider abstraction**: external data (gold price) sits behind a typed interface so the
  source can change without touching UI.
- **Static where possible**: articles, about, outlook pages should be statically generated and
  revalidated on a schedule (ISR) rather than rendered per-request.
- **Progressive enhancement**: core content readable without JS; interactivity layers on top.
- **Forward the visitor's IP to third-party services** — **RULE.** Production is a *single* EC2
  box behind one Elastic IP, fronted by Cloudflare. Every server-side outbound call therefore
  originates from that one address, so any upstream doing per-IP abuse scoring or rate limiting
  sees **all** our users as one client. Left unhandled this fails closed and *all at once* —
  one flagged IP blocks every user, not a subset. So: whenever an upstream accepts a client-IP
  field, pass the real visitor IP through the data-access layer (`getClientIp(request)` in
  `src/server/rate-limit.ts`, which prefers `CF-Connecting-IP` → `X-Forwarded-For`). Omit the
  field when the IP is unknown rather than sending a placeholder. Precedent:
  `NewsletterProvider.subscribe(email, { ip })` → Buttondown `ip_address`.
  Corollary: never "fix" an upstream IP block by allowlisting the Elastic IP — that disables the
  upstream's abuse filter for the entire site. Our own defenses (rate limit, honeypot, Turnstile)
  are per-visitor and must carry that load instead.

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
  Detailed short & long-term analysis. **Reads from the typed content/data-access layer**
  (headless core — see §4 + §12), not hard-coded in the UI. Seed today's content manually as a
  structured artifact matching the contract. Render prose + signal cards + key levels + sources +
  "last updated" + methodology link. Static + ISR. Also expose the read model at `/api/v1`.
- **Phase 3 — Trends (live price + chart)**
  CoinGecko provider w/ server-side caching, live price ticker, 30-day interactive chart.
  Handle loading/error/stale states. Keep client bundle small. Exposed via the same data layer +
  `/api/v1/price`.
- **Phase 3.5 — Recommendation engine pipeline (Aureus v2)**
  The automated generation pipeline that produces the Phase 2 artifact (see §12 for full design).
  Depends on the Phase 3 price feed (deterministic data → grounds the LLM). Off-request-path
  scheduled job → structured output → validate/sanitize → draft → human approve → revalidate.
- **Phase 4 — Articles / Insights** ✅ (see §13 status log 2026-06-23)
  Article contract + Git-as-CMS JSON artifacts, list + detail pages, Article JSON-LD, RSS,
  `/api/v1/articles`, and an Aureus-style generation pipeline (web-grounded, cited sources).
- **Phase 5 — Smart Gold Calculator**
  Budget + purity inputs → quantity, break-even (w/ premiums), P/L scenarios.
  Accessible forms, client-side calc, shareable. Validate math thoroughly.
- **Phase 6 — About + legal/disclaimer + Subscribe**
  About page, disclaimer, newsletter subscribe (capture mechanism TBD).
- **Phase 7 — Deployment** ✅ (see §13 status log 2026-07-01)
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
- Recommendation engine **built** (§12 + §13 Phase 3.5). LLM provider = **Claude
  `claude-opus-4-8`** with the `web_search_20260209` tool; needs `ANTHROPIC_API_KEY` for real runs.
- Chart library **decided**: custom lightweight SVG (no chart dep) — see §13 Phase 3.
- Final EC2 instance type + whether to go fully static export — **decided**: Docker standalone on **t4g.micro** (1GB RAM + 2GB swap). Static export not needed; standalone mode handles ISR/API routes.

## 12. Recommendation engine (Aureus v2) — design

> Replaces the old Supabase/Lovable "Aureus" pipeline (pg_cron → edge fn → Gemini+grounding →
> regex "sanitize" → 2nd LLM extract → Postgres). That design is **not** ported as-is. Reasons:
> it's Supabase/Lovable-bound; its HTML "sanitizer" is **not** XSS-safe (regex fence/chatter
> stripping only) which + web grounding = stored-XSS/prompt-injection risk; it trusts the LLM for
> hard numbers (price/DXY/yields); stores raw model HTML (design/SEO/safety issues); per-language
> independent generations can disagree; and it auto-publishes financial calls (YMYL/trust risk).

**Accepted design (decisions locked):**

- **Headless / API-first** (per §4): pipeline output is a typed artifact = the public contract;
  web reads it via the data-access layer, `/api/v1` serves it to other clients.
- **Separate retrieval from reasoning**: fetch hard data deterministically (spot price + change
  from the Phase 3 price feed; later DXY/yields) and **inject it into the prompt as ground truth**.
  The LLM does analysis/narrative on top — it does not invent the numbers.
- **Single structured output** (prefer one call): `{ analysisMarkdown, shortTerm{call,reason,
  confidence,invalidationLevel}, longTerm{...}, keyLevels, sources[] }`. Avoids the fragile
  2nd-model extraction (fall back to the 2-call split only if grounding + structured output can't
  co-exist in the chosen API).
- **Store Markdown/structured JSON, not model HTML.** Render through our own components for design
  consistency + SEO. If any HTML is ever rendered, use a real allowlist sanitizer (e.g.
  sanitize-html/DOMPurify) — never the old regex approach.
- **Publishing = draft → human approve → publish** (decided). Protects trust/legal + YMYL SEO
  (E-E-A-T). Show "last updated", source citations, and a methodology page.
- **Storage = Git-as-CMS** (decided): pipeline commits the JSON/MDX artifact to the repo; Next.js
  renders statically; revalidate on publish. (S3 object is the fallback if volume grows.)
- **Cadence = hybrid** (decided): short-term refreshed ~daily, long-term ~weekly. Off the request
  path (scheduler: GitHub Actions cron preferred → no always-on cost; system cron on EC2 is the
  alt). Job generates → validates against schema → (human approve) → commits → pings on-demand
  revalidation (`revalidatePath`) → purge Cloudflare path.
- **LLM provider = TBD**: research current best (Claude w/ web-search + structured output vs Gemini
  grounding vs other) before committing. Keep generation behind a provider interface so it's
  swappable, mirroring the price-provider abstraction.
- **Resilience** (keep from v1): on any failure, keep the previous published artifact; alert.
- **i18n** (future): generate ONE canonical analysis, then **translate** (so all languages share
  the same calls/data). New site is English-only initially.

## 13. Status log

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
- 2026-06-19: **Phase 1 complete.** Home page built and verified.
  - Sections (`src/components/home/`): `Hero`, `RecommendationsSection` (short/long-term
    BUY/SELL cards w/ `SignalBadge`), `FeaturesSection` (Trends + Calculator teasers),
    `InsightsSection` (3 featured cards, stretched-link), `CtaSection`.
  - Content data: `src/data/recommendations.ts` (SELL 30d / BUY 12m) and `src/data/insights.ts`
    (placeholder teasers; real MDX in Phase 4). Insight cards link to `/insights` until Phase 4.
  - SEO: per-page `metadata` + `alternates.canonical` on ALL pages (home `/`, sub-pages own
    path — verified emitted). JSON-LD Organization + WebSite via `JsonLd` + `lib/structured-data.ts`.
    Branded `app/icon.svg` (compass) replaces default favicon; default `favicon.ico` removed.
  - **Accessibility (color contrast verified numerically)** via `scripts/check-contrast.mjs`
    (oklch→sRGB WCAG calc). Findings + fixes: bright `--gold` (2.48:1) is decorative/brand-only;
    added `--gold-strong` (light 6.62:1, dark 10.88:1) for all functional gold text/links + hero
    accent; darkened `--bull` to L0.52 so white badge text passes (5.15:1); `--bear` 4.74:1,
    gold button dark-on-gold 6.90:1, muted-fg 5.44:1 — all PASS. **Pattern: never use `text-gold`
    for small text on light bg — use `text-gold-strong`.**
  - Verified: `next build` ✓ (all static), `eslint` ✓, SSR HTML has all sections, single `<h1>`,
    valid JSON-LD (Organization+WebSite), canonicals per page, icon.svg serves.
  - TODO later: exact brand hex sampling from live site; OG image; real Lighthouse/axe run in a
    browser (contrast done; need keyboard/screenreader pass); footer column headings are `<h2>`
    (reconsider heading hierarchy if needed).
  - Next: **Phase 2 — Outlook / Recommendations page** (detailed analysis, static + ISR).
- 2026-06-20: **Recommendation-engine redesign + API-first rule decided.** Reviewed the old
  Supabase/Lovable "Aureus" pipeline (`support_files/`). Added the **API-first / headless core
  rule** (§4) — all dynamic content serves both web and a possible future mobile app via a shared
  typed contract + versioned `/api/v1`. Recorded the Aureus v2 design (§12): deterministic data →
  single grounded structured LLM call → markdown/JSON (no model HTML) → draft→approve → Git-as-CMS
  artifact → ISR revalidate; hybrid cadence; provider TBD (research first). Roadmap updated: Phase
  2 reads the typed content layer; new **Phase 3.5** = the pipeline (depends on Phase 3 price feed).
  Next: build **Phase 2** against the content contract.
- 2026-06-20: **Phase 2 complete.** Outlook page built the headless/API-first way.
  - **Contract**: `src/types/outlook.ts` — zod schema is the single source of truth, TS types
    inferred (`OutlookReport`, `OutlookCall`, `KeyLevel`, `Source`, `Signal`, `Confidence`);
    `CONTRACT_VERSION = 1`. This shape = the artifact = the API response = future LLM output.
  - **Data-access layer**: `src/server/outlook/` (`server-only`, React `cache()`) —
    `getCurrentOutlook()` / `getPublishedOutlook()` load + zod-validate the artifact. Web + API
    both go through here; UI never reads the artifact directly. Swapping Git→S3/DB later = this
    module only.
  - **Artifact (Git-as-CMS)**: `src/content/outlook/current.json` — hand-seeded English content
    (`origin: editorial`, spot ≈ $4,160, SELL short / BUY long), validated against the schema.
  - **Page** `/outlook` (`src/app/outlook/page.tsx`, ISR `revalidate=1800`): header w/ spot +
    signed change, `KeyLevels` grid, two `OutlookCallCard`s (signal/confidence/reason/invalidation),
    full analysis via **react-markdown + remark-gfm** (safe — builds React elements, NOT
    `dangerouslySetInnerHTML`; styled to design system), sources list, methodology box, disclaimer.
    `AnalysisNewsArticle` JSON-LD + `generateMetadata` (summary as description, OG article).
  - **Public API**: `GET /api/v1/recommendations` → `{ data: OutlookReport }`, `Cache-Control:
    public, s-maxage=1800, swr=3600`, CORS `*`, `OPTIONS` preflight. (Mobile-ready surface.)
  - **Refactor**: home `RecommendationsSection` now reads `getPublishedOutlook()` (single source of
    truth); deleted `src/data/recommendations.ts`; moved `SignalBadge` → `src/components/market/`.
  - Deps added: `zod`, `react-markdown`, `remark-gfm`. Verified: `next build` ✓ (/outlook static
    +ISR, api dynamic), `eslint` ✓, SSR HTML has h1/spot/SELL/BUY/analysis/JSON-LD/methodology,
    API returns valid JSON+headers, home teaser reads new data, contrast (bull 5.07:1 / bear
    4.67:1 as text) PASS.
  - TODO later: wire Phase 3.5 pipeline to write this artifact; richer methodology page; OG image.
  - Next: **Phase 3 — Trends (live price + chart)**.
- 2026-06-20: **Phase 3 complete.** Live gold price + 30-day chart, headless/API-first.
  - **Provider abstraction**: `src/server/price/provider.ts` (`PriceProvider`) +
    `coingecko.ts` (CoinGecko free API, **PAX Gold / PAXG** as the gold spot proxy; zod-validates
    upstream; `fetch` w/ `next.revalidate` — quote 300s, series 3600s — so one upstream call per
    window respects free rate limits). Swap provider in one place to change source.
  - **Data-access layer**: `src/server/price/index.ts` (`server-only`, cached) — `getGoldQuote()`
    / `getGoldSeries30d()` return a `PriceResult<T>` ({ ok, data, stale, fetchedAt }) and **never
    throw** → static builds + offline dev degrade gracefully instead of failing.
  - **Contract**: `src/types/price.ts` (zod-authoritative): `PriceQuote`, `PricePoint` (t=ms),
    `PriceSeries` (30d), `PriceResult`. `PRICE_CONTRACT_VERSION = 1`.
  - **Public API**: `GET /api/v1/price` → `{ data:{ quote, series }, meta:{ fetchedAt, stale } }`,
    cache + CORS, 503 only if both fail. (Mobile-ready.)
  - **Chart** (decided: **custom lightweight SVG, no chart dep** — perf/bundle): 
    `price-chart.tsx` — responsive `viewBox` + `non-scaling-stroke`, area
    gradient, bull/bear color by trend. **SSR-rendered** (polyline in initial HTML → SEO, no-JS,
    no CLS). Client adds hover crosshair + % -positioned tooltip. A11y: `role=img` summary +
    `sr-only` data table. `touch-none` for pointer.
  - **Ticker** `components/trends/price-ticker.tsx` (client): SSR-seeded, polls `/api/v1/price`
    every 60s **only while tab visible**, `aria-live` price, Live/Delayed/Offline pill
    (`animate-ping` w/ `motion-reduce:animate-none`).
  - **Page** `/trends` (ISR `revalidate=300`): SSR quote+series, ticker + chart, graceful
    "unavailable" states, source attribution + disclaimer, CTAs. `src/lib/format.ts` added.
  - Verified offline: `next build` ✓ (/trends static+ISR, fallback path), `eslint` ✓. Verified
    **live** (sandbox off): API real data ($4,147, 31 pts, stale=false, headers ✓); `/trends` SSR
    HTML has h1/price/`<svg>`/`<polyline>`/sr-only table/source/status pill.
  - Note: network egress (CoinGecko, git push) is sandboxed — run those with sandbox disabled.
  - Next: **Phase 3.5 — Recommendation pipeline** (now unblocked by the price feed) or **Phase 4
    — Articles/Insights**. Decide with user.
- 2026-06-20: **Phase 3.5 complete.** Aureus v2 recommendation pipeline built.
  - **Generator abstraction**: `src/server/outlook/generator/` — `OutlookGenerator` interface +
    `claude.ts` (Anthropic SDK, **`claude-opus-4-8`** + `web_search_20260209` grounding, adaptive
    thinking; returns a single JSON object that's **zod-validated with one corrective retry** —
    sidesteps web-search↔structured-output compatibility) and `mock.ts` (deterministic, offline).
    `index.ts` selects by env: Claude when `ANTHROPIC_API_KEY` set, else mock. Lazy-imports the SDK.
  - **Separation of concerns**: deterministic price (CoinGecko) is fed to the prompt as ground
    truth; the LLM only does analysis. Contract `generator/schema.ts` (`GeneratedOutlook`) reuses
    the outlook contract pieces. Versioned prompt `prompt.ts` (`PROMPT_VERSION`). `sanitize.ts`
    strips HTML from markdown (defense-in-depth vs the old engine's stored-HTML/XSS gap).
  - **Git-as-CMS scripts** (run via `tsx`, npm `outlook:generate` / `outlook:publish`):
    `scripts/generate-outlook.mts` (fetch price → generate → sanitize → assemble full
    `OutlookReport` origin=generated/status=draft → zod-validate → write `draft.json`),
    `publish-outlook.mts` (draft→`current.json`, status=published). `draft.json` is gitignored
    (intermediate); `current.json` is the live artifact.
  - **Human-approval gate** = **GitHub Actions PR**: `.github/workflows/daily-outlook.yml` (06:00
    UTC cron + manual) runs generate+publish, opens a PR via `peter-evans/create-pull-request`;
    merging publishes. Inert/mock until `ANTHROPIC_API_KEY` secret is added.
  - **On-demand revalidation**: `POST /api/revalidate?secret=…` (`REVALIDATE_SECRET`) →
    `revalidatePath('/outlook','/')` so a publish refreshes static pages without full redeploy.
  - Deps: `@anthropic-ai/sdk`, `tsx` (dev). `tsx` resolves the `@/` alias natively. `.env.example`
    documents `ANTHROPIC_API_KEY` / `OUTLOOK_MODEL` / `OUTLOOK_GENERATOR` / `REVALIDATE_SECRET`.
  - Verified: pipeline ran end-to-end with **mock + live CoinGecko** → validated draft
    (short=SELL/long=BUY), publish promoted it; editorial seed restored (no mock content live).
    `next build` ✓ (Claude SDK code + `.mts` scripts type-check), `eslint` ✓.
  - **TODO before going live**: add `ANTHROPIC_API_KEY` (GitHub secret + `.env.local`), do a real
    run and review output quality, set `REVALIDATE_SECRET`, optionally tune cron / hybrid cadence
    (currently full daily regen) and the prompt. Then merge a real PR to publish.
  - Next: **Phase 4 — Articles/Insights** (MDX), or Phase 5 (Calculator).
- 2026-06-20: **Phase 3.5 follow-ups** (first real CI run feedback).
  - First manual GH Actions run cost **$0.89** (Opus 4.8 + high-effort thinking + web search).
    Added cost tuning: `output_config.effort` default **medium** (env `OUTLOOK_EFFORT`), web-search
    `max_uses` 6→**4** (env `OUTLOOK_WEB_SEARCH_MAX_USES`), and `OUTLOOK_MODEL` can be Sonnet 4.6
    (~2× cheaper). Deduped the two `messages.create` calls. ~$0.40/run expected at medium; Sonnet
    ~$0.15–0.25. ~$27/mo → ~$6–12/mo.
  - Bumped actions to Node-24 majors: `checkout@v6`, `setup-node@v5`, `create-pull-request@v8`.
  - Workflow is **manual-only for now** (`workflow_dispatch`); the daily `cron` is commented out —
    re-enable after release.
  - **PR-creation error fix is a REPO SETTING (not code):** GitHub → Settings → Actions → General →
    Workflow permissions → enable "Allow GitHub Actions to create and approve pull requests". The
    workflow already requests `pull-requests: write`; this org/repo toggle gates it.
- 2026-06-23: **Phase 4 complete.** Articles/Insights — unified content system + generation pipeline.
  - **Decision**: ONE Articles store + pipeline. `/articles` = full archive; `/insights` = curated
    latest view (top 6); home "Market insights" section reads the 3 most recent. No duplicate infra.
  - **Contract**: `src/types/article.ts` (zod-authoritative): `Article` / `ArticleSummary`
    (`toArticleSummary` drops the body for lists/API). Reuses `sourceSchema` from the outlook
    contract. `ARTICLE_CONTRACT_VERSION = 1`.
  - **Data-access**: `src/server/articles/` (`server-only`, cached) reads + zod-validates
    `src/content/articles/*.json`, returns published, newest-first. (Phase 7: include
    `src/content/**` via `outputFileTracingIncludes` for standalone runtime ISR reads.)
  - **Artifacts (Git-as-CMS)**: 3 hand-seeded editorial articles in `src/content/articles/`
    (central banks / dollar–gold / reading trends), each cited.
  - **Pages**: `/articles` (grid), `/articles/[slug]` (SSG via `generateStaticParams` + ISR 1h;
    `Article` + `BreadcrumbList` JSON-LD, `generateMetadata`, sources list, reading time), curated
    `/insights`. Shared `components/markdown/prose.tsx` (outlook `Analysis` now wraps it). Shared
    `ArticleCard`. Deleted placeholder `src/data/insights.ts`; home + sitemap now read real articles.
  - **RSS**: `/articles/rss.xml`. **API**: `/api/v1/articles` (summaries) + `/api/v1/articles/[slug]`
    (full), cache + CORS.
  - **Generation pipeline** (mirrors Aureus v2): `src/server/articles/generator/` — `ArticleGenerator`
    interface + `claude.ts` / `mock.ts`, versioned `prompt.ts` (`ARTICLE_PROMPT_VERSION`; reputable
    sources REQUIRED, ≥1, no fabricated data), `sanitize.ts`. **Refactor**: shared
    `src/server/llm/` — `grounded-json.ts` (web-search + adaptive thinking + effort + zod-validate +
    retry, used by BOTH generators), `json.ts`, `sanitize.ts`; outlook `claude.ts` slimmed to a wrapper.
  - **Scripts**: `articles:generate` (→ `src/content/articles/<date>-<slug>.json`, draft) /
    `articles:publish` (flip drafts→published). **Workflow**: `.github/workflows/articles.yml`
    (manual `workflow_dispatch` w/ optional topic input; 3-day cron commented; opens PR). Model =
    **`claude-opus-4-8`** medium effort (env `ARTICLE_MODEL`/`ARTICLE_EFFORT`/`ARTICLE_WEB_SEARCH_MAX_USES`).
  - Verified: pipeline ran (mock + live CoinGecko) → valid draft, publish flipped it (mock removed,
    not committed). `next build` ✓ (articles SSG'd, generators + `.mts` type-check), `eslint` ✓.
    Dev SSR: /articles, /articles/[slug] (Article+Breadcrumb JSON-LD + sources), /insights, rss.xml
    (3 items), /api/v1/articles (3, no body), home shows real articles.
  - **TODO before going live**: real article run + review (needs `ANTHROPIC_API_KEY`), enable repo
    PR-permission setting, optionally enable the 3-day cron. Phase 7: `outputFileTracingIncludes`.
  - Next: **Phase 5 — Smart Gold Calculator**, or Phase 6 (About/legal/subscribe).
- 2026-06-23: **Phase 5 complete.** Smart Gold Calculator — client-side, accessible, shareable.
  - **Math** (`src/lib/calculator.ts`, pure functions, no React): `calculate()` takes budget,
    spot, purity factor (0–1), premium% → returns item/pure troy oz + grams, break-even spot
    and %, and 6 P/L scenarios (−20% to +50% of spot). `GOLD_PURITIES` array (24K/22K/18K/14K/10K).
    Formula: dealer price per item oz = spot × purity × (1 + premium%); break-even = spot × (1 + premium%)
    — premium% is the minimum spot-rise needed regardless of karat (purity cancels out).
  - **Calculator component** (`src/components/calculator/gold-calculator.tsx`, `"use client"`):
    - Inputs: budget, purity select, dealer premium slider (0–15%, 0.5 step, default 5%),
      spot price (pre-seeded from SSR, editable, "Reset to live" button), unit toggle (troy oz/grams).
    - Results: Quantity card (item oz/g + pure equivalent for <24K), Break-even card, P/L table
      (6 rows, bull/bear colored, "Today's spot" row highlighted).
    - URL sharing: `window.history.replaceState` writes inputs to query params on change (no re-render);
      `useSearchParams()` lazy-initializes state from URL on first render (Suspense-wrapped in page).
    - Share button copies current URL to clipboard.
    - Accessibility: all inputs labeled (with `useId()`), `aria-live="polite"` on results,
      `aria-valuetext` on slider, `role="group"` + `role="radio"` on unit toggle, table `scope` attributes.
  - **Page** `/calculator` (`src/app/calculator/page.tsx`, ISR `revalidate=300`): server component
    fetches live spot via `getGoldQuote()`, seeds `initialSpot` into client component. `Suspense`
    boundary wraps calculator (required by `useSearchParams`). `FAQPage` JSON-LD (4 Q&As) for SEO —
    added helper `calculatorFaqSchema()` to `src/lib/structured-data.ts`. Methodology box at bottom.
  - No new deps. `next build` ✓ (/calculator 5m ISR, 21 total routes), `eslint` ✓.
  - Next: **Phase 6 — About + legal/disclaimer + Subscribe**.
- 2026-06-23: **Insights/Articles merged into one hub.** The Phase 4 two-page split (`/insights`
  top-6 + `/articles` full archive) read as the *same page* to users (identical cards, same store)
  and created SEO duplicate-content/keyword-cannibalization. Decision (with user): collapse to ONE
  user-facing hub at **`/insights`**.
  - `/articles`, `/articles/[slug]`, `/articles/rss.xml` **deleted**; their content moved to
    `/insights`, `/insights/[slug]`, `/insights/rss.xml`. `/insights` now lists ALL articles
    (was top-6). Detail page breadcrumb/back-link/canonical now say Insights.
  - **308 permanent redirects** in `next.config.ts`: `/articles`→`/insights`,
    `/articles/:slug`→`/insights/:slug`, `/articles/rss.xml`→`/insights/rss.xml` (preserves any
    external links / search equity). Verified at runtime (curl: 308 + correct Location; /insights 200).
  - Nav (`src/config/site.ts`): removed the "Articles" item (header + footer); "Insights" is the
    single entry. Updated `ArticleCard` href, `sitemap.ts` (dropped `/articles`, slugs → `/insights/`),
    `newsArticleSchema` URL.
  - **Unchanged (deliberate)**: internal naming stays `article` — `src/types/article.ts`,
    `src/server/articles/`, `src/content/articles/`, `@/components/articles/`, the generation
    pipeline/scripts/workflow, and the versioned public **`/api/v1/articles`** contract (API resource
    name ≠ page route; not churning a versioned contract). Home "Market insights" teaser unchanged
    (3 most recent → links to `/insights`).
  - `next build` ✓ (20 routes; `/insights/[slug]` SSG ×3), `eslint` ✓.
- 2026-06-23: **Phase 6 complete.** About + legal/disclaimer + Subscribe (newsletter).
  - **Newsletter provider abstraction** (`src/server/newsletter/`, mirrors `PriceProvider` + LLM
    generators): `provider.ts` (`NewsletterProvider` interface, `SubscribeResult` — never throws),
    `buttondown.ts` (Buttondown REST API via `fetch`, no SDK; 201→subscribed, 400+"already"→
    already_subscribed, list lives in Buttondown so **no DB**), `inert.ts` (logs + returns ok;
    fallback so dev/CI work offline), `index.ts` (`getNewsletterProvider()` — Buttondown when
    `BUTTONDOWN_API_KEY` set & `NEWSLETTER_PROVIDER!==inert`, else inert; `server-only`).
    **Decision (with user): Buttondown** — simple API, free tier, privacy-friendly, no DB.
  - **Subscribe API** `POST /api/subscribe` (`force-dynamic`, nodejs): zod-validates email,
    **honeypot** (`company` field → silently accept, store nothing), delegates to provider, friendly
    JSON errors (400 invalid / 502 provider). No email enumeration.
  - **SubscribeForm** (`src/components/newsletter/subscribe-form.tsx`, client): accessible (sr-only
    label, `aria-live` status, `aria-invalid`, off-screen honeypot w/ `aria-hidden`+`tabIndex=-1`),
    idle/loading/success/error states, `motion-reduce` spinner. Used in footer (replaces "coming
    soon") + About CTA via `source` prop.
  - **About** `/about` (real page, was `ComingSoon`): intro/mission, "What we do" (4 linked feature
    cards), "How we work" (data-first / cited+reviewed / educational-not-advisory — E-E-A-T trust
    signals), disclaimer callout, Subscribe CTA. `AboutPage` JSON-LD (`aboutPageSchema()` added to
    `lib/structured-data.ts`). `generateMetadata` + canonical + OG.
  - **Disclaimer** `/disclaimer` expanded from 2 paras → 9 sections (educational-only, not advice,
    no advisory relationship, third-party data accuracy, forward-looking, investment risk,
    independence/no-commissions, external links, changes) + "last updated" — proper YMYL coverage.
  - **`.gitignore` fix**: `.env*` was also ignoring `.env.example` (so documented vars never reached
    the repo). Added `!.env.example` (placeholders only, no secrets) per §10. `.env.example` now
    documents `BUTTONDOWN_API_KEY` / `NEWSLETTER_PROVIDER`.
  - No new deps. `next build` ✓ (21 routes; `/api/subscribe` dynamic; about/disclaimer static),
    `eslint` ✓. Runtime-verified: subscribe valid→`{ok,subscribed}`, invalid→400, honeypot→silent ok,
    /about + /disclaimer 200.
  - **TODO before going live**: create Buttondown account, add `BUTTONDOWN_API_KEY` to `.env.local`
    (+ host env), confirm double-opt-in email wording. Subscribe is inert (logs only) until then.
  - Next: **Phase 7 — Deployment** (Docker standalone, reverse proxy, EC2, Cloudflare, S3;
    remember `outputFileTracingIncludes` for `src/content/**`).
- 2026-07-01: **Phase 7 complete.** Site live at https://goldcompass.app on t4g.micro + Cloudflare.
  - **Files created**: `Dockerfile` (multi-stage Alpine, arm64, standalone), `.dockerignore`,
    `deploy/docker-compose.yml` (app + caddy:2-alpine services), `deploy/Caddyfile` (auto-HTTPS
    via Let's Encrypt), `.github/workflows/deploy.yml` (push-to-main trigger → QEMU arm64 build →
    GHCR push → SSH deploy). `next.config.ts` updated: `output: "standalone"` +
    `outputFileTracingIncludes` for `src/content/**/*.json` (so dynamic `fs` reads of articles
    are traced into the standalone bundle).
  - **EC2**: t4g.micro (1 vCPU, 1GB RAM), Amazon Linux 2023 arm64, 20GB gp3 root, Elastic IP,
    2GB swapfile (persisted via /etc/fstab). Docker + Compose plugin installed (AL2023 `dnf`
    + official aarch64 Compose binary). App deployed at `/opt/goldcompass/`.
  - **GHCR**: image `ghcr.io/yassersalama22/goldcompass-v2:latest` set to **public** — no
    registry credentials needed on the box; `docker compose pull` works unauthenticated.
  - **GitHub secrets added**: `EC2_HOST`, `EC2_USER` (ec2-user), `EC2_SSH_KEY` (ed25519 deploy key).
    Deploy key generated on box (`~/.ssh/deploy_key`); public key appended to `authorized_keys`.
    EC2 SG: port 22 open to 0.0.0.0/0 (key-auth only; safe). Ports 80+443 open to all.
  - **Cloudflare**: domain on Cloudflare, A records (`@` + `www`) → Elastic IP, proxied. SSL/TLS
    Full (strict); Always Use HTTPS enabled. Caddy obtained Let's Encrypt cert automatically on
    first request through the proxy.
  - **Architecture note**: both content types (outlook JSON imported statically, articles read via
    `fs` at runtime) are baked into the Docker image at build time — publish = merge PR to main →
    deploy workflow rebuilds + redeploys. `/api/revalidate` still available for manual cache busts.
  - **S3 deferred**: `public/` (11KB) and `src/content/` (32KB) are tiny — nothing to offload.
    Revisit when real media/OG images are added.
  - Verified: `docker compose ps` → both containers healthy; `curl -I https://goldcompass.app` →
    200, valid cert; `/api/v1/price` + `/api/v1/recommendations` → valid JSON; push to main
    triggers full deploy pipeline end-to-end.
  - **TODO**: add `ANTHROPIC_API_KEY` + `REVALIDATE_SECRET` to box `.env` to enable the outlook +
    articles generation pipelines; create Buttondown account + add `BUTTONDOWN_API_KEY` to enable
    newsletter subscribe. Enable daily-outlook cron in `.github/workflows/daily-outlook.yml`
    after first real run review.
  - Next: **Phase 8 — Auth & accounts (deferred)**, or go-live tasks (real outlook run,
    Buttondown setup, Lighthouse audit, HSTS).
- 2026-07-01: **Security hardening pass** (post-Phase-7 audit; fixes #1 headers + #2 subscribe abuse).
  - **Security headers** (`next.config.ts` `async headers()`, all routes): strict `Content-Security-
    Policy` (all same-origin; `'unsafe-inline'` for script/style since no nonce pipeline — defense-in-
    depth, app renders no raw HTML), `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`
    (clickjacking), **HSTS** (2yr, preload — closes the Phase 7 HSTS TODO), `X-Content-Type-Options:
    nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. Verified emitted.
  - **Rate limit on `POST /api/subscribe`**: `src/server/rate-limit.ts` — in-memory fixed-window
    limiter (single standalone instance → no Redis), 5 req / 10 min per IP, 429 + `Retry-After`.
    `getClientIp` prefers `CF-Connecting-IP` then `X-Forwarded-For`. Stops email-bombing /
    Buttondown quota abuse. Stacks in front of the existing honeypot + zod email validation.
  - **Cloudflare Turnstile on subscribe** (bot protection, the primary defense): `src/server/
    turnstile.ts` (`verifyTurnstile`, server-side `siteverify`, **inert when `TURNSTILE_SECRET_KEY`
    unset** so dev/CI work offline). Route enforces token → 403 on missing/invalid. Form
    (`subscribe-form.tsx`) loads the widget via `next/script` in explicit mode (only when
    `NEXT_PUBLIC_TURNSTILE_SITE_KEY` set), disables Submit until token, resets on error. CSP updated
    for `challenges.cloudflare.com` (script/connect/frame-src). Verified: inert passes, enforced 403s.
  - **Turnstile deploy wiring**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is a **build-time** inline (public,
    shipped to browser) → threaded as a Docker `ARG`→`ENV` before `npm run build` and passed via
    `build-args` in `deploy.yml` (from a repo secret/var). `TURNSTILE_SECRET_KEY` is **runtime** (box
    `.env`). **Both required** to enable — site key only at runtime = widget never renders → all real
    submits 403. Verified the build-arg inlines into the client bundle.
  - **TODO to switch Turnstile on**: create a Turnstile widget (Cloudflare dash), add repo secret
    `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (for the build) + `TURNSTILE_SECRET_KEY` to the box `.env`
    (runtime), redeploy. Until then it stays safely inert.
  - **Still open from the audit** (not code): rotate/remove the loose `EC2_SSH_Github_Secrete.secret`
    private key from the working tree (gitignored, untracked, but shouldn't live in the repo dir);
    lock the EC2 security group (80/443) to Cloudflare IP ranges so the origin can't be hit directly
    (closes the `X-Forwarded-For` spoofing gap and makes edge rules enforceable); wire `npm audit`
    into CI. See audit conversation for full detail.
- 2026-07-02: **Growth foundations pass** (findable → shareable → sticky; code side of items 1–4).
  - **Search Console**: root metadata emits `<meta name="google-site-verification">` when
    `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` set (build-time; Docker ARG + deploy build-arg from a
    repo **variable**). DNS TXT verification via Cloudflare is the preferred path (no rebuild).
  - **Cloudflare Web Analytics**: beacon `<Script>` in root layout, gated on
    `NEXT_PUBLIC_CF_BEACON_TOKEN` (build-time inline, same Turnstile pattern: Docker ARG →
    deploy.yml build-arg from repo variable; unset = no script). CSP extended:
    `static.cloudflareinsights.com` (script-src) + `cloudflareinsights.com` (connect-src).
  - **Subscribe CTAs on content pages**: new `components/newsletter/subscribe-cta.tsx`
    (server component, heading + copy + `SubscribeForm`) placed at the end of `/outlook`
    (source=outlook) and `/insights/[slug]` (source=insight) — the retention hook after reading.
  - **Dynamic OG images** (file-convention `opengraph-image.tsx`, `next/og`/satori, 1200×630 PNG):
    site-wide brand card (`src/app/opengraph-image.tsx`), `/outlook` card (spot + signed change +
    short/long signal chips from `getPublishedOutlook()`, regenerates with ISR), per-article card
    (`/insights/[slug]`, category + title). Shared satori helpers in `src/lib/og.tsx` (hex
    approximations of brand tokens — satori can't use oklch; compass mark from `icon.svg`).
    Verified rendered PNGs + `og:image`/`twitter:image` meta emitted; localhost URLs in local
    checks come from `.env.local` `NEXT_PUBLIC_SITE_URL` (prod falls back to goldcompass.app —
    live canonical verified). Closes the Phase 1 OG-image TODO.
  - **Fix**: `/outlook` header + OG card now format change via `formatSignedPct()` (artifact
    stores a raw float, e.g. 2.243017928378964 — was rendered unrounded).
  - Verified: `next build` ✓ (23 routes; OG routes static for / + /outlook, dynamic per slug),
    `eslint` ✓, standalone runtime serves all 3 OG PNGs (next/og traced correctly), beacon script
    + verification meta emitted when env set, subscribe CTA SSR'd on both page types.
  - **User TODO to activate** (dashboard steps, not code): ① Search Console: add property
    `goldcompass.app` via **DNS TXT** in Cloudflare, submit `sitemap.xml` (+ Bing Webmaster
    import); ② Cloudflare dash → Analytics → Web Analytics → add site (manual install) → put the
    token in repo **variable** `NEXT_PUBLIC_CF_BEACON_TOKEN`; ③ Buttondown account +
    `BUTTONDOWN_API_KEY` in box `.env` (subscribe is still inert); ④ push/redeploy to bake ①–②.
- 2026-07-27: **Newsletter live.** Buttondown account created; subscribe works end-to-end in
  production (double opt-in confirmed). Closes the Phase 6 "subscribe is inert" TODO.
  - **New §4 rule: forward the visitor's IP to third-party services.** Prod is one EC2 box behind
    one Elastic IP, so upstreams doing per-IP abuse scoring see every user as one client — and a
    flag blocks *everyone* simultaneously. `NewsletterProvider.subscribe()` now takes
    `meta.ip` (from `getClientIp(request)`, Cloudflare-aware) → Buttondown `ip_address`, omitted
    when unknown. Verified against the live API that create accepts + stores it.
  - **Buttondown firewall**: blocks by source IP (`subscriber_blocked`), silently — a blocked
    signup creates **no** subscriber record. Hit during local testing (dev IP flagged after
    repeated API calls); fixed by allowlisting in the Buttondown dashboard. Do **not** allowlist
    the Elastic IP as a fix — see the §4 corollary.
  - **`buttondown.ts` hardening**: error handling now matches Buttondown's structured `code`
    (`email_already_exists`) instead of substring-matching the body. The old
    `/already|exists|subscribed/i` regex was one letter from reading `subscriber_blocked` as an
    already-subscribed **success** — i.e. telling users they were subscribed when they were
    rejected. Non-2xx responses now log status + code + body server-side (the route returns a
    generic message, so that log is the only diagnostic).
  - **`turnstileToken` fix**: the client sends `null` when Turnstile is unconfigured, but the zod
    schema was `.optional()` (accepts `undefined`, not `null`) → every submit failed the whole
    payload and returned "Please enter a valid email address". Now `.nullable().optional()`, with
    `?? undefined` at the `verifyTurnstile` call. Not a security change: `verifyTurnstile` already
    returns `true` when `TURNSTILE_SECRET_KEY` is unset and treats any falsy token as a failure
    when it is set.
  - **`/subscribed` page** (`src/app/subscribed/page.tsx`, static): the newsletter provider's
    "after confirming" redirect target — confirmation + "Start here" cards into
    outlook/trends/calculator/insights + disclaimer. `robots: noindex, follow` and deliberately
    **not** in `sitemap.ts` (thin page, no search intent; the allowlist in `sitemap.ts` excludes
    it automatically). Set Buttondown → Settings → Subscribing → "After confirming" to
    `https://goldcompass.app/subscribed`. Note it cannot verify the visitor actually confirmed —
    it's just a redirect target with no token, and the URL is guessable.
  - **⚠ Deploy traps (cost real debugging time — read before touching box `.env`):**
    ① Compose `env_file:` does **not** strip quotes. `KEY="abc"` sends the quote characters as
    part of the value → upstream 401. Write values bare: no quotes, no spaces around `=`, no
    trailing whitespace/CRLF. Inspect with `grep KEY /opt/goldcompass/.env | cat -A`.
    ② `docker compose restart` does **not** re-read `env_file` — it restarts the process with the
    container's existing env. Use `docker compose up -d` to recreate after any `.env` edit.
    ③ Failure-mode tell: a **missing** `BUTTONDOWN_API_KEY` falls back to the inert provider and
    returns **200**; a **present-but-invalid** one returns **502**. So 502 means the key is
    reaching the container and is wrong — not absent.
  - **Buttondown free tier**: custom transactional/confirmation email templates are **Standard
    plan or higher**. A branded confirmation-email HTML template (design-system colors as hex,
    table layout, no SVG — email clients strip it) was drafted but is unusable on free. Checked
    alternatives: MailerLite gates DOI editing behind paid too (and cut its free tier to 250
    subs / 2,500 emails per month on 2026-07-01); **Brevo** free does allow custom DOI templates
    (300 emails/day, unlimited contacts) if this is ever worth switching for. The free
    "after confirming" redirect to `/subscribed` was chosen instead — same brand payoff, own site.
  - **Still open**: Turnstile remains inert (both keys unset) → subscribe is defended only by the
    in-memory rate limit + honeypot. Enable it before the list is worth attacking.
    *(Closed same day — see the ops entry below.)*
- 2026-07-27: **Ops catch-up + origin lockdown.** Records the July operational changes that landed
  between the Phase 7 audit and now, and closes the last open item from that audit.
  - **EC2 origin locked to Cloudflare** (closes the 2026-07-01 audit item). The security group no
    longer accepts 80/443 from `0.0.0.0/0` — only Cloudflare's published ranges. This matters
    beyond "less exposed surface": `getClientIp()` trusts `CF-Connecting-IP` / `X-Forwarded-For`,
    which **any** direct caller could forge to defeat the per-IP rate limit and to poison the
    `ip_address` we forward to Buttondown (§4). With the origin reachable only via Cloudflare,
    those headers are edge-set and trustworthy, and Cloudflare rules (WAF, bot rules) can't be
    bypassed by hitting the Elastic IP directly.
  - **Script: `deploy/whitelist-cloudflare-ips.sh`** — **idempotent reconciler**. Fetches
    `cloudflare.com/ips-v4` + `ips-v6`, diffs them against the group's current ingress rules, then
    adds what's missing and revokes what is no longer a Cloudflare range. Run with no args it
    prints a **plan and changes nothing**; `--apply` executes. `SG_ID` / `AWS_REGION` default to
    prod and are env-overridable. Design notes:
    - Manages **only** rules whose port range is exactly `80-80` or `443-443`. SSH (22) is
      untouched. A rule that exposes a managed port some *other* way (a wide `0-65535` range,
      protocol `-1`) is **warned about, not revoked** — that's either deliberate or a mistake
      that deserves a human, and it's also the one shape that would silently defeat the lockdown.
    - Refuses to reconcile if the fetched list looks implausible (<5 IPv4 / <3 IPv6 ranges), so a
      truncated or hijacked response can't revoke the whole allowlist and black-hole the origin.
    - Source-SG and prefix-list rules (no CIDR) are skipped; revokes go by rule ID, not by
      re-specifying the permission.
  - **⚠ It cannot run as-is with the current AWS credentials**: IAM user `yasser.salama` has
    **no EC2 read permissions** (`ec2:DescribeSecurityGroupRules` *and* `ec2:DescribeSecurityGroups`
    both `UnauthorizedOperation`) — which is why the original add-only version worked, it only ever
    called `authorize`. Reconciling needs to read current state, so **grant
    `ec2:DescribeSecurityGroupRules`** (EC2 `Describe*` only supports `Resource: "*"`; it's
    read-only and grants no mutation ability). Until then the script exits 1 with that hint and
    changes nothing. Verified end-to-end against stubbed `aws`/`curl` fixtures: keeps in-sync
    rules, revokes stale ones, skips SSH + prefix-list rules, warns on overlapping wide rules,
    handles CRLF/blank lines in the IPv6 list, and emits correct IPv4 vs IPv6 shorthand.
    Minimal policy to attach: `deploy/iam-cloudflare-sg-policy.json` (Describe on `*`,
    authorize/revoke scoped to the one SG ARN).
  - **Run it from a workstation, not the EC2 box** (decided). The box has no instance profile
    (`aws` there → "Unable to locate credentials") and should keep it that way: a role that can
    edit its own security group turns any RCE/SSRF on the public-facing app into "attacker opens
    22 to the world" (SSRF→IMDS is the classic path). It's also not a deploy-time task —
    Cloudflare's ranges change ~annually — and if the rules are ever wrong the box is unreachable,
    so the fix has to come from outside. If it ever *must* run on an instance: attach a role with
    the scoped policy above and set IMDSv2 required with `--http-put-response-hop-limit 1`, which
    keeps Docker containers (the app) from reaching IMDS at all.
    **Placement convention**: operational/infra scripts live in `deploy/` (with the Caddyfile and
    compose file); `scripts/` is the app content pipeline (tsx/mjs, run via npm); `support_files/`
    is **archived reference material** from the old Lovable/Aureus engine — not a code location.
  - **Generation pipelines are live in production.** `ANTHROPIC_API_KEY` is set as a repo secret;
    the daily-outlook `cron` (06:00 UTC) is **enabled** (commit `3c8271b`) and has been opening +
    merging real PRs most days since ~2026-07-05 — closes the Phase 3.5 / Phase 7 "enable the cron
    after a real run review" TODOs. Both workflows now auto-assign the PR to the repo owner.
    The **articles** workflow is still `workflow_dispatch`-only (3-day cron still commented out);
    it has been run manually ~4 times in July, so `src/content/articles/` now holds 3 editorial
    seeds + 4 generated pieces.
  - **Turnstile is fully enabled** (both keys set: site key baked in at build via the Docker
    build-arg, `TURNSTILE_SECRET_KEY` in the box `.env`) → `POST /api/subscribe` now genuinely
    403s a missing/invalid token. Supersedes the "still open / inert" note in the entry above.
  - **Fetch timeouts** (commit `71e4d7c`): Buttondown and Turnstile calls now use an abort timeout.
    Without one, a hung upstream would pin a request on the single-container box until Node's
    default socket timeout — a cheap self-DoS on a 1GB instance.
  - **Still open from the 2026-07-01 audit**: `npm audit` is not wired into CI (only remaining
    item — the loose `EC2_SSH_*.secret` private key is no longer in the working tree).
  - **Never done**: a real browser Lighthouse / axe run against production. Phase 1 verified colour
    contrast numerically (`scripts/check-contrast.mjs`), but keyboard + screen-reader passes and
    field Core Web Vitals remain unmeasured, on a project whose #1 goal is SEO/perf.
    *(Done same day — see the audit entry below.)*
- 2026-07-27: **First production Lighthouse + axe audit** (mobile emulation, Lighthouse 12 via
  headless Chrome; axe-core 4.12 WCAG 2.0/2.1 A+AA + best-practice over 9 pages).
  | page | Perf | A11y | BP | SEO | LCP | TBT |
  |---|---|---|---|---|---|---|
  | `/` | 42 | 96 | 82 | 100 | 5.4s | 2643ms |
  | `/outlook` | 60 | 96 | 82 | 100 | 3.6s | 2493ms |
  | `/trends` | **68** | 96 | **96** | 100 | 5.8s | **45ms** |
  | `/calculator` | 39 | 96 | 82 | 100 | 6.0s | 2014ms |
  | `/insights` | 41 | 96 | 82 | 100 | 6.3s | 2288ms |
  | `/insights/[slug]` | 38 | 96 | 82 | 100 | 6.7s | 2320ms |
  | `/about` | 52 | 96 | 82 | 100 | 6.1s | 590ms |
  - **SEO 100 and CLS 0 everywhere** — the Phase 0–6 SEO work holds up. Accessibility is 96 on
    every page, and axe found exactly **one** violation type site-wide (below). The performance
    scores are the story, and **the dominant cause is not our code**.
  - **① Cloudflare Bot Fight Mode / JS Detections is the main perf problem.** Cloudflare injects
    `/cdn-cgi/challenge-platform/scripts/jsd/main.js` into HTML responses; it burns **4.5–5.3s of
    main-thread scripting** under mobile CPU throttling, which *is* the ~2–2.6s TBT and most of
    LCP's render delay (home: 4.66s of the 5.4s LCP was render delay, not network). The proof is
    `/trends`, the one page where the script didn't run: TBT **45ms** vs ~2300ms and Best Practices
    96 vs 82 (the 3 deprecation warnings — `SharedStorage`, `StorageType.persistent`, `Fledge` —
    all come from that script too). It is a **dashboard toggle**, not a code change: Cloudflare →
    Security → Bots → Bot Fight Mode off (or JS Detections off). Turnstile already protects the
    only write endpoint, so the crude free-tier bot filter is buying little here.
  - **② Cloudflare is not caching HTML at all** — every page returns `cf-cache-status: DYNAMIC`
    despite the app sending `s-maxage` (e.g. `/outlook`: `s-maxage=1800, swr=31534200`).
    Cloudflare's default rules never cache HTML; it needs an explicit **Cache Rule** ("Eligible for
    cache" + respect origin TTL). Consequence: every view is a full round trip to a single
    t4g.micro in us-east-1 → ~620–760ms TTFB, even though origin *processing* is only **43ms**.
    Fixing this is the biggest remaining win after ①, and it also cuts load on the box.
  - **③ A11y: the logo wordmark fails contrast** — the only axe violation, on **all 9 pages**
    (serious, WCAG 1.4.3). `logo.tsx:27` and `mobile-nav.tsx:36` render `<span className="text-gold">`
    for "Compass": **2.48:1** in the header, **2.39:1** in the footer, needs 4.5:1. This is exactly
    the trap the Phase 1 entry warned about ("never use `text-gold` for small text on light bg —
    use `text-gold-strong`"); the rule was recorded but the Logo component was never converted.
  - **④ Hydration mismatch on `/trends`** (React error #418 in the console): `price-ticker.tsx:14`
    builds `Intl.DateTimeFormat` with `timeZoneName: "short"` but **no `timeZone`**, so the server
    (container = UTC) and the browser (viewer's zone) render different text for "As of …". React
    throws away that SSR subtree and re-renders on the client. Fix by pinning a `timeZone`, or by
    rendering the timestamp after mount / `suppressHydrationWarning`.
  - **⑤ Minor**: no `preconnect` to `challenges.cloudflare.com` + `static.cloudflareinsights.com`
    (~420ms est.); 14KB legacy JS transpiled for old browsers; 28KB (40%) of the main app chunk
    unused on first load. All small next to ① and ②. Our own JS is genuinely lean — the 821KB page
    weight is mostly third-party (JSD + Turnstile + beacon).
  - **Method note**: article slugs include the date prefix (`/insights/2026-07-27-why-fed-…`);
    a slug-only URL 404s, which silently scores a Lighthouse run as 0 across all categories.
  - **③ + ④ fixed (code, in this session)** — ① and ② are Cloudflare dashboard changes, still open.
    - **Contrast**: the wordmark now uses `text-gold-strong` in `logo.tsx` + `mobile-nav.tsx`.
      The compass SVG keeps bright `text-gold` — it's `aria-hidden` decoration, not text.
      Re-verified with axe against a local production build: **0 violations** on `/`, `/trends`,
      `/insights`, `/about` (was 2 serious nodes on every page).
    - **Hydration**: `price-ticker.tsx` renders the "As of" time in **UTC for SSR + the hydrating
      render, then local time once mounted**, gated by `useSyncExternalStore(subscribeNoop,
      () => true, () => false)`. Note the obvious `useState(false)` + `useEffect(setMounted)`
      version **fails lint** (`react-hooks/set-state-in-effect`) — `useSyncExternalStore` is the
      hydration-safe API and needs no effect.
    - Also pinned `formatShortDate` (`src/lib/format.ts`) to `timeZone: "UTC"` — same latent bug
      class in the SSR'd chart axis + `sr-only` table, where a point near midnight would label
      differently on server vs client. Upstream keys daily points by UTC day, so UTC is also the
      more correct label.
    - Verified by running the production build with `TZ=UTC` (reproducing container-UTC vs
      browser-local, tester in `Africa/Cairo`): SSR emits `As of 12:22 PM UTC`, the client shows
      `3:22 PM GMT+3`, and **zero React hydration errors** in the console (was error #418).
      `next build` ✓, `eslint` ✓, `tsc --noEmit` ✓.
- 2026-07-27: **Edge caching enabled (audit items ① + ②).** Bot Fight Mode turned off and
  Cloudflare Cache Rules added for public HTML — HTML now returns `cf-cache-status: MISS/HIT`
  instead of `DYNAMIC`, with a 120s browser-TTL override so a purge reaches repeat visitors.
  - **⚠ `Vary` is ignored by Cloudflare (except `Accept-Encoding`).** Next serves two different
    bodies at one URL — the HTML document, and the RSC flight payload when the client router
    prefetches/navigates (`RSC: 1` request header, `content-type: text/x-component`) — and
    advertises that via `Vary: RSC`. Cloudflare does not honour it, so **whichever body is fetched
    first is cached and served to everyone**. A Cache Rule bypassing
    `any(http.request.headers["rsc"][*] eq "1")` is what keeps them apart.
    **Status: not working yet** — `curl -H "RSC: 1" https://goldcompass.app/` returns
    `cf-cache-status: HIT` with `content-type: text/html`, i.e. the flight request is being served
    the cached document. Harmless-ish today (the router falls back to a full navigation), but the
    reverse race — a prefetch populating the cache first — serves raw flight text to real
    visitors. **Re-check this rule.**
  - **⚠ JS Detections cannot be turned off on the Free plan — not by the dashboard, and turning
    off Bot Fight Mode does not stop it.** Established the hard way, after two wrong guesses:
    ✗ "JSD is a separate dashboard toggle" — it is, but **only** for Super Bot Fight Mode
      (Pro/Business) and Enterprise Bot Management. Free has no such control.
    ✗ "JSD injecting proves BFM is still on" — **false**. Enabling BFM enables JSD, but
      *disabling BFM does not disable JSD*. Confirmed on this zone: the Bot fight mode card shows
      the toggle **off** with `Configurations → JS Detections: On` as read-only text beneath it,
      and a cache-busted fetch still returns the edge-injected
      `window.__CF$cv$params={…}; a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js'`.
    The API field is `enable_js` (`PUT /zones/{zone_id}/bot_management`), but community reports
    say Free zones reject or ignore it ("on free zones JSD is always on"). Worth one attempt;
    don't expect it to stick.
    **Consequence**: ~4.6s of throttled main-thread scripting stays on every HTML page, holding
    lab Performance in the 40s. Remember this is **Lighthouse lab data under 4× CPU throttling** —
    the SEO-relevant signal is field CrUX (Search Console → Core Web Vitals), where async-injected
    JSD costs less. Judge the real impact there before paying to escape it.
    **Escape routes, in order**: (1) try `enable_js: false` via API; (2) accept it and watch field
    CWV; (3) Pro plan, where SBFM exposes the toggle. Dashboard path for the BFM toggle itself
    (the UI moved; `Security → Bots` is legacy): **Security Settings** → filter **Bot traffic**.
  - **No purge-on-deploy, by decision** (user, 2026-07-27) — purging is manual via the dashboard.
    **Consequence + rule**: with the edge now honouring origin TTLs, any page that renders
    pipeline-generated content **must carry its own `revalidate`**, because nothing flushes the
    edge on merge. Fully static pages emit `s-maxage=31536000` (a **year**).
  - **Fix applied**: `src/app/page.tsx` had no `revalidate` while rendering the current outlook +
    3 latest articles → it would have gone stale at the edge for up to a year. Now
    `export const revalidate = 1800` (build output: `/` Revalidate 30m, was blank). Matches
    `/outlook`. `next build` ✓, `eslint` ✓.
  - **🔥 Cache Rules do NOT stop at the first match** — unlike WAF rules, every matching rule in
    the phase is evaluated **in order and later rules override earlier ones**. A "Bypass RSC"
    rule at position 1 was therefore *overridden* by "Cache public pages" at position 3, because
    an RSC request to `/` matches both. Result, observed in production: the RSC request came back
    `MISS` (not `BYPASS`), so the **flight payload was stored under the `/` cache key** and real
    browsers — correct UA, `Accept: text/html` — were served
    `content-type: text/x-component` with a body starting `1:"$Sreact.fragment"` and **no
    `<!DOCTYPE html>`**. The home page was effectively broken at that PoP.
    **Fix**: the negation must live *inside* the caching rule, not in a separate earlier rule —
    append `and not any(http.request.headers["rsc"][*] eq "1")` to the "Cache public pages"
    expression so the two rules can never both match. Then purge (fixing after a purge just
    re-poisons). Verified after the fix: an RSC-first request to a fresh URL returns `DYNAMIC`
    (not stored) and a subsequent normal GET on that same URL returns `text/html` + doctype.
  - **Residual, accepted**: an RSC request to an already-cached URL is still served the cached
    HTML (`HIT`, `text/html`) rather than a flight payload, so client-side soft navigation falls
    back to a full page load. Verified in a real browser that navigation still works (home → click
    Outlook → correct `<h1>`, no React errors). Separating the two bodies properly would need the
    `RSC` header in the **cache key**, which is not available on this plan.
  - **Measured after enabling caching**: root-document `server-response-time` **620ms → 90ms**.
    Performance is still 41–47 because the JSD script is still injecting (4,637ms of scripting) —
    i.e. Bot Fight Mode is still enabled somewhere in the reorganised dashboard (see above:
    on Free, JSD cannot be disabled separately, so its presence *is* the BFM indicator).
    **Accessibility is now 100** on `/` and `/outlook` (was 96) — the contrast fix is deployed.
    Hydration fix confirmed live: `/trends` SSRs `As of 12:57 PM UTC` and the browser reports
    **0 React hydration errors** (was #418). The remaining console noise
    (`%c%d font-size:0;color:transparent NaN`) comes from the Cloudflare JSD script, not our code.
- 2026-07-28: **Audit follow-ups + `/methodology`.** Branch `chore/security-audit-ci` (3 commits,
  not yet merged — merging main triggers the deploy pipeline).
  - **Decided to stop chasing the JSD perf item** (audit ① ): it only moves *lab* numbers, cannot
    be disabled on Free, and field CrUX is the SEO-relevant signal. Search Console is set up and
    verified by DNS TXT. Articles cron stays **manual** by preference — topics are chosen against
    current affairs. IAM grant for the SG reconciler (audit ④) deferred.
  - **RSC cache rule now verified working** (was flagged "re-check this" on 2026-07-27):
    `curl -H "RSC: 1" /` → `text/x-component` + `cf-cache-status: DYNAMIC`, and normal GETs return
    cached HTML. The `and not any(http.request.headers["rsc"][*] eq "1")` fix held.
  - **`npm audit` wired into CI** — `.github/workflows/security-audit.yml`. Weekly Monday cron +
    PRs touching `package*.json` + manual. **Deliberately separate from `deploy.yml`** so a new
    CVE can't block a hotfix. The weekly cron is the real trigger: deps change rarely here (bot
    PRs only touch `src/content`), so a PR-only trigger would idle for months.
    Closes the last open item from the 2026-07-01 audit.
  - **Wiring it up surfaced 10 advisories (7 high); all production ones fixed** rather than
    landing a red gate: `npm audit fix` cleared the shadcn CLI tree; **next 16.2.9 → 16.2.12**
    (patch) closed 9 Next advisories; next *vendors* `postcss@8.4.31` + optional `sharp@^0.34.5`
    with no in-range fix (npm proposed downgrading to next@9 — ignore that), so both are pinned
    forward via **`overrides`** in `package.json`. Low risk *here specifically*: **nothing in
    `src/` imports `next/image`**, so sharp is unreferenced, and Tailwind already resolved
    `postcss@8.5.24` in the same tree. Production tree: **0 vulnerabilities**.
  - **Gate is `--omit=dev --audit-level=high`.** The 9 remaining dev-only highs are all a ReDoS in
    `brace-expansion` reachable through eslint's glob matching; the fix is an **eslint v10 major**,
    judged out of scope. The full dev-inclusive report still prints every run. Revisit if a
    dev advisory ever implies build-time code execution.
  - **Preconnect hints** (audit ⑤) in `layout.tsx` for `challenges.cloudflare.com` +
    `static.cloudflareinsights.com` (~420ms). **Each is gated on the same env var that gates the
    resource itself** — don't preconnect to a host a given deployment never contacts. React 19
    hoists them into `<head>` (verified in the prerendered HTML).
  - **`/methodology` page** (`src/app/methodology/page.tsx`, static) — closes the Phase 2 TODO.
    The outlook's "How we form this view" box promised a methodology link and never had one.
    Covers: price source **and explicitly that PAXG is a proxy, not the London fix**; the
    generation pipeline; what human review does *and does not* check; signal / confidence /
    invalidation semantics (kept in sync with `signalSchema`); cadence; calculator arithmetic
    (incl. why purity cancels out of break-even); limitations + independence.
    **Discloses plainly that analysis is AI-drafted and human-reviewed** — on YMYL that
    disclosure is the trust play; undisclosed AI financial content is what quality guidance
    targets. Wired in: `methodologyPageSchema()` (WebPage JSON-LD), footer *Resources* nav,
    `sitemap.ts`, and the link from `/outlook`.
  - Verified: `tsc --noEmit` ✓, `eslint` ✓, `next build` ✓ (`/methodology` static), runtime 200,
    single `<h1>`, valid JSON-LD, sitemap + footer + outlook links present.
  - **Still open**: eslint v10 major upgrade (optional); IAM `ec2:DescribeSecurityGroupRules` for
    `deploy/whitelist-cloudflare-ips.sh`; field CWV review in Search Console once data lands.
- 2026-07-30: **Competitor gap analysis — goldcompass.ai** →
  `docs/competitive-analysis-goldcompass-ai.md` (full report; read it before acting on any item).
  - They are an **app for leveraged XAUUSD traders** (lots/pips/margin, M15–H4, freemium
    subscription); the website is an install funnel. Different ICP to ours (physical-gold
    investors). **Brand collision** (`.ai` vs our `.app`) is the main unfixable risk.
  - Their real advantage is **SEO surface area**: 28 sitemap URLs to our 16, built by splitting
    ONE calculator into 7 pages (each with breadcrumb + `FAQPage` + `SoftwareApplication` JSON-LD,
    worked example, "common mistakes", sibling-tool sidebar). Two of their six tools (karat purity,
    unit converter) target **our** retail audience, not their trader one.
  - We are ahead on trust: we make a directional call with an invalidation level (**they
    explicitly refuse to** — "not a signal app"), we cite sources everywhere, and we disclose
    human review. Their `/ai-disclosure` lists 8 failure modes and **no human in the loop**.
    Their `/blog/news` is empty. We also have a real public API; they have only "API Terms".
  - Top recommendations, not yet done: **tool hub** (split `/calculator` into sibling pages);
    **feed DXY / real yields / silver / crude into the Aureus prompt** as deterministic ground
    truth + a "macro pressure" panel (already foreshadowed in §12); standalone `/ai-disclosure`;
    split `/insights` into Explainers vs Market Updates. Explicitly **rejected**: a mobile app,
    trader tools (lots/pips/margin), a paywall, and dropping our directional call.
- 2026-07-30: **Generated-article slugs fixed** (P0 from the gap analysis above).
  - **Was**: `generate-article.mts` built `slug = ${date}-${kebab(title)}` with `kebab()` doing a
    blind `.slice(0, 60)` → `/insights/2026-07-30-fed-holds-…-means-for-go`. Three problems: the
    date prefix pushed keywords right and permanently dated the URL, the truncation cut **mid-word**
    (losing "gold" from a gold article), and it was inconsistent with the hand-seeded editorial
    articles, which already used `slug = kebab(title)` + filename `date-slug`.
  - **Now**: the slug carries **no date** — the date lives only in the artifact **filename**, which
    keeps the directory chronological. `MAX_SLUG_LENGTH` raised 60 → **80** (the slug no longer
    spends 11 chars on a date prefix, so real titles fit whole) and truncation lands on a **word
    boundary**. Every current title now fits intact.
  - **Also fixed a latent silent-overwrite bug**: dropping the date prefix means two articles could
    derive the same slug, so `uniqueSlug()` + `existingSlugs()` disambiguate (`-2`, `-3`, …). Under
    the old scheme a same-day rerun with the same title produced an identical filename and
    **silently overwrote the previous artifact**; it would also have broken `getArticleBySlug`
    (first match wins) and emitted a duplicate `generateStaticParams` route.
  - **Migrated the 5 published generated artifacts** (slug field rewritten; one file renamed, git
    detects it as a rename). Diff is the slug line only — no content touched. Added **5 explicit
    308 redirects** in `next.config.ts`. Deliberately explicit rather than a generic
    date-stripping rule: the truncated URL's new slug differs by more than the prefix
    (`…means-for-go` → `…means-for-gold`), so a regex strip would 404 it.
  - Verified against a production build: all 5 old URLs → **308** to the right target (chain ends
    **200**); all 5 new URLs **200**; sitemap, RSS, `canonical`, and `/api/v1/articles` all emit the
    new slugs; the pre-existing `/articles/*` redirects still work; mock generator run twice
    produced a date-free slug then the `-2` suffix. `tsc --noEmit` ✓, `eslint` ✓, `next build` ✓
    (8 `/insights/[slug]` pages SSG'd).
  - Note: content changes are **staged but not committed** (staging is what makes the rename
    visible). Merging to main triggers the deploy pipeline.
- 2026-07-30: **Brand raster assets** (`public/brand/`) — first raster assets in the repo. The
  compass mark previously existed only as inline SVG in three places (`src/app/icon.svg`,
  `components/brand/logo.tsx`, `lib/og.tsx`) with nothing exportable for social profiles.
  - `avatar.svg` + `avatar-{400,1000}.png` — social profile photo. **Not** the favicon rescaled:
    the favicon is a rounded square and X/LinkedIn crop avatars to a **circle**, so this is a
    full-bleed square (no corner can be exposed) with the mark at ~73% of frame vs the favicon's
    62%, and a thicker stroke. No wordmark — illegible at the 48px timeline size.
  - `x-header-1500x500.png` — X banner. **The profile photo overlaps the banner's bottom-left**
    (≈ x 40–372, y 334–500 in asset coordinates); content is padded up so the last line lands at
    y≈312. Verified by compositing a mock avatar over the output — the disclaimer line is the
    first thing to get clipped if that padding shrinks.
  - **`scripts/generate-brand-assets.mts`** (`npm run brand:assets`) regenerates all of it, so the
    PNGs are reproducible rather than hand-made binaries. Avatars via `sharp`; banner via
    `next/og`, which works fine in a plain tsx script (`ImageResponse` → `arrayBuffer()`). Uses a
    small `h()` element factory instead of JSX to keep it a `.mts` file with no JSX build config.
    Palette imported from `src/lib/og.tsx` — single source of truth.
  - **Note on typography**: satori has no brand font loaded, so OG cards *and* this banner render
    in satori's bundled sans, not Geist. Pre-existing, not introduced here; worth fixing if brand
    typography consistency ever matters.
  - **Deleted the create-next-app defaults** from `public/` (`file/vercel/next/globe/window.svg`) —
    grepped repo-wide, entirely unreferenced, and they were shipping in the Docker image.
    `public/` now contains only real brand assets.
  - `Dockerfile:33` copies `public/` into the image, so these serve at `/brand/…` once deployed.
    `tsc --noEmit` ✓, `eslint` ✓, `next build` ✓.
- 2026-07-30: **Tool hub shipped** (P0 from the gap analysis). `/calculator` keeps the combined
  flagship calculator and gains four single-purpose siblings, each its own indexable URL:
  `/calculator/gold-karat-price`, `/gold-unit-converter`, `/gold-break-even`, `/gold-profit-loss`.
  Sitemap **16 → 20 URLs**. No new dependencies.
  - **Registry is the single source of truth**: `src/config/tools.ts` (`TOOLS`, `FLAGSHIP_TOOL`,
    `siblingTools()`). Adding a tool there wires it into the sidebar, the `/calculator` hub grid,
    and `sitemap.ts` at once — `href` doubles as the canonical path, so it must match the route.
  - **Shared shell** `components/calculator/tool-page-shell.tsx` renders breadcrumb + h1 + tool +
    "How this calculator works" + "Common mistakes" + FAQ + sibling sidebar, and emits
    `WebApplication` + `FAQPage` + `BreadcrumbList` JSON-LD. **The `faqs` array is rendered
    visibly *and* passed to `faqSchema()` from one prop** — Google requires FAQ markup to match
    visible content, and one array makes drift impossible. New helpers in `lib/structured-data.ts`:
    `faqSchema()` (generic) + `toolApplicationSchema()`. The old `calculatorFaqSchema()` is
    untouched and still used by `/calculator`.
  - **Math lives in `src/lib/calculator.ts`** (still pure, no React): `WEIGHT_UNITS` +
    `toGrams`/`fromGrams` (**every conversion routes through grams** — no unit converts directly to
    another, so rounding never compounds), `karatPriceTable()`, `breakEven()`, `profitLoss()`,
    `purityFactorFor()`. Added `fineness` to `GOLD_PURITIES` for display. `breakEven()` and
    `profitLoss()` add a **sell-side spread** the flagship lacks: break-even is
    `spot × (1 + premium) ÷ (1 − sellFee)`, which reduces to the flagship's formula at
    `sellFee = 0` (asserted in the math check below).
  - **Purity cancels out of break-even** — stated in the prose on two pages, and verified
    numerically, not just asserted: P/L at the break-even price is 0 for 24K, 18K, and 10K alike.
    The lever that actually moves break-even is the premium (i.e. product size).
  - **Worked examples are computed from the live spot at render time**, not hard-coded, so they
    stay current under ISR (`revalidate = 300`, matching `/calculator`). `FALLBACK_SPOT = 4150`
    per page covers a failed quote. FAQ answers are deliberately evergreen — keeping live numbers
    out of them keeps the JSON-LD stable across revalidations.
  - **Shared client field kit** `tool-fields.tsx` (`NumberField`, `SelectField`, `PercentSlider`,
    `SpotField`, `useSpotState`, `useUrlState`) + presentational `tool-results.tsx` (`ResultStat`,
    `InputsCard`, `ToolGrid`, `ToolSkeleton`, `EmptyResults`). All four tools sync inputs to the
    query string via `history.replaceState` (shareable links), same approach as the flagship.
  - **Known + accepted**: the tools read `useSearchParams`, so like the flagship they bail out of
    prerender and the static HTML ships the skeleton in their place. Everything that ranks — h1,
    intro, formula, worked example, mistakes, FAQ, sidebar links — **is** server-rendered. The
    alternative (reading `searchParams` on the server) would make the pages dynamic and forfeit
    edge caching, which matters more here given there is no purge-on-deploy.
  - **`Card` uses `ring-1`, not `border`** — `hover:border-*` is a no-op on it, and stretched-link
    cards need an explicit `relative` (see `ArticleCard`). Card already has `py-(--card-spacing)`,
    so a bare `CardContent` needs no `pt-*`.
  - Verified: `tsc --noEmit` ✓, `eslint` ✓, `next build` ✓ (all four **static + 5m ISR**, 33
    routes). **24 math assertions** pass (`scratchpad/check-math.mts`: formula identities, unit
    round-trips, flagship agreement, purity cancellation, input guards). **Headless Chrome over
    CDP** (system Chrome, no install): all four tools hydrate with **zero console errors**, compute
    correctly ($987.83 for 10 g 18K; 1 kg → 32.1507 ozt; $4,285.71 break-even at 5% + 2%; $112.00
    P/L on 1 ozt 4000→4400), and write inputs back to the URL. **axe-core: 0 violations** across
    all five pages (WCAG 2.0/2.1 A+AA + best-practice, mobile viewport). FAQ JSON-LD ↔ visible-text
    parity checked programmatically: 20/20.
  - Note: `TROY_OZ_TO_GRAMS` is the rounded `31.1035`, not the exact `31.1034768`. Left as-is
    (pre-existing, used by the flagship); the error is **0.75 mg on a 1 kg bar** and the prose
    figure `32.1507 ozt` rounds identically either way.
  - Next from the gap analysis: **P1 `/ai-disclosure`** (small, pure trust win), then **P1 macro
    inputs into Aureus** (DXY / real yields / silver — the constraint is free sources with
    acceptable terms).
- 2026-07-30: **`/ai-disclosure` shipped** (P1 from the gap analysis). Standalone static page,
  `aiDisclosurePageSchema(lastUpdated)` (WebPage JSON-LD w/ `dateModified`), linked from the
  footer *Resources* nav, `/methodology`, and `sitemap.ts` (**20 → 21 URLs**). No new deps.
  - **Written against the pipeline source, not from memory.** Every claim traces to code:
    `server/llm/grounded-json.ts` (model, `web_search_20260209`, adaptive thinking, schema
    validation + **one** corrective retry with search off), `outlook/generator/claude.ts` +
    `articles/generator/claude.ts` (`claude-opus-4-8` default, medium effort, search capped at
    4/5 uses), `server/llm/sanitize.ts` (`stripHtml`), the generator `schema.ts` files (articles
    require **≥1 source**; deterministic fields are added by the pipeline, never the model), and
    `daily-outlook.yml` (PR-based human approval gate).
  - **Leads with the dividing line** — a two-column "AI drafts this / AI never touches this" split
    — because retrieval-vs-reasoning separation is the substantive difference from the competitor's
    disclosure, which lists 8 failure modes and has **no human in the loop** at all.
  - **Failure modes are risk / what we do / what remains triples.** Listing mitigations without
    residuals would be the dishonest version of the page, and the residuals are the part a reader
    on a YMYL site actually needs.
  - **Verified claim: nothing a visitor types reaches a model.** `grep` confirms no route or
    component under `src/app` or `src/components` imports the generators or the Anthropic SDK —
    generation runs only in the `.mts` scripts under GitHub Actions. Calculators are client-side;
    the sole write endpoint is `/api/subscribe` → Buttondown.
  - **Deliberately no corrections/contact section.** Commit `8b88bea` removed that exact claim
    from `/methodology` because no contact channel exists. **This is now the second page that
    wants one** — worth adding a contact route before a third does.
  - **No vendor or model version is named anywhere user-facing** (decided with user, same day).
    The page says "a general-purpose large language model from a commercial AI provider" and
    explains *why* it declines to name a version. Rationale: (a) **no disclosure regime requires
    it** — EU AI Act Art. 50 obliges disclosing that text is *artificially generated*, not whose
    system made it (and its carve-out is human review with editorial responsibility, which we
    have); Google requires no AI disclosure at all; FTC-style rules police the claims you *do*
    make, e.g. our "human reviewed" statement. (b) **`OUTLOOK_MODEL` / `ARTICLE_MODEL` are
    env-overridable**, so a named version can silently become false via a config change on the
    box — a trust page that is wrong is worse than one that is general. The page instead pins the
    guarantees to the *process* ("handed the numbers rather than asked for them… those guarantees
    belong to our process, not to any vendor's"). Verified: 0 vendor-name hits across 7 rendered
    pages. Keep it that way — model/vendor names belong in `CLAUDE.md` and code, not in copy.
  - **Content-overlap guard vs `/methodology`**: methodology owns data sources, signal/confidence
    semantics, cadence, and calculator math; ai-disclosure owns the model, the pipeline internals,
    privacy, and failure modes. Human review is summarised in one paragraph here and linked, not
    duplicated. Same duplicate-content lesson as the 2026-06-23 `/insights` ↔ `/articles` merge.
  - Verified: `tsc --noEmit` ✓, `eslint` ✓, `next build` ✓ (static, 34 routes), runtime 200,
    single `<h1>`, valid WebPage JSON-LD w/ `dateModified`, footer + methodology + sitemap links
    present, **axe-core 0 violations** on `/ai-disclosure` and `/methodology`.
  - Next from the gap analysis: **P1 macro inputs into Aureus** (DXY / real yields / silver as
    deterministic ground truth + a "macro pressure" panel — the constraint is free sources with
    acceptable terms), then the P2s (confidence prominence, `/insights` explainer/news split,
    evergreen explainer cluster).
- 2026-07-30: **P2 code items shipped** — confidence prominence + the `/insights` kind split.
  Sitemap **21 → 23 URLs**. No new deps. The third P2 (evergreen explainer cluster) is content
  commissioning, deliberately **not** run — see the bottom of this entry.
  - **`ConfidenceMeter`** (`components/market/confidence-meter.tsx`): three **rising** segments +
    a banded label (Low / Moderate / High). Conviction was previously plain text trailing the
    horizon (`"Next 1–4 weeks · Medium confidence"`); it now occupies its own bordered row in
    `OutlookCallCard`, reading as a peer of the signal badge rather than metadata. Bars are
    `aria-hidden` (the label already states the level) and **rise in height**, so the level
    survives greyscale — colour is never the only channel (WCAG 1.4.1, and the §8 rule about
    BUY/SELL). Compact `size="sm"` variant added to the home recommendation cards.
    `/outlook` gained a line linking to a new `#confidence` anchor on `/methodology`:
    conviction describes **evidence strength, not outcome probability**.
  - **`kind` is a new required field on the article contract** (`explainer` | `market-update`),
    deliberately **orthogonal to `category`**. The gap analysis assumed the split could be driven
    by category; it cannot — category is subject, and "Central Banks" contains both an evergreen
    explainer and two Fed-meeting reactions. Deriving one from the other mis-files both.
    **`ARTICLE_CONTRACT_VERSION` stays 1**: adding a field is backwards-compatible for
    `/api/v1/articles` consumers, which ignore unknown keys; bumping would break them for nothing.
  - **All 8 artifacts classified** on freshness expectation (explainer = the claim stays true;
    market-update = pegged to a datable event or a present-tense claim) → **5 explainers,
    3 market updates**. Migrated with a **text-level insert after the `category` line**, not a
    reserialize: the three hand-seeded editorial files use compact arrays, and `JSON.stringify`
    reflowed them into a 20-line diff. Final diff is **one line per file**.
  - **Routes are static folders, not a dynamic segment.** `/insights/[slug]` already occupies that
    level and **Next.js allows only one dynamic slug name per level** — a `[kindSlug]` sibling is a
    build error. `/insights/explainers` + `/insights/market-updates` are static routes sharing
    `InsightKindView`; copy/URLs live in `src/config/insight-kinds.ts`, the enum in the contract.
  - **⚠ Static segments silently win over `[slug]`**, so an article that derived the slug
    `explainers` would be **permanently unreachable**. `RESERVED_INSIGHT_SLUGS` now seeds
    `existingSlugs()` in `generate-article.mts`. **Verified by exercising it**, not by reading:
    patched the mock's title to "Explainers", ran the pipeline, got `explainers-2`, then removed
    the artifact and restored the mock.
  - **Duplicate-content guard** (the 2026-06-23 `/insights` ↔ `/articles` lesson): `/insights`
    stays the canonical full archive; each view has its own H1, its own intro stating that view's
    freshness contract, a self-referencing canonical, and `BreadcrumbList` JSON-LD. This is a
    normal category-archive relationship (subset of a parent), not the identical-set duplication
    that caused the earlier merge.
  - Generator updated so new drafts carry `kind`: `generatedArticleSchema` (required),
    `ARTICLE_PROMPT_VERSION` **2026-06-21.1 → 2026-07-30.1** with explicit guidance that the
    choice is about durability not topic ("would a reader arriving in six months still be well
    served?"), and the mock. A draft without `kind` now fails validation loudly in CI rather than
    landing mis-filed.
  - Verified: `tsc --noEmit` ✓, `eslint` ✓, `next build` ✓ (both views static + 1h ISR, 36
    routes), counts **8 = 5 + 3** across the three views, canonicals + h1s correct, sitemap
    entries present, `/api/v1/articles` returns `kind` on every item, **axe-core 0 violations**
    on `/`, `/outlook`, `/insights`, and both new views.
  - **NOT done — P2 evergreen explainer cluster.** That one is content commissioning, not code:
    it spends `ANTHROPIC_API_KEY` budget, publishes YMYL content, and topic choice is explicitly
    the owner's call (articles cron stays manual by preference, per 2026-07-28). Candidate titles
    are listed in the gap analysis §6. Run `npm run articles:generate` with `ARTICLE_TOPIC` set,
    one per topic, then review.
- 2026-07-30: **P1 macro ground truth + "Macro pressure" panel** (gap analysis P1, partly done —
  silver deferred, see below). New `FRED_API_KEY`; **inert without it**, so nothing breaks today.
  - **Source research is the substance of this entry — do not re-derive it.** Read FRED's actual
    terms, not a summary of them. The binding constraint is **per-series third-party copyright**:
    "Data series available through the FRED API may be owned by third parties… before using [them]
    for anything other than your own personal use, you must contact the data owner." Copyrighted
    series carry **"Copyrighted: Citation Required"** in their notes. Verified each series we use
    is `license: copyright-public-domain`:
    **DTWEXBGS** (broad dollar), **DFII10** (10y TIPS = real yield), **DGS10** (10y nominal).
  - **⚠ `T10YIE` (10-Year Breakeven Inflation Rate) IS copyright-flagged** — confirmed on the
    series page. So breakeven is **derived as `DGS10 − DFII10`** from the two clean series, which
    is the same quantity with no restriction. Don't "simplify" this back to fetching T10YIE.
  - **⚠ It is NOT "DXY".** The gap analysis said DXY; the ICE U.S. Dollar Index is **proprietary**
    and not ours to publish. We use the Fed's trade-weighted *broad* index. The system prompt
    explicitly forbids the model from calling it DXY, and the panel discloses the difference.
  - **Snapshot, not live read.** `macro` is stored in the outlook artifact at generation time and
    the panel renders from it. That is an integrity property: the numbers a reader sees are
    provably the ones the analysis reasoned over. A live panel could contradict the prose it sits
    above. Contract stays `CONTRACT_VERSION = 1` — `macro` is **optional**, so it is additive for
    `/api/v1/recommendations` consumers.
  - **`src/server/macro/index.ts` is deliberately NOT `server-only`** — unlike price/outlook, its
    only consumer is `scripts/generate-outlook.mts`, which runs under tsx outside Next and would
    crash on that import. Nothing in `src/app` imports it; the page reads the artifact.
  - FRED conventions handled: `value` is a **string** and `"."` means *no observation that day*
    (weekends/holidays) → filtered before use, or every weekend would become `NaN`. 60 days are
    fetched to leave headroom for a 30-day lookback after gaps. Breakeven is emitted **only when
    both legs share an observation date**, so we never subtract readings from different days.
  - Prompt `PROMPT_VERSION` **2026-06-20.1 → 2026-07-30.1**: macro block is ground truth, the model
    must state what the dollar and real yield are doing, must not describe an indicator as
    rising/falling against the supplied 30-day change, and must not invent the block when absent.
  - Verified: `tsc` ✓, `eslint` ✓, `next build` ✓, **axe 0 violations**. **30 assertions** against
    stubbed FRED responses (`scratchpad/fred-test.mts`): request shape, latest values, breakeven
    derivation, 30-day deltas, `"."`→NaN guard, mismatched-leg omission, non-200 propagation,
    contract validation. Pipeline run with mock + no key logs `macro=none` and produces a valid
    draft with no `macro` key. Panel + `/api/v1` verified by temporarily injecting a snapshot into
    `current.json` (reverted).
  - **Still open — silver + gold/silver ratio.** No free source with clean terms: FRED has no
    usable daily spot silver series, and CoinGecko's tokenized-silver proxies are far too illiquid
    to track spot the way PAXG tracks gold. Needs a metals vendor (metals.dev / MetalpriceAPI free
    tier) + a second key. `MacroProvider` takes it without touching prompt/artifact/panel.
  - **TODO to activate**: get a free key at https://fredaccount.stlouisfed.org/apikeys (same-day),
    add `FRED_API_KEY` to `.env.local` **and** as a GitHub Actions secret (already wired into
    `daily-outlook.yml`). The panel appears after the next generation run merges.
  - Note: the current hand-seeded `current.json` analysis body says "The US dollar (DXY)". The new
    prompt forbids that wording, so the next generated outlook self-corrects; not worth hand-editing
    published content.
- 2026-07-30: **P3 — theme toggle shipped; header price ticker built then REMOVED.** Closes the
  theme-toggle TODO open since Phase 0. No new dependencies.
  - **Header ticker was reverted the same day by product decision** (user): it did not add enough
    for our audience — physical-gold investors on a buy-and-hold horizon — to justify live price
    furniture on every page. Traders want an always-on tick; our reader does not. The price stays
    where it has intent behind it: `/trends` and `/outlook`. **Don't re-propose it** without a new
    reason; see the gap analysis P3 entry.
  - **⚠ Keep this finding even though the feature is gone.** A site-wide ticker **cannot** just
    lift the SSR-seeded `/trends` component into `SiteHeader`. The header is in the root layout, so
    an SSR'd price gets baked into **every** page's HTML — including fully static pages that emit
    `s-maxage=31536000` and sit in the Cloudflare edge cache for a **year** with no purge-on-deploy
    (2026-07-27). `/about` would have served a year-old gold price. Any future always-visible live
    value must be **client-fetched after mount**, so cached HTML carries no price at all. The same
    trap applies to anything else live placed in the layout.
  - **Theme toggle is dependency-free** (no `next-themes`). `components/theme/theme-script.tsx` is a
    **blocking inline script** — anything deferred or React-driven runs after first paint, which is
    the flash. Allowed because our CSP `script-src` already includes `'unsafe-inline'`. It sets the
    `dark` class (the Tailwind v4 variant is `@custom-variant dark (&:is(.dark *))`, i.e. class-based)
    plus `style.colorScheme` for native controls and scrollbars.
  - **`<html suppressHydrationWarning>` is required and is scoped to that one element** — the script
    legitimately mutates the root before hydration. Nothing below it is affected: `ThemeToggle`
    holds **no React state**, renders both icons, and swaps them with `dark:hidden` / `hidden
    dark:block`, so no descendant's markup depends on the theme. The accessible name is a static
    "Toggle dark mode" on purpose — a state-dependent label or `aria-pressed` would differ between
    server and client and reintroduce the mismatch.
  - Precedence: an explicit choice in `localStorage['gc-theme']` wins; otherwise
    `prefers-color-scheme`. Storage failures (private mode) are caught — the toggle still works for
    that page.
  - **Dark mode audited with axe for the first time** — it had only ever been checked numerically at
    Phase 1 (`scripts/check-contrast.mjs`), and a toggle makes it a first-class UI users actually
    reach. **0 violations across 8 pages** in emulated dark.
  - Verified in headless Chrome after the revert: OS preference respected both ways, click toggles +
    persists, stored choice survives navigation and overrides the OS, class present pre-paint,
    toggle is a focusable labelled `<button>`, **no price anywhere in the header** (markup or
    rendered), and **zero console errors** (no hydration warnings) on every path.
    `tsc` ✓, `eslint` ✓, `next build` ✓, axe 0 violations in light **and** dark.
- 2026-08-07: **Markdown content negotiation for agents** — `Accept: text/markdown` now returns
  Markdown at the origin. Closes the last open P1 in `docs/agent-readiness-checklist.md` §2
  (scanner check `markdownNegotiation`, the only requirement for Level 3 "Agent-Readable").
  No new dependencies.
  - **⚠ The Cloudflare toggle the checklist was waiting on is Pro-plan and up.** "Markdown for
    Agents" is documented as "available to Pro, Business and Enterprise plans" — we are on
    **Free**, the same wall as JS Detections (2026-07-27). It was never a one-click toggle for
    us. Don't re-file it as a pending dashboard task.
  - **Built at the origin instead, and that is the better artifact, not just the cheaper one.**
    Cloudflare's version converts our *rendered HTML* back to Markdown. Ours is generated from
    the data-access layer, and `analysisMarkdown` + `bodyMarkdown` are **already Markdown** in
    their artifacts — so we emit the source rather than a lossy round-trip, with no nav/footer
    chrome. The trade is coverage: the edge toggle would have covered every URL.
  - **`src/proxy.ts`, not a Server Component.** Reading the header via `headers()` inside a page
    would opt that route out of static rendering **for everyone** and forfeit edge caching — on
    a site with no purge-on-deploy that is a real cost. The proxy inspects `Accept` before
    routing, so every page kept its `○ Static` / `● SSG` status and ISR window (verified in the
    build output) and **no client JS was added**. Note Next 16 renamed `middleware.ts` →
    `proxy.ts` and `middleware()` → `proxy()`; the old name builds but warns.
  - **🔒 The matching rule is the whole risk surface.** `text/markdown` must appear
    **explicitly** and rank ≥ any explicit `text/html`; a wildcard never counts. Googlebot sends
    `text/html,…,*/*;q=0.8`, so matching `*/*` or `text/*` would serve Markdown to crawlers and
    to real people. `scripts/check-markdown-negotiation.mts` (`npm run check:markdown`) pins the
    real Accept headers of Googlebot, Bingbot, Chrome and Safari as test cases — **37
    assertions**. Keep that script green; it is the SEO guard.
  - **Cache-poisoning was already mitigated before this shipped** — the "Cache public pages"
    Cloudflare rule has excluded `Accept: text/markdown` since 2026-08-02 (re-verified: markdown
    request → `DYNAMIC`, normal → `HIT`), which is the right order. Responses also send
    `Cache-Control: no-store` as defense in depth. `Vary: Accept` is sent on Markdown responses
    only, **deliberately not on the HTML** — Cloudflare ignores `Vary` anyway and some
    intermediaries stop caching entirely when they see it.
  - **Covered**: `/`, `/outlook`, `/trends`, `/insights`, both kind views, `/insights/<slug>`.
    **Not covered on purpose**: `/about`, `/methodology`, `/ai-disclosure`, `/disclaimer` and the
    five tool pages — their prose lives in JSX with no Markdown source, so a twin would be a
    hand-maintained copy that drifts. They fall through to HTML, a valid negotiation outcome.
  - `/agent-markdown/*` (the rewrite target) is directly fetchable for curl testing and is
    **disallowed in robots.txt**. `X-Robots-Tag: noindex` was rejected: nothing links to the
    path, and a `noindex` on a body that could conceivably be miscached is a deindexing risk not
    worth taking.
  - **Two output bugs caught by reading the rendered Markdown, not by the type checker**: the
    macro table printed `Source: Source: FRED…` (the artifact's `macro.source` already begins
    with "Source:", which `macro-panel.tsx` relies on) and labelled yield changes `+0.17%` when
    they are percentage **points**. Both now mirror `components/outlook/macro-panel.tsx`,
    including its supportive/restrictive `pressure()` thresholds — the two renderings of one
    snapshot must not tell different stories.
  - Verified against a **standalone production build** (`node .next/standalone/server.js`, what
    the box runs): HTML `content-type` unchanged on 18 paths for both a default and a Googlebot
    `Accept`, and byte-identical between them on `/`, `/outlook`, `/insights`; Markdown served on
    all 7 covered routes with `no-store` + `Vary: Accept` + `X-Markdown-Tokens`; Markdown 404 for
    an unknown slug; `rss.xml` / `llms.txt` / `sitemap.xml` / `/api/v1/*` keep their own content
    types. `tsc --noEmit` ✓, `eslint` ✓, `next build` ✓ (38 routes), `npm run check:markdown` ✓.
  - **TODO after deploy**: re-run the scanner (`curl -X POST https://isitagentready.com/api/scan`)
    and update the table at the top of the checklist — expect Level 3.
- 2026-08-07: **Phase A — i18n foundation (English only).** First step of the multilingual build
  (Arabic first, Spanish-ready). Deliberately shipped with **only `en` enabled**, so the deployed
  site is unchanged while the whole machinery lands. New dep: `next-intl@4.13.5` (0 vulnerabilities,
  so the `security-audit` gate stays green).
  - **Decisions locked (with user):** English stays at the **root** and Arabic goes to `/ar/*`
    (`localePrefix: "as-needed"`) — every indexed URL keeps its exact address, no redirects, no
    ranking churn; translated articles **reuse the English slug** (1:1 hreflang mapping, and the
    kebab-case regex guards in the contract + the Edge proxy keep working); the long-form prose
    pages move to **Markdown artifacts** in Phase D; **next-intl** over a hand-rolled dictionary
    (Arabic has six plural forms — ICU is the reason, not convenience).
  - **`src/config/locales.ts` is the registry everything iterates** — routing, `generateStaticParams`,
    hreflang, `sitemap.ts`, and (Phase C) the translation pipeline. Two lists on purpose: `LOCALES`
    is what the *contracts* know about (so an artifact can be translated and reviewed before anyone
    can reach it), `ACTIVE_LOCALES` is what is routed. `ar` is present but `enabled: false`.
    `reviewPolicy: "native" | "assisted"` is the field that will make Spanish a config change.
  - **⚠ `localeDetection: false` is mandatory here, not a preference.** next-intl's default 307s on
    `Accept-Language`. Cloudflare caches our HTML and **ignores `Vary`** (2026-07-27), so that
    redirect would be stored under the URL's cache key and served to *everyone* — the same failure
    class as the RSC flight payload breaking the home page. `localeCookie: false` follows (a
    `Set-Cookie` on cacheable HTML is the other way to get a response pinned per-visitor).
    `alternateLinks: false` too: the middleware would advertise every locale for every path, and
    hreflang must only name translations that **exist** — a dangling hreflang is worse than none.
    Language switching is therefore always an explicit user action (`LanguageSwitcher`, plain
    crawlable `<a href>`s, renders nothing while one locale is active).
  - **`src/app/**` moved under `src/app/[locale]/**`**; `sitemap.ts`, `robots.txt`, `llms.txt`,
    `icon.svg`, `/api/**` and `/agent-markdown/**` stay at the root (one sitemap for all locales;
    the API is not a localized route). `setRequestLocale(locale)` is called in the layout **and
    every page** — Next 16.2 predates `next/root-params` being available without an experimental
    flag, and without it reading the locale forces dynamic rendering site-wide and forfeits the
    edge caching the whole SEO story rests on.
  - **⚠ The proxy matcher must NOT exclude dotted paths.** The usual next-intl matcher drops
    anything containing a `.`; `/insights/rss.xml` lives *inside* `[locale]`, so the unprefixed
    English form has to reach the middleware to be rewritten — excluding dotted paths 404s the feed.
    Root-level metadata routes are listed explicitly instead. Markdown negotiation is checked
    **first** and bypasses the intl middleware entirely (the Markdown route is outside `[locale]`
    and carries the locale as its first segment: `/agent-markdown/<locale>/<path>`).
  - **⚠ Metadata images are rewritten, never redirected** (`METADATA_IMAGE_ROUTE` in `proxy.ts`).
    These routes live under `[locale]`, so Next emits `og:image` as `/en/opengraph-image`, which
    `as-needed` prefixing would 307 to the unprefixed form — meaning every `og:image` on the site
    would point at a redirect, and several social scrapers do not follow redirects on images.
    Rewriting makes **both** spellings serve the PNG directly, which also protects the unprefixed
    URLs already in social caches. Both verified 200 `image/png`.
  - **Static rendering had two silent regressions, both caught in the build output and fixed**:
    `/insights/rss.xml` and the OG image routes went `ƒ` (dynamic) because a route handler or
    metadata image under a dynamic segment is generated on demand unless its params are enumerated.
    Both now export `generateStaticParams`. Rendering a satori PNG per request on a 1GB box is
    exactly what we do not want.
  - **`src/lib/format.ts` is now locale-aware** (memoized `Intl` instances per locale+kind, was
    module-level `en-US` singletons) and gained `formatLongDate` / `formatLongDateTime`, replacing
    three ad-hoc `en-US` formatters that had been inlined in `outlook/page.tsx`,
    `insights/[slug]/page.tsx` and the OG cards. It resolves a locale **code** to the registry's
    `intlLocale`, which carries the Unicode extension the route segment cannot: `ar` →
    **`ar-u-nu-latn`**, forcing Latin digits. Bare `ar` yields Arabic-Indic digits (٤٬١٦٠), which
    would clash with the Latin numerals on the SVG chart axis *in the same page*.
  - `structured-data.ts` builders all take a `locale`: URLs go through `localizePath` (an `@id`
    pointing at the English page from an Arabic page would undo the hreflang pairing) and every
    page-level entity declares `inLanguage`. `calculatorFaqSchema` now reads the catalog and
    delegates to `faqSchema`, so its four Q&As stop being duplicated in code.
  - `src/i18n/messages.ts` is a **sync** catalog accessor for code that formats strings outside a
    React render (`structured-data.ts`, `server/markdown/index.ts`, `.mts` scripts). Inside a
    Server Component use `getTranslations()` — this is the escape hatch, not the main road.
  - **`siteConfig.description` split into two catalog keys and this bit twice.** The old field was
    the *short* blurb used by JSON-LD, RSS and the Markdown builder, while the root layout's
    `metadata.description` was a different, longer sentence. Collapsing them onto `site.description`
    silently changed the home page's Markdown and the Organization/WebSite JSON-LD; caught by the
    baseline diff. They are now `site.description` (long, metadata) and `site.shortDescription`
    (JSON-LD/RSS/Markdown).
  - **Verified against a `main` baseline build**, not by inspection: both revisions built standalone
    and diffed page-by-page. **Byte-identical**: all Markdown representations, `sitemap.xml`,
    `insights/rss.xml`, `llms.txt`. HTML differs *only* by the intended additions (`dir="ltr"`,
    `og:locale`, `inLanguage`, a new `og:url` on `/outlook`, the `/en/…` OG image path) plus noise
    (React `useId` values, RSC flight strings, Next's `next-size-adjust` position, and the live spot
    price moving between runs). Route table matches, every ISR window preserved. `/en/*` → 307 to
    the unprefixed URL; `/ar/*` → 404 while disabled. `tsc --noEmit` ✓, `eslint` ✓, `next build` ✓,
    **`npm run check:markdown` 37/37** ✓.
  - **Sitemap detail worth keeping**: the home entry emits `siteConfig.url` with no trailing slash,
    matching the canonical Next emits byte-for-byte. `localizePath("/", locale)` returns `"/"`, so
    `absolute()` strips it — a sitemap URL differing from its own canonical by a slash is a needless
    "which one do you mean?" signal.
  - **⚠ Deploy trap: the lock file must be generated with the *container's* npm.**
    The first deploy of this work failed at `npm ci` with
    `Missing: @swc/helpers@0.5.23 from lock file`. Nothing was wrong with the code — it is a
    resolver-version split. `next` pins `@swc/helpers@0.5.15`; `@swc/core` (pulled in by
    next-intl) declares an **optional peer** `@swc/helpers >=0.5.17`. Local **npm 11** (Node 26)
    dedupes that peer away and omits the top-level entry; the Dockerfile's **node:22-alpine ships
    npm 10**, which materialises it and rejects the lock without it. Local `npm ci` *passed*, so
    the usual check does not catch this.
    Fix, and the recipe for next time a dependency is added from a machine on newer Node:
    `npx -y npm@10.9.4 install --package-lock-only` then `npx -y npm@10.9.4 ci` to verify.
    Regenerating this way changed no version pins and kept the production tree at 0
    vulnerabilities. **Do not** "fix" it by loosening the Dockerfile to `npm install` — `npm ci`
    is what makes the deployed tree reproducible.
  - **Next: Phase B — RTL readiness.** Enable `ar` with pseudo-translated catalogs (layout bugs
    before content exists): `dir` plumbing + Base UI `DirectionProvider`, ~60 directional utilities
    across 16 files → logical properties (`ms/me/ps/pe/border-s/text-start`; only 4 shadcn
    components are affected: sheet, badge, button, card), `rtl:rotate-180` on the 23 directional
    icons, a `<Num>` bidi-isolation component (without it `-0.85%` renders with the sign detached in
    Arabic prose), IBM Plex Sans Arabic via `next/font`, `dir="ltr"` on the price chart (time axis
    stays left→right, per financial convention), and axe in RTL × light **and** dark.
  - **⚠ Known regression, already encoded in `lib/og.tsx`: satori has no RTL support** — its README
    says so outright, and `next/og` is satori. Arabic text comes out as disconnected, reversed
    glyphs, which is worse than no text. `/ar/*` pages therefore fall back to `BrandCard` (Latin
    brand text only); the guard is already live in both dynamic OG routes. Per-article Arabic cards
    need a renderer with real shaping (`takumi`, but native binaries on arm64 Alpine) or an offline
    headless-Chrome pre-render. **Do not add localized text to an OG card until then.**
- 2026-08-11: **Phase B — RTL readiness.** Arabic is fully renderable and exercised end to end, but
  stays **off in production**: the registry keeps `ar` at `enabled: false`, and everything below was
  verified against a build with `NEXT_PUBLIC_LOCALES_ENABLED="en,ar"`. No new dependencies.
  - **Enablement is a build-time public var, and that is forced, not chosen.** `ACTIVE_LOCALES` is
    read by the language switcher (a client component), so a server-only var would be `undefined`
    in the browser bundle — the switcher would render on the server and vanish on hydration.
    It also decides which `[locale]` routes get prerendered, so it must be an `ARG` (wired through
    `Dockerfile` + `deploy.yml` from a repo **variable**, same pattern as the Turnstile site key);
    setting it only in the container's runtime env would prerender one locale set and ship a client
    bundle believing in another. The registry's `enabled` flag stays the source of truth for
    production — **opening a language to search engines should be a reviewed code change**, since
    enabling it makes it routed, sitemapped and hreflang-advertised. `locales.ts` throws at import
    if the canonical locale is ever excluded.
  - **⚠ Cascade-layer bug, and it failed silently.** The Arabic `--font-sans` override was written
    inside `@layer base`, while `:root` is unlayered — and **an unlayered declaration beats a
    layered one regardless of specificity**, so `html.font-arabic` lost to `:root` despite being
    more specific. Arabic rendered in Geist with the browser substituting a system face for every
    glyph. Invisible in a diff and in the HTML; caught only by reading `getComputedStyle`. The
    override now sits unlayered next to `:root` and `.dark`. **Keep it there.**
  - Related: `geistSans` moved off `--font-sans` onto `--font-geist-sans`, so `--font-sans` is a
    *token we control* rather than one next/font owns. Without that split, overriding it for Arabic
    would drop Geist entirely and the Latin runs inside Arabic prose ("PAXG", "XAU/USD", figures)
    would fall back to a system face. `--font-heading` follows `--font-sans` via `@theme inline`, so
    headings came along for free.
  - **⚠ `dir="ltr"` on the price chart belongs on the `<figure>`, not the plot wrapper.** Pinned to
    the wrapper first, which left the date axis (`<figcaption>`) and the sr-only table as RTL
    siblings: the line ran chronologically while its own axis was mirrored, so the chart read as
    starting today (Aug 11, left) and ending a month ago (Jul 13, right). Every automated check
    passed — 0 axe violations, no overflow, no console errors. **Caught by looking at a
    screenshot.** Time-series charts stay LTR in every locale (financial convention, Arabic press
    included), and it also keeps `geom.x()`, the pointer handler and the `left`-percentage tooltip
    honest, all of which measure from `rect.left`.
  - **`<Num>` (`components/market/num.tsx`) is a correctness fix, not styling.** `+`, `-`, `$` and
    `%` are bidi-*neutral*, so inside Arabic prose `-0.85%` reorders and the minus detaches — a fall
    renders as something that reads like a rise, on a site whose whole job is saying which way gold
    went. `<bdi dir="ltr">` opens an isolate. Applied to the outlook header, key levels, the macro
    panel, the ticker and the signed P/L values. Numeric table columns are covered generically by a
    `.tabular-nums { unicode-bidi: isolate }` rule rather than ~40 call-site edits.
  - **Currency is no longer `style: "currency"`; the unit is per-locale.** `Intl` renders USD in
    Arabic as `\u200f4,283.61 US$` — trailing "US$", invisible RLM prefix — which is CLDR-correct
    and not what Arabic financial media writes. **Decided with the owner (native speaker):
    `$4,283.61` in English, `4,283.61 دولار` in Arabic**, driven by a `currency: { unit, position }`
    field on the locale registry. The locale still governs everything mechanical (grouping,
    separator, Latin vs Arabic-Indic digits); only the unit and its side come from the registry.
    Also keeps invisible bidi control characters out of the JSON API and Markdown.
  - **⚠ Because the unit is a *word* in Arabic, a missing `locale` argument is now a visible bug,
    not a subtle one** — it prints `$` on an Arabic page. `lib/format.ts` still defaults to English
    (right for server code that has a locale in hand), so client components must never import it
    directly: **`useFormat()` (`lib/use-format.ts`) binds the formatters to `useLocale()`** and the
    seven interactive components (both charts/tickers, all five calculators) now go through it.
    Note the two card sub-components inside `gold-calculator.tsx` each need their own hook call —
    they format independently of their parent.
  - **Markdown representations deliberately stay on the canonical `$` form.** They are the
    machine-facing surface and already spell the ISO code out separately ("… USD per troy ounce",
    "Price (USD)"), so a localized unit would hand an agent `4,283.61 دولار USD`.
  - **⚠ Open for Phase C: `keyLevels[].value` is a literal string in the artifact** (`"$4,283.61"`),
    so Arabic pages render the header spot as `4,283.61 دولار` and the key-levels grid directly
    below it as `$4,283.61`. The Phase C field map must let that value be **reformatted** per locale
    rather than listing it as never-translated — the numeral-parity check in `i18n:check` is exactly
    what makes that safe, since it fails if any digit changes.
  - **The language switcher uses plain `next/link` + `localizePath`, deliberately.** next-intl's
    `Link` with a `locale` prop prefixes the *default* locale too, emitting `/en/outlook` — a URL
    that exists only to 307 to `/outlook`. That routes every language switch through a redirect and
    puts a redirecting URL behind an `hreflang` attribute. `localizePath` is the same helper behind
    our canonicals, hreflang and sitemap, so the switcher cannot disagree with what we advertise.
    The current language renders as `<span>`, not a self-link, which also stops `<Link>` prefetching
    the page you are already on.
  - Mechanical work: ~60 directional utilities across 19 files → logical (`ms/me/ps/pe/border-s/
    text-start/start-*/end-*`). **Two files deliberately excluded**: `ui/sheet.tsx` (its
    `data-[side=left]:left-0` variants are keyed to an explicit `side` prop — the *caller* picks the
    side, and `mobile-nav.tsx` now chooses it from the locale so the drawer opens from the inline
    end in both directions) and `price-chart.tsx` (pinned LTR, so physical offsets are correct).
    `button.tsx`/`badge.tsx` had `has-data-[icon=inline-end]:pr-*` — a *logical* selector applying
    *physical* padding, so icon gaps landed on the wrong side in RTL. 23 directional icons get
    `rtl:rotate-180`; `ArrowUpRight` is excluded on purpose (it means "opens off-site", a diagonal
    convention that is not reading-order dependent).
  - **`npm run check:rtl`** (`scripts/check-rtl.mjs`) drives system Chrome over CDP — nothing to
    install — and asserts, per page × theme: axe-core violations, console errors (hydration
    mismatches included), computed direction, document horizontal overflow, and the resolved body
    font. **22 page/theme combinations: 0 axe violations, 0 console errors, 0px overflow**, and the
    Arabic font resolves to `"IBM Plex Sans Arabic", …, Geist, …`. Note it needs
    `.next/static` + `public/` copied into `.next/standalone/` (the Dockerfile does this; running
    the standalone server locally does not) — otherwise the page renders unstyled and the run is
    meaningless rather than failing loudly.
  - Also verified in-browser: the switcher preserves the current path (`/outlook` → `/ar/outlook`,
    and back to `/outlook` not `/en/outlook`), the mobile drawer opens screen-left in RTL and
    screen-right in LTR, and the profit/loss calculator returns **identical arithmetic** in both
    locales (`+$312.00`, `+7.8%`, break-even `$4,081.63`).
  - **English regression gate**: an English-only build's Markdown representations, `sitemap.xml`,
    `insights/rss.xml` and `llms.txt` are **byte-identical** to the pre-i18n baseline, and no `/ar`
    routes are emitted. `tsc` ✓, `eslint` ✓, `next build` ✓, `check:markdown` 37/37 ✓.
  - **⚠ Deploy trap (broke the first Phase B deploy): an unset GitHub repo variable is an empty
    STRING, not absent.** `${{ vars.NEXT_PUBLIC_LOCALES_ENABLED }}` expands to `""` when the
    variable does not exist, Docker passes `ENV NEXT_PUBLIC_LOCALES_ENABLED=""`, and the obvious
    parse `env?.split(",").filter(Boolean)` yields `[]` — which is **truthy**, so the override won
    and the build had zero active locales. Locally the variable was genuinely `undefined`, `?.`
    short-circuited, and everything passed. The import-time guard did its job (loud failure, not a
    silent zero-locale site) but the condition was wrong. `locales.ts` now normalises "", "   " and
    "," all to `undefined`. Generalise the lesson: **any `vars.*`/`secrets.*` threaded through a
    Docker ARG arrives as `""` when unset**, so every such parser needs an emptiness check, and
    "works locally with the var unset" does not test the deployed path.
  - **Arabic chrome strings are a first draft and need a native review** — `src/content/i18n/ui/
    ar.json` covers nav, footer, the calculator FAQ and JSON-LD strings. Article and outlook bodies
    are still English on `/ar/*`; that is Phase C.
  - Next: **Phase C — contracts + translation pipeline** (per-locale artifacts, translatable-field
    map, glossary, `TranslationProvider`, and the `i18n:check` gate).
