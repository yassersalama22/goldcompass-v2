# AI Agent Readiness — audit + checklist

Source: Cloudflare's [Is It Agent Ready?](https://isitagentready.com/) scanner.
Scanned `https://goldcompass.app` on **2026-08-02**; re-scanned same day after the P1 deploy.

Re-run any time (the site's `/goldcompass.app` URL 404s — the report is driven by an API):

```bash
curl -s -X POST https://isitagentready.com/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url":"https://goldcompass.app"}' | python3 -m json.tool
```

Remediation docs for every check are published as skills at
`https://isitagentready.com/.well-known/agent-skills/<name>/SKILL.md`
(index: `/.well-known/agent-skills/index.json`).

---

## Result

**Level 2 — "Bot-Aware"** (of 5 levels) as last scanned. Level 3 "Agent-Readable" needs only
`markdownNegotiation`, which is now **built and verified locally** (§2) — it was *not* the
Cloudflare dashboard toggle the earlier scan assumed, because that feature is Pro-plan and up.
Re-scan after the next deploy to confirm Level 3.

| Category | Check | Status |
|---|---|---|
| Discoverability | robots.txt | ✅ pass |
| Discoverability | sitemap.xml | ✅ pass |
| Discoverability | Link headers | ❌ fail |
| Discoverability | DNS for AI Discovery (DNS-AID) | ❌ fail |
| Content accessibility | Markdown content negotiation | ✅ pass *(2026-08-07, origin-side)* |
| Bot access control | robots.txt AI rules | ✅ pass (wildcard applies to AI bots) |
| Bot access control | Content Signals | ✅ pass *(2026-08-02)* |
| Bot access control | Web Bot Auth | ⚪ neutral (informational) |
| Protocol discovery | API Catalog | ❌ fail |
| Protocol discovery | OAuth/OIDC discovery | ❌ fail |
| Protocol discovery | OAuth Protected Resource | ❌ fail |
| Protocol discovery | `auth.md` | ❌ fail |
| Protocol discovery | MCP Server Card | ❌ fail |
| Protocol discovery | A2A Agent Card | ❌ fail |
| Protocol discovery | Agent Skills index | ❌ fail |
| Protocol discovery | WebMCP | ❌ fail |
| Commerce | x402 / MPP / UCP / ACP / AP2 | ⚪ neutral (not a commerce site) |

The scanner detected `prices:multiple` on the page but correctly classified us as
**not a commerce site** — nothing is sold here, so all five commerce checks are neutral,
not failures.

Note the scanner's own preset for a "Content Site" only runs seven checks:
`robotsTxt`, `sitemap`, `linkHeaders`, `dnsAid`, `markdownNegotiation`, `robotsTxtAiRules`,
`contentSignals`. Under that lens we should now be **5/7** (was 4/7) once the markdown work is
deployed and re-scanned; P2 takes it to 6/7.
The remaining protocol-discovery failures are the "API / Application" preset, which matters
to us only because we genuinely publish `/api/v1`.

---

## P1 — Do these (cheap, real benefit, fits the SEO/agent-discovery goal)

### 1. Content Signals in `robots.txt` — ✅ **done, live, Level 2 reached**

- [x] Add `Content-Signal` directives to the wildcard block
- [x] Decide the three preferences (a **product/legal call, not a technical one**)
- [x] Deployed 2026-08-02; scanner confirms `contentSignals: pass` → **Level 2 "Bot-Aware"**

**Values shipped** — organic search is the entire acquisition channel (CLAUDE.md §2), and
being cited inside AI answers is the successor to that, so both stay `yes`; training
foundation models returns nothing to us and is the one use with no attribution path:

```
Content-Signal: ai-train=no, search=yes, ai-input=yes
```

Change that one line in [src/app/robots.txt/route.ts](src/app/robots.txt/route.ts) if the
policy call goes the other way. These are **declarations of preference, not access control** —
unenforced on their own. Enforcement would be `Disallow` rules or Cloudflare AI Crawl Control.

⚠️ `MetadataRoute.Robots` has no field for `Content-Signal` and no escape hatch, so
`src/app/robots.ts` was **replaced** by a hand-written route handler at
[src/app/robots.txt/route.ts](src/app/robots.txt/route.ts) (`force-static`, so it is still
prerendered exactly like the metadata route was). The alternative — injecting the line with a
Cloudflare Transform Rule — was rejected: it leaves the policy undiscoverable in git.

### 2. Markdown content negotiation (`Accept: text/markdown`) — ✅ **built at the origin, 2026-08-07**

- [x] Cache bypass added and **verified live** (2026-08-02) — a markdown request returns
      `cf-cache-status: DYNAMIC` on `/` and `/outlook` across repeats, while a normal request
      still returns `HIT`. The rule was correct *before* the feature existed, which is the right
      order and means shipping it cannot poison the cache.
- [x] ~~Turn on Cloudflare **Markdown for Agents** for the zone~~ — **not available to us.**
      The docs say it is "available to Pro, Business and Enterprise plans"; we are on **Free**
      (same wall as JS Detections, CLAUDE.md 2026-07-27). Implemented at the origin instead.
- [x] Origin implementation shipped — see "How it works" below.
- [ ] Verify after deploy: `curl -sI -H "Accept: text/markdown" https://goldcompass.app/` returns
      `content-type: text/markdown` **and** `cf-cache-status: DYNAMIC|BYPASS`
- [ ] Verify a normal `curl -sI https://goldcompass.app/` still returns `text/html` + `HIT|MISS`
- [ ] Re-run the scanner and update the table at the top (expect Level 3 "Agent-Readable")

**Why origin beat paying for the edge toggle.** Cloudflare's version converts our *rendered
HTML* back into Markdown. Ours is generated from the data-access layer, and the outlook analysis
and article bodies are **already Markdown** in their artifacts — so we emit the source instead of
a lossy round-trip, with no nav/footer chrome. It is also free, lives in git, and is testable in
CI. The trade is coverage: the edge toggle would cover every URL.

#### How it works

| File | Role |
|---|---|
| [src/lib/agent-markdown.ts](src/lib/agent-markdown.ts) | Pure decision layer: `prefersMarkdown()` + `hasMarkdownRepresentation()`. No Node APIs — the proxy runs in the Edge runtime. |
| [src/proxy.ts](src/proxy.ts) | Rewrites a negotiated request to the markdown route. Next 16 renamed `middleware.ts` → `proxy.ts`, `middleware()` → `proxy()`. |
| [src/server/markdown/index.ts](src/server/markdown/index.ts) | Builds each document from the data-access layer. |
| [src/app/agent-markdown/[[...slug]]/route.ts](src/app/agent-markdown/%5B%5B...slug%5D%5D/route.ts) | Serves it: `text/markdown`, `no-store`, `Vary: Accept`, `X-Markdown-Tokens`. |
| [scripts/check-markdown-negotiation.mts](scripts/check-markdown-negotiation.mts) | `npm run check:markdown` — 37 assertions. |

🔒 **The matching rules are strict on purpose, and the guard script is why.** `text/markdown`
must appear **explicitly** and rank at least as high as any explicit `text/html`. A wildcard
never counts — Googlebot sends `text/html,…,*/*;q=0.8`, so matching `*/*` or `text/*` would
serve Markdown to crawlers and to people. That is the single way this feature could damage SEO,
so the real Accept headers of Googlebot, Bingbot, Chrome and Safari are pinned as test cases.

**Covered:** `/`, `/outlook`, `/trends`, `/insights`, both kind views, `/insights/<slug>`.
**Deliberately not covered:** `/about`, `/methodology`, `/ai-disclosure`, `/disclaimer` and the
five tool pages — their prose lives in JSX with no Markdown source, so a twin would be a
hand-maintained copy that silently drifts. They fall through to HTML, which is a valid
negotiation outcome. `/insights/rss.xml`, `/llms.txt` and `/api/v1/*` keep their own types.

**Performance and SEO are untouched, verified against a standalone production build:** every
page kept its `○ Static` / `● SSG` prerender status and its ISR window, no client JS was added,
and HTML responses are byte-identical with and without a crawler `Accept` header. Reading the
header in a Server Component (via `headers()`) would have made these routes dynamic for
*everyone* and forfeited edge caching — that is why it is a proxy rewrite.

⚠️ `/agent-markdown/*` is directly fetchable (handy for curl), so `robots.txt` **disallows** it.
`X-Robots-Tag: noindex` was rejected: nothing links to the path, and a `noindex` header on a body
that could conceivably be miscached is a deindexing risk not worth taking for a path no crawler
will find.

⚠️ **Cache-key hazard, and we have history here.** Cloudflare ignores `Vary` except for
`Accept-Encoding` (CLAUDE.md, 2026-07-27). We already got burned by exactly this when the RSC
flight payload was cached under the HTML cache key and served to real browsers. A markdown
variant at the same URL is the same bug. The proper fix — putting `Accept` in the cache key —
is **not available on this plan**, same wall as the `RSC` header, so bypass is the only option.

🔥 **The clause goes *inside* the existing "Cache public pages" rule, not in a new rule above
it.** Cache Rules do not stop at the first match; every matching rule is evaluated in order and
later ones override earlier ones. A separate "Bypass markdown" rule at position 1 would be
overridden by the caching rule below it — precisely how the RSC payload leaked.

Dashboard → zone `goldcompass.app` → **Rules → Caching → Cache Rules** → edit
**"Cache public pages"** → *Edit expression*, and append:

```
and not any(http.request.headers["accept"][*] contains "text/markdown")
```

leaving both negations side by side:

```
... and not any(http.request.headers["rsc"][*] eq "1")
    and not any(http.request.headers["accept"][*] contains "text/markdown")
```

Header names are lowercase; `http.request.headers[...]` is an array so the `any(...)` wrapper is
required; `contains` rather than `eq` because `Accept` arrives as a long comma-separated list.
**Save, then purge everything** — fixing the rule without purging leaves any poisoned entry in place.

That rule is **still the primary guard** now that the origin serves Markdown. The route also
sends `Cache-Control: no-store` as defense in depth, so even if the clause were edited away a
Markdown body could not be stored under the HTML cache key. `Vary: Accept` is sent on the
Markdown responses for intermediaries that honour it, and deliberately **not** added to the HTML
responses — Cloudflare would ignore it anyway, and some intermediaries stop caching entirely
when they see it.

### 3. `llms.txt` ✅ done — not scored by this scanner, but the reason it exists

- [x] [src/app/llms.txt/route.ts](src/app/llms.txt/route.ts) — UTF-8 plain text, H1 + summary
      blockquote + linked sections for outlook/trends, all five calculators, insights (incl. both
      kind views + RSS), every published article, the trust pages, and the four `/api/v1` endpoints
- [x] Built from the same sources as `sitemap.ts` (site/tool/insight-kind config + the articles
      data-access layer), so it cannot drift from what is published

`revalidate = 3600` rather than fully static: the article list changes when a generated article
merges, and there is **no purge-on-deploy** (CLAUDE.md 2026-07-27), so a static year-long edge TTL
would go stale. `robots.txt` stays `force-static` — its body never changes.

---

## P2 — Do these if the public API is meant to be used by anyone but us

We publish a real, versioned, CORS-enabled JSON API (`/api/v1/price`, `/api/v1/recommendations`,
`/api/v1/articles`, `/api/v1/articles/[slug]`) — CLAUDE.md §4 calls it a first-class product
surface for future mobile/third-party clients. Today it is **completely undiscoverable**:
there is no spec, no docs page, and no catalog. These three tasks fix that, and #4 is a
genuine gap independent of this scanner.

### 4. Publish an OpenAPI spec

- [ ] Write `public/openapi.json` (or a route handler) describing the four `/api/v1` endpoints
- [ ] Derive the schemas from the existing zod contracts (`src/types/outlook.ts`,
      `src/types/price.ts`, `src/types/article.ts`) rather than hand-writing them — zod can
      emit JSON Schema, which keeps the spec honest as `CONTRACT_VERSION` moves
- [ ] Add a human-readable `/api` docs page (also gives the API a canonical, indexable URL)

### 5. API Catalog at `/.well-known/api-catalog` — RFC 9727

- [ ] Serve `application/linkset+json` with a `linkset` array
- [ ] Each entry: `anchor` + `service-desc` (the OpenAPI spec from #4) + `service-doc`
      (the `/api` page) + optionally `status`
- [ ] Depends on #4 — a catalog pointing at nothing is worse than no catalog

### 6. `Link` response headers on the homepage — RFC 8288 / RFC 9727 §3

- [ ] Add to `SECURITY_HEADERS`' sibling in [next.config.ts](next.config.ts) (a separate
      `headers()` entry scoped to `/`), e.g.
      `Link: </.well-known/api-catalog>; rel="api-catalog"`
- [ ] Consider also `rel="service-desc"` → the OpenAPI spec
- [ ] Depends on #5 for the target to exist

Multiple `Link` headers or one comma-separated value are both valid.

---

## P3 — Defer; revisit only if the trigger fires

Each of these is a real protocol, but each implies a capability GoldCompass does not have.
Listed with the trigger that would change the answer.

- [ ] **Agent Skills index** (`/.well-known/agent-skills/index.json`) — publish skills teaching
      an agent to use our API/calculators. *Trigger: after #4+#5, this is the cheapest remaining
      win and the only P3 item worth doing speculatively.* Requires a `$schema` field, and each
      skill needs `name`, `type`, `description`, `url`, `digest` (sha256 of the artifact) — so
      it needs a build step to keep digests correct.
- [ ] **MCP Server Card** (`/.well-known/mcp/server-card.json`) — requires actually running an
      MCP server. *Trigger: we decide agents should query gold prices/outlook conversationally.*
      Note this would be the first always-on stateful surface on a 1GB t4g.micro.
- [ ] **WebMCP** (`navigator.modelContext` tool registrations in-page) — would let an in-browser
      agent drive the calculator directly. *Trigger: the tool hub gets meaningful agent traffic.*
      Nearest thing to a real fit for us among the P3s.
- [ ] **DNS-AID** (`_index._agents.goldcompass.app` SVCB/HTTPS records) — only meaningful once
      there's an agent endpoint to point at. *Trigger: MCP or A2A ships.* Also wants DNSSEC on
      the zone.
- [ ] **Web Bot Auth** — scanner reports this as *neutral/informational*, not a failure. It's for
      sites that want to verify bot identity. *Trigger: we start gating content by bot identity —
      which contradicts wanting to be indexed.*

---

## Not applicable — deliberately not doing

Recording the reasons so this doesn't get re-litigated at the next scan.

- **OAuth/OIDC discovery, OAuth Protected Resource, `auth.md`** — there is no auth. Phase 8
  (accounts) is deferred indefinitely, and `/api/v1` is intentionally public and unauthenticated.
  Revisit only with Phase 8.
- **A2A Agent Card** — we don't expose an agent. Also excluded from the scanner's own "API /
  Application" preset.
- **x402, MPP, UCP, ACP, AP2** — commerce protocols. Nothing is sold; the scanner already
  classified us as non-commerce and scored these neutral. The `prices:multiple` signal it
  detected is gold spot prices, not products.

---

## Ordering

1. ~~Content Signals (#1)~~ — ✅ live, Level 2 reached.
2. ~~`llms.txt` (#3)~~ — ✅ live.
3. ~~Cache bypass for `Accept: text/markdown`~~ — ✅ live and verified.
4. ~~Markdown negotiation (#2)~~ — ✅ built at the origin; re-scan after deploy → **Level 3**.
5. OpenAPI (#4) → API Catalog (#5) → Link headers (#6) — one chain, in that order.
6. Re-run the scanner and update the table at the top.

### Minor, noticed on the re-scan

- `/llms.txt` returns `cf-cache-status: DYNAMIC` — the "Cache public pages" rule matches HTML
  only, so it hits origin every request. Harmless at 54 lines, and it *is* the safe default
  given no purge-on-deploy. Only worth a cache rule if agent traffic to it becomes real.
