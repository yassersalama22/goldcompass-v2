# Competitive & Gap Analysis — goldcompass.ai

**Prepared:** 2026-07-30
**Subject:** https://goldcompass.ai/ vs. https://goldcompass.app/ (this project)
**Method:** Direct crawl of their public site — homepage, `/tools` (all 6 tool pages), `/blog`,
`/blog/news`, `/ai-disclosure`, `sitemap.xml`, `robots.txt`, response headers, and rendered
JSON-LD — cross-referenced against our live sitemap, route inventory, and `CLAUDE.md`.
Their app itself was **not** installed, so app-side claims below are taken from their own
marketing copy and should be treated as claims, not verified behaviour.

---

## 1. Executive summary

**They are not the competitor the domain name suggests.** goldcompass.ai sells a **mobile app for
leveraged XAUUSD traders** — lots, pips, margin, leverage, M15/H1/H4 timeframes. Their website is
a marketing funnel + SEO surface for app installs, monetised by an in-app freemium subscription.
We are a **free, web-first SEO property for everyday investors buying physical gold** — budget,
karat, dealer premium, break-even.

Different ICP, different business model, different monetisation. But three things make them
worth taking seriously:

1. **Brand collision.** `goldcompass.ai` vs `goldcompass.app`. Anyone searching "gold compass"
   now gets two results, and theirs has an app-store footprint we don't. This is the single
   most material risk on this page and it is not fixable by shipping features.
2. **They out-execute us on SEO surface area with less product.** 28 sitemap URLs to our 16,
   built by splitting *one* feature (a calculator) into *seven* indexable pages. That is the
   most copyable thing they do.
3. **Two of their six tools target our audience, not theirs.** The karat purity calculator and
   the unit converter are retail physical-gold-buyer queries. They are ranking on our turf with
   pages we don't have.

Conversely, we are **substantially stronger where it counts for trust**: we make an actual
directional call with an invalidation level, we cite sources on every piece, and we
human-review before publishing. Their AI disclosure enumerates hallucination risk and
**describes no human review at all**.

**Top three recommendations** (detail in §6): split the calculator into a tool hub; feed DXY /
real yields / silver / crude into the Aureus prompt as deterministic ground truth and surface
it as a "macro pressure" panel; fix our generated-article slugs.

---

## 2. Side-by-side

| | **goldcompass.ai** (them) | **goldcompass.app** (us) |
|---|---|---|
| Primary product | iOS/Android app | Website |
| Audience | Leveraged XAUUSD/CFD traders | Everyday physical-gold investors |
| Website's job | Install funnel + SEO | *Is* the product |
| Monetisation | Freemium, in-app subscription | None (newsletter capture) |
| Directional call | **Explicitly refuses** ("not a signal app", "does not predict") | **Yes** — short-term + long-term, with confidence + invalidation |
| Source citations | None visible | Every outlook and article |
| Human review | Not mentioned anywhere | Draft → human approve → publish |
| Data inputs | Spot + DXY, yields, volatility, crude, silver (claimed) | XAU spot only (PAXG proxy) |
| Calculators | 6, one page each | 1, combined |
| Blog | 9 evergreen tutorials, **news section empty** | 8 pieces, web-grounded, current-events |
| Public API | "API Terms" page, no public API found | **Live, versioned, free, CORS-enabled** |
| Legal pages | 8 (incl. AI Disclosure, Acceptable Use, API Terms) | 2 (`/disclaimer`, `/methodology`) |
| Theme toggle | Yes (dark default, persisted) | No |
| Header price ticker | Yes, site-wide | Only on `/trends`, `/outlook` |
| Stack | Next.js, nginx, `s-maxage=20` | Next.js standalone, Docker, Cloudflare |

---

## 3. What they have that we don't

### 3.1 A tool hub — six calculators, six URLs ⭐ biggest gap

`/tools` plus one page each for:

| Tool | Inputs → Outputs | Relevant to us? |
|---|---|---|
| Gold Position Size Calculator | balance, risk %, entry, stop → lot size | ✗ trader-only |
| XAUUSD Pip Value Calculator | lot size → $/pip, $/point | ✗ trader-only |
| Gold Profit & Loss Calculator | entry, exit, lots → P/L, notional | ~ we have P/L scenarios |
| Gold Margin Calculator | size, leverage → margin, notional | ✗ trader-only |
| **Gold Unit Converter** | troy oz ↔ g ↔ kg ↔ oz, live table | ✅ **directly ours** |
| **Gold Karat Purity Calculator** | karat + spot → fineness, price/gram | ✅ **directly ours** |

The structural lesson is not the tools — it's the **page architecture around each one**:

- Its own URL, its own `<title>`, its own breadcrumb.
- The tool, then substantial educational prose ("About", a worked example at a concrete price),
  then a **"Common mistakes"** block, then a **4-question FAQ**.
- JSON-LD: `BreadcrumbList` + `FAQPage` + `SoftwareApplication` + `Organization`.
- Left sidebar cross-linking every sibling tool → tight internal link graph.

We have **one** `/calculator` page carrying budget + purity + premium + break-even + P/L. It is a
better *tool* than any of theirs. It ranks for a fraction of what it could, because six distinct
search intents are collapsed into one URL.

### 3.2 Multi-input macro context

They claim to combine **DXY, real yields, volatility, crude, and silver** with spot gold. We feed
the Aureus prompt spot price and 30-day change only. `CLAUDE.md` §12 already anticipates this
("later DXY/yields") — they've shipped it and we haven't.

### 3.3 The "six lenses" framing

Their whole product is organised into six named, repeated concepts:

| Lens | Their copy |
|---|---|
| Market Mood | "Understand the current pressure behind gold." |
| Macro Pressure | "Track the forces that may affect gold." |
| Important Levels | "Monitor zones where price may react." |
| Trap Awareness | "See unstable and misleading conditions." |
| Risk Score | "Adjust awareness as conditions change." |
| AI News | "Understand market news faster." |

Hero: *"Decode Gold. Before the noise."* Sub: *"Market mood. Macro pressure. Important levels.
Hidden market risks."*

This is a genuinely good **information-architecture** move, independent of the underlying
analysis quality. A named, stable vocabulary makes a probabilistic product feel legible and
gives every page a consistent scaffold. Our outlook has the same ingredients (signal, confidence,
key levels, invalidation, sources) but they're presented as fields on a report rather than as a
branded lens the reader learns once and reuses.

### 3.4 Blog split into Tutorials vs News

Two categories with different `changefreq` (news daily, tutorials weekly) and separate index
pages at `/blog/tutorials` and `/blog/news`. Their tutorial cluster is a clean evergreen
topic map — *What Moves Gold Prices*, *How Do Interest Rates Affect Gold*, *What Are Real
Yields*, *What Happens During an FOMC Meeting*, *Understanding the Economic Calendar*.

Worth noting for morale: **`/blog/news` is empty** — "No articles published yet." All nine of
their posts are undated-in-substance tutorials published in a two-week burst in July 2026.

### 3.5 A dedicated `/ai-disclosure` page

Separate from Terms/Privacy/Risk. It states AI outputs "may hallucinate, malfunction,
misclassify, omit information, generate inaccurate summaries, produce contradictory outputs,
fail during volatility, or degrade under abnormal market conditions," and that users are "solely
responsible for independent verification."

It is a liability shield, not a methodology. But having it as **its own indexable URL** is
correct — it's becoming an expected artifact for AI-assisted YMYL content.

### 3.6 Smaller items

- **Economic-calendar awareness** — a full tutorial on it; the app likely surfaces event timing.
  FOMC/CPI/NFP dates matter to investors too, not just traders.
- **Header price ticker on every page** (4,036.75, −0.72% observed) — persistent value signal.
- **Light/dark theme toggle**, persisted to `localStorage`, dark by default. Ours has been an
  open Phase 0 TODO since day one.
- **App-store presence** = a second discovery channel and ASO surface we have no equivalent of.
- **A revenue model.** They can pay for data feeds; we currently cannot.

---

## 4. Where we are clearly stronger

1. **We make a call; they refuse to.** Their own FAQ answers "Is GoldCompass a signal app?" and
   "Does it predict gold?" in the negative. Our SELL-30d / BUY-12m with an explicit
   **invalidation level** is a more useful, more differentiated output. It carries more YMYL risk
   — which is exactly why the human-approval gate exists.
2. **Citations on everything.** Every outlook and article carries a sources list. Nothing on
   their site cites a source; their AI disclosure names hallucination as a risk and offers no
   mitigation.
3. **Disclosed human review.** `/methodology` states plainly that analysis is AI-drafted and
   human-reviewed, and — importantly — what review does *and does not* check. Their disclosure
   has no human in the loop at all. On YMYL this is our single biggest E-E-A-T advantage over
   them, and it costs them nothing to copy, so we should be loud about it.
4. **A real public API, free and versioned.** `/api/v1/{price,recommendations,articles}`,
   CORS-enabled, cache-friendly. They have an *API Terms page* and no findable API.
5. **Physical-gold buyer economics.** Break-even including dealer premium, six P/L scenarios,
   purity handling. No trader calculator addresses "I have $5,000 and want 22K jewellery."
   This is our moat and they cannot follow us here without abandoning their positioning.
6. **Genuinely current content.** Our July pieces track the Fed/Warsh hawkish hold, Iran
   tensions, energy inflation. Theirs are timeless explainers with an empty news feed.
7. **No install, no account, no paywall, fully server-rendered.**

---

## 5. Methodology points of theirs that are actually valid

Filtering for what survives translation to an investor audience:

| Their idea | Verdict | Why |
|---|---|---|
| **Deterministic multi-input ground truth** (DXY, real yields, crude, silver, vol) | ✅ **Adopt** | Best idea on their site, and it's already in our §12 roadmap. Gold's drivers *are* the dollar and real yields. Feeding these as facts constrains the LLM further and produces better analysis. |
| **Probabilistic scoring over binary signals** | ✅ **Adopt partially** | We already store `confidence`; we lead with BUY/SELL and bury it. Surfacing conviction as a first-class, visually prominent element is more honest and more defensible on YMYL. Do **not** drop the call — that's our differentiator. |
| **A named, repeated vocabulary of lenses** | ✅ **Adopt the pattern** | Not their six names — ours. Give the outlook a stable, learnable structure the reader recognises across visits. |
| **Standalone AI-disclosure URL** | ✅ **Adopt** | Cheap. Ours will be stronger than theirs because we can truthfully describe review. |
| **"Common mistakes" blocks on tool pages** | ✅ **Adopt** | Long-tail SEO + genuine user value (e.g. "retail price ≠ spot × purity; making charges are excluded"). |
| **Explicit "what this is not" section** | ✅ **Adopt** | Sharper expectation-setting than a generic disclaimer. |
| **Trap awareness** (flagging unstable/misleading conditions) | ~ **Reframe** | The trader version (stop hunts, fakeouts) is irrelevant to us. The investor version — "this move is thin//event-driven, don't read a trend into it" — is genuinely useful and fits our tone. |
| **Economic calendar** | ~ **Content first** | Publish the explainer; a live calendar feature needs a data source we don't have. |
| **Timeframe granularity (M15/H1/H4)** | ❌ Reject | Actively wrong for a 30-day/12-month investor horizon. |
| **Lots / pips / margin / leverage tools** | ❌ Reject | Wrong audience. Would dilute topical authority and attract traffic that never subscribes. |
| **"We don't predict anything" positioning** | ❌ Reject | The inverse of our value proposition. |

**One caution on their methodology:** it is unfalsifiable by design. Six qualitative lenses, a
risk score, no sources, no stated inputs, no human review, and a disclosure saying the output may
be wrong in eight enumerated ways. It is well-packaged, and there is no way to check whether any
of it works. Copy the *packaging*, not the epistemics.

---

## 6. Recommendations, ranked

### ~~P0 — Split `/calculator` into a tool hub~~ ✅ done 2026-07-30
The highest-leverage item on this list. Keep the current combined calculator as the flagship at
`/calculator`, and add sibling pages sharing the existing `src/lib/calculator.ts` math:

- `/calculator/gold-karat-price` — karat → fineness → price per gram (directly contests their page)
- `/calculator/gold-unit-converter` — troy oz / g / kg / tola / oz
- `/calculator/gold-break-even` — spot + dealer premium → break-even
- `/calculator/gold-profit-loss` — entry, exit, quantity → P/L

Each with: breadcrumb, `FAQPage` JSON-LD, "About" prose with a worked example at a real current
price, a "Common mistakes" block, and a sibling-tool sidebar. Reuse `Prose` and the existing
`calculatorFaqSchema()` helper. Roughly doubles our indexable surface using code we already have.

**Implemented**, all four pages, as specified — plus `WebApplication` and `BreadcrumbList` JSON-LD
alongside the `FAQPage`. Sitemap went 16 → 20 URLs. Two deviations worth noting: worked examples
are **computed from the live spot price at render time** rather than hard-coded at "a real current
price", so they never go stale under ISR; and a generic `faqSchema()` was added instead of reusing
`calculatorFaqSchema()`, so each page's FAQ markup is generated from the same array the page
renders visibly and cannot drift from it. The break-even and P/L tools also model a **sell-side
spread**, which the flagship calculator does not. See `CLAUDE.md` 2026-07-30 for the full record.

### ~~P0 — Fix generated-article slugs~~ ✅ done 2026-07-30
`scripts/generate-article.mts:57` builds `${date}-${kebab(title)}` with `kebab()` truncating at
60 chars, producing:

```
/insights/2026-07-30-fed-holds-rates-again-what-warsh-s-hawkish-hold-means-for-go
```

Three problems: the date prefix pushes keywords right and dates the URL permanently; the
truncation cuts mid-word (`-go`); and it's inconsistent with our seeded articles, which have
clean slugs (`/insights/why-central-banks-keep-buying-gold`). Strip the date prefix from the
slug (keep it in the filename for ordering), truncate on a word boundary, and 308-redirect the
five existing generated URLs.

**Implemented.** Slug is now date-free with the date retained in the filename; `MAX_SLUG_LENGTH`
raised 60 → 80 (the prefix no longer consumes 11 chars) with word-boundary truncation, so every
current title fits whole and `…means-for-go` became `…means-for-gold`. Five artifacts migrated,
five 308 redirects added. This also closed a latent **silent-overwrite** bug: a same-day rerun on
the same title previously produced an identical filename and clobbered the earlier artifact — a
`uniqueSlug()` guard now disambiguates. See `CLAUDE.md` 2026-07-30 for the full record.

### P1 — Feed macro inputs into Aureus + ship a "Macro pressure" panel
Extend the deterministic ground-truth block beyond spot: **DXY, 10Y real yield, silver, and
gold/silver ratio** at minimum. Two payoffs — better-grounded analysis, and a new SSR'd panel on
`/outlook` (and possibly its own page) that is both useful and indexable. Fits the existing
`PriceProvider` abstraction; the constraint is finding free sources with acceptable terms.

### P1 — `/ai-disclosure` page
Standalone URL, linked from footer and `/methodology`. State the model, the web-search grounding,
the deterministic-inputs-vs-narrative split, the sanitisation step, the human-approval gate, and
the honest limitations. Ours is a *stronger* document than theirs because we have a real process
to describe — lead with that.

### P2 — Surface confidence more prominently on `/outlook`
Give conviction equal visual weight to the BUY/SELL badge. Consider a banded label
(low / moderate / high) rendered as a component, not buried body text.

### P2 — Split `/insights` into Explainers and Market Updates
Same store, two filtered views plus a category chip on cards. Our evergreen explainers and our
Fed-meeting reactions serve different intents and different freshness expectations, and the
combined feed dilutes both.

### P2 — Evergreen explainer cluster
Their tutorial titles are a validated keyword map. We have partial coverage. Missing and worth
commissioning through the existing article pipeline, angled at investors rather than traders:
*What moves gold prices*, *Gold and interest rates*, *Real yields and gold*, *Gold vs inflation —
why the relationship breaks*, *What is an economic calendar and which events matter for gold*.

### P3 — Header price ticker site-wide, and a theme toggle
The ticker component already exists; lifting it into `SiteHeader` gives every page a live value
signal. The theme toggle has been an open TODO since Phase 0 and is table stakes now.

### P3 — Brand-collision monitoring
Track ranking for the bare query "gold compass" and consider defensive branded content. Not
urgent, not solvable by features, but worth knowing which way it's trending. Their `.ai` domain
plus app-store listings give them an advantage on branded search that we should at least measure.

---

## 7. Explicitly not recommended

- **A mobile app.** Their model justifies it (subscription revenue); ours doesn't. Our §4
  API-first architecture keeps the option open at zero ongoing cost — that's the right posture.
- **Trader tools** (lots, pips, margin, leverage). Wrong audience, dilutes topical authority.
- **A paywall.** Our entire strategy is organic search + free access. Gating content would
  undercut the one thing that's working.
- **Dropping the directional call** to match their safer positioning. It's our differentiator,
  and the human-approval gate is what makes it defensible.

---

## 8. Sources

- https://goldcompass.ai/ — homepage, hero copy, six lenses, free/premium tiers, on-page FAQ
- https://goldcompass.ai/tools + all six tool pages
- https://goldcompass.ai/blog and https://goldcompass.ai/blog/news
- https://goldcompass.ai/ai-disclosure
- https://goldcompass.ai/sitemap.xml (28 URLs) and /robots.txt
- Rendered JSON-LD and HTTP response headers, captured 2026-07-30
- Our own: live sitemap (16 URLs), route inventory, `CLAUDE.md` §4/§12/§13
