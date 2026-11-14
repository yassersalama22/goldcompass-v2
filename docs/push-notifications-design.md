# Push Notifications — Design Proposal

**Status:** Proposed — **not decided, nothing built.** Parked for a later decision.
**Prepared:** 2026-11-14
**Scope:** Let visitors opt in to browser notifications about the daily outlook and new
articles, in English and Arabic.
**Read with:** `CLAUDE.md` §4 (architecture rules) and the 2026-11-10 → 2026-11-14 status-log
entries (GA4, prefetch, automatic purge), which several constraints below come from.

---

## 1. Summary

Use **standard Web Push** (the browser Push API + VAPID keys, no vendor SDK), store
subscriptions on the EC2 box, and send from the deploy workflow **after** new content is live.
Notify on **signal changes and new articles**, not on every daily refresh.

```
Visitor clicks "Notify me"  ──►  browser permission prompt
        │                           │
        ▼                           ▼
 service worker (/sw.js)     PushSubscription {endpoint, keys}
        ▲                           │  POST /api/v1/push/subscribe  (topics, locale)
        │                           ▼
        │                    subscriptions store (SQLite on the box)
        │                           ▲
 push service (Google /             │ read + prune dead subscriptions
 Mozilla / Apple) ◄── send ── notify job ◄── deploy workflow, AFTER the purge
                                            (idempotent: "is this content new?")
```

---

## 2. Design decisions

### 2.1 What triggers a notification — change, not schedule

A daily notification trains people to ignore or block the site. The outlook artifact already
carries structured signals (`calls[].signal`, `confidence`), so the notify job can compare the
newly published artifact with the previous one and send only when something a reader would act
on has changed:

- **Signal change** — e.g. "Short-term outlook changed: SELL → BUY".
- **New article** — one notification per newly published article.
- Optionally later: a confidence change, or a weekly digest for people who want the routine.

Subscribers choose topics: *signal changes*, *new articles*, or both. This suits a buy-and-hold
audience and gives a real reason to opt in.

### 2.2 When to send — after the purge, inside the deploy workflow

Publishing already goes through a human gate (the content PR) and every merge deploys. Sending
from `deploy.yml` **after** the Cloudflare purge step means:

- nothing unapproved is ever announced;
- a tap lands on the new page, not a stale edge copy.

Two constraints learned this week:

- **The GitHub runner gets 403 from Cloudflare** (confirmed 2026-11-14), so it cannot call an
  endpoint on the site. Run the send **over SSH, inside the container**, the same way the deploy
  step already works (e.g. `docker compose exec -T app node scripts/send-notifications.mjs`).
- **It must be idempotent.** Deploys get re-run (twice on 2026-11-11 alone). Record what has been
  announced (content key: outlook `generatedAt` + signals, article slug) and skip anything
  already sent.

### 2.3 Where subscriptions live — the site's first persistent state

The box is currently stateless: a deploy just replaces the container. Subscriptions must survive
that.

| Option | For | Against |
|---|---|---|
| **SQLite on a Docker volume** (recommended) | Free; no third-party script; no lock-in; fits the single-box design | First stateful data on the box → needs a nightly backup (S3), and it lives on one machine |
| Managed service (OneSignal, Firebase and similar) | They store and send; segments built in | Heavy third-party script on every page (performance, the #2 goal), CSP and privacy changes, vendor lock-in |

Either way, put it behind a provider interface (`src/server/notifications/`), mirroring
`PriceProvider` / `NewsletterProvider`, so the choice can change later.

Sketch of the store:

- `subscriptions(endpoint UNIQUE, p256dh, auth, locale, topics, created_at, last_success_at)`
- `sent(content_key UNIQUE, sent_at, recipients, failures)`

### 2.4 Asking for permission

- **Never prompt on page load.** Chrome quietens or blocks such prompts, and Safari requires a
  user gesture.
- Add a soft in-page button, "Get notified when the outlook changes", on `/outlook` and at the
  end of articles, next to the newsletter box. The browser prompt appears only after that click.
- The button is a client component, so the edge-cached static HTML is unaffected (same rule as
  the 2026-07-30 note: nothing live or per-visitor in cached HTML).

### 2.5 iPhone — the main risk for the Gulf

Safari on iPhone allows web push **only after the visitor adds the site to the home screen**
(the site must also ship a web app manifest). Most visitors never do that.

- Show iPhone visitors a short "Add to Home Screen" hint instead of a button that cannot work.
- Offer the **email newsletter** as their alternative. Buttondown can send new articles
  automatically from the RSS feed, which covers article alerts by email for everyone.
- **Check GA4 device data for Gulf traffic before investing.** If it is mostly iPhone, email may
  deliver more than push.

### 2.6 Language

Store `locale` per subscription. Notification text comes from the content artifacts, which the
pipeline already translates in the same PR, so Arabic subscribers get Arabic text that links to
`/ar/…`.

### 2.7 Fit with the API-first rule (CLAUDE.md §4)

Model "content published" as a domain event in the core; web push is one delivery channel. A
future mobile app would add native push (APNs / FCM) behind the same interface. Subscribe and
unsubscribe belong under the versioned API (`/api/v1/push/...`).

### 2.8 Checklist of smaller items

- `/sw.js` needs a short cache lifetime, or service-worker updates stick at the edge.
- CSP: add `worker-src 'self'`.
- Rate-limit the subscribe endpoint per visitor (`getClientIp`, as for `/api/subscribe`).
- Delete subscriptions the push service reports as gone (404 / 410).
- Unsubscribe control in the UI, and the `notificationclick` handler opens the localized URL.
- GA4 event for opt-ins (no personal data in parameters).
- Update `/privacy`: push subscriptions are personal data. Translate through the pipeline.

---

## 3. Suggested build order

1. **Measure first:** service worker, manifest, soft prompt, subscribe endpoint, SQLite store —
   **no sending.** See how many people opt in, by device and language.
2. **Send:** notify job, change detection, idempotency, wired into `deploy.yml` after the purge.
3. **Polish:** topic preferences, the iPhone home-screen hint, the email alternative.

---

## 4. Decisions needed before building

1. **What to send:** signal changes + new articles (recommended), or every daily update?
2. **Storage:** SQLite on the box (recommended) or a managed push service?
3. **iPhone:** how much effort, given the home-screen requirement — and should email be the
   primary channel there?
4. **Prerequisite:** look at Gulf device share in GA4 once the Ads campaign has run for a while.
