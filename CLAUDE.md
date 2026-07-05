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
