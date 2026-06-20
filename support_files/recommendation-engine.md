# How the recommendation engine works

It's a fully automated daily pipeline ("Aureus") that produces a long-form gold market analysis plus three structured BUY/HOLD/SELL outlooks, in three languages, and serves them to the UI.

1. Trigger — pg_cron
A Postgres `pg_cron` job runs every day at 06:00 UTC and `pg_net.http_post`s the `daily-gold-report` edge function (once per language: en / es / ar). The same function is also callable on demand from Admin → Settings → "Run Now" via `SettingsManager.tsx`.

2. Prompt — `app_settings` table
The function loads the system prompt from `app_settings` where `key = 'aureus_system_prompt'`. This is the editable "Aureus" persona (gold analyst instructions + required HTML report structure). RLS allows authenticated reads but admin-only writes, so admins can tune the persona without redeploying.

3. Generation — Gemini 3.1 Pro + Google Search Grounding
`supabase/functions/daily-gold-report/index.ts` calls the native Google AI Studio API:

``` txt
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent
```

with:

- `system_instruction` = the Aureus prompt from `app_settings`
- `contents` = a user message that injects today's date and a language directive ("Write the report in Spanish/Arabic/English, output ONLY valid HTML")
- `tools: [{ google_search: {} }]` → real-time web grounding for today's prices / news
- `generationConfig.thinking_config.thinking_level = "MEDIUM"` for deeper financial reasoning
- `temperature: 0.7`, `maxOutputTokens: 8192`

Lovable AI is not used here because it doesn't expose Google Search Grounding; the native API requires the user-supplied `GEMINI_API_KEY` secret.

1. HTML sanitization (`sanitizeGeminiHtml`)
The raw model text is hardened before it touches the DB:
1. Trim and strip ```` ```html ```` / ```` ``` ```` code fences.
1. Drop anything before the first `<` and after the last `>` (kills AI chatter / preambles).
1. Remove `<think>…</think>` blocks and `[internal …]` tokens.
1. Require at least one block-level tag (`h1-6|p|div|ul|ol|table|blockquote|section|article`) — otherwise return `null` and abort.
1. Sanity-check `<` vs `>` counts (must differ by ≤ 2) to catch broken markup.

If sanitization fails → function logs, calls `notifyAdminsOfFailure` (shared helper that emails admins via the email queue) and returns a 500 with `fallback: true` without writing the DB. The previous day's report stays visible.

1. Structured extraction — Lovable AI
The sanitized HTML is then sent to Lovable AI Gateway (`google/gemini-3-flash-preview`) with a single forced tool call `extract_recommendations`, JSON-schema-typed:

```ts
{
  short_term_outlook: "BUY" | "HOLD" | "SELL",   // 1–4 weeks
  short_term_reason:  string,                    // 2–3 sentences
  long_term_outlook:  "BUY" | "HOLD" | "SELL",   // 3–12 months
  long_term_reason:   string
}
```

`tool_choice` forces the function call, so the response is deterministic JSON. If the call fails or parsing fails, it falls back to `HOLD / HOLD` with a generic explanation — the pipeline never crashes on extraction errors.

1. Persistence (per language)
Two upserts, both keyed by `language`:

- `full_analysis` → `{ title, content: sanitizedHtml, language, updated_at }`. Title is auto-generated per language: `Gold Market Analysis — YYYY-MM-DD` / `Análisis del Mercado del Oro — …` / `تحليل سوق الذهب — …`.
- `recommendations` → `{ short_term_outlook, short_term_reason, long_term_outlook, long_term_reason, language, updated_at }`.

Both tables have a sibling public view (`recommendations_public`) that strips the `updated_by` UUID so anonymous/public reads can't enumerate admin user IDs.

1. Failure surfacing
Every failure stage (`load_system_prompt`, `gemini_empty_response`, `html_sanitization`, `uncaught_exception`) calls `notifyAdminsOfFailure` from `_shared/notify-admins-failure.ts`, which enqueues an `automation-failure-alert` transactional email. The admin dashboard's `AutomationFailureBanner` and `automation-watchdog` cron also surface stalled runs.

2. Read path (frontend)

- `useRecommendations(language)` in `src/hooks/useRecommendations.tsx` reads from the `recommendations_public` view, with `staleTime: 0` + always-refetch (per the project rule that live data must bypass React Query cache).
- `useRecommendationsAdmin(language)` reads from the base `recommendations` table (RLS-gated) for the admin editor.
- `Index.tsx` renders two `RecommendationCard`s (short + long). The card maps the enum to color/icon — `BUY` → green / `TrendingUp`, `HOLD` → amber / `Minus`, `SELL` → red / `TrendingDown` — and shows the rationale plus "Last updated".
- `RecommendationManager.tsx` (admin) lets a human override the AI for any of the three languages; it writes straight to `recommendations` and invalidates the query cache.
- The `crawler-ssr` edge function reads the same `recommendations` rows so bots see today's BUY/HOLD/SELL in the server-rendered HTML, not after JS hydration.

1. Manual / legacy path
`supabase/functions/update-content/index.ts` is the older sibling: an admin (or external script with `CONTENT_API_KEY`) posts `{title, content, language}`, and it runs only the extraction step (steps 5–6) without calling Gemini for generation. It's the "I wrote the article by hand, just regenerate the BUY/HOLD/SELL" path.

---

```text
pg_cron 06:00 UTC ──► daily-gold-report (per lang)
                       │
                       ├─ load Aureus prompt   (app_settings)
                       ├─ Gemini 3.1 Pro + google_search + thinking=MEDIUM
                       ├─ sanitizeGeminiHtml   (strip fences/chatter, validate)
                       ├─ Lovable AI Flash     (forced tool call → JSON recs)
                       ├─ upsert full_analysis (per language)
                       └─ upsert recommendations (per language)
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
       useRecommendations  RecommendationMgr   crawler-ssr
       (public view, SPA)  (admin override)    (bot HTML)
```
