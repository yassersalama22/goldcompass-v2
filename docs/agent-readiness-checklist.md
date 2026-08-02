# AI Agent Readiness — audit + checklist

Source: Cloudflare's [Is It Agent Ready?](https://isitagentready.com/) scanner.
Scanned `https://goldcompass.app` on **2026-08-02**.

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

**Level 1 — "Basic Web Presence"** (of 5 levels). Next rung is **Level 2 — "Bot-Aware"**,
and its *only* requirement is `contentSignals`. So the single highest-leverage task in this
whole document is ~6 lines in `robots.ts`.

| Category | Check | Status |
|---|---|---|
| Discoverability | robots.txt | ✅ pass |
| Discoverability | sitemap.xml | ✅ pass |
| Discoverability | Link headers | ❌ fail |
| Discoverability | DNS for AI Discovery (DNS-AID) | ❌ fail |
| Content accessibility | Markdown content negotiation | ❌ fail |
| Bot access control | robots.txt AI rules | ✅ pass (wildcard applies to AI bots) |
| Bot access control | Content Signals | ❌ fail |
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
`contentSignals`. Under that lens we're 3/7 — and P1+P2 below takes us to 6/7.
The remaining protocol-discovery failures are the "API / Application" preset, which matters
to us only because we genuinely publish `/api/v1`.

---

## P1 — Do these (cheap, real benefit, fits the SEO/agent-discovery goal)

### 1. Content Signals in `robots.txt` — *unlocks Level 2 on its own*

- [ ] Add `Content-Signal` directives to the wildcard block in
      [src/app/robots.ts](src/app/robots.ts)
- [ ] Decide the three preferences (this is a **product/legal call, not a technical one**):
      `ai-train` (train models on our content), `search` (index for search),
      `ai-input` (use as RAG/grounding input for AI answers)
- [ ] Verify the emitted `/robots.txt` and re-run the scanner

Recommended values for GoldCompass — organic search is the entire acquisition channel
(CLAUDE.md §2), and being cited inside AI answers is the successor to that, so both should
stay `yes`; model training returns nothing to us:

```
Content-Signal: ai-train=no, search=yes, ai-input=yes
```

⚠️ `MetadataRoute.Robots` has no field for this. Next's `robots.ts` can't emit an arbitrary
directive, so either replace it with a hand-written `src/app/robots.txt/route.ts` that
returns `text/plain`, or keep `robots.ts` and inject the line via a Cloudflare Transform
Rule. Prefer the route handler — the source of truth belongs in the repo, and Cloudflare's
AI Crawl Control dashboard is the other option but leaves no trace in git.

### 2. Markdown content negotiation (`Accept: text/markdown`)

- [ ] Turn on Cloudflare **Markdown for Agents** for the zone (dashboard toggle, zero code)
- [ ] Verify: `curl -sI -H "Accept: text/markdown" https://goldcompass.app/` returns
      `content-type: text/markdown`
- [ ] Confirm it doesn't collide with the RSC cache rule (see the ⚠️ below)

This is the check with the best effort-to-value ratio after Content Signals — agents that
fetch our pages get clean markdown instead of parsing HTML, and our articles/outlook are
markdown upstream anyway.

⚠️ **Cache-key hazard, and we have history here.** Cloudflare ignores `Vary` except for
`Accept-Encoding` (CLAUDE.md, 2026-07-27). We already got burned by exactly this with the
RSC flight payload being cached under the HTML cache key and served to real browsers.
A markdown variant at the same URL is the same shape of bug. Before enabling, confirm
Cloudflare's Markdown for Agents keys the variant separately; if it doesn't, add a Cache
Rule that bypasses cache when `Accept` contains `text/markdown`, mirroring the
`and not any(http.request.headers["rsc"][*] eq "1")` fix.

Doing it at the origin instead is possible (a route that serves the article's raw markdown
body) but only covers `/insights/*` and `/outlook`, not the calculator/tool pages, and it
duplicates rendering. Prefer the edge toggle.

### 3. `llms.txt` (not scored by this scanner, but the reason it exists)

- [ ] Add `src/app/llms.txt/route.ts` returning UTF-8 plain text: `# GoldCompass`, a summary
      paragraph, then links to `/outlook`, `/trends`, `/calculator` (+ tool siblings),
      `/insights`, `/methodology`, `/ai-disclosure`, and the `/api/v1` endpoints
- [ ] Generate the content section from the same data-access layer the sitemap uses, so it
      never drifts from published articles

The scanner ships a `llms-txt` skill but doesn't run the check. Do it anyway — it's the
single most widely-consumed agent-discovery file right now, it's static, and it costs
nothing to serve.

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

1. Content Signals (#1) — reaches Level 2 alone, ~1 file.
2. Markdown negotiation (#2) — dashboard toggle, but read the cache-key warning first.
3. `llms.txt` (#3) — unscored, highest real-world agent value.
4. OpenAPI (#4) → API Catalog (#5) → Link headers (#6) — one chain, in that order.
5. Re-run the scanner and update the table at the top.
