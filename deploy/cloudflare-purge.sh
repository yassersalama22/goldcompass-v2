#!/usr/bin/env bash
#
# Purge the whole Cloudflare cache for the zone, then check that the edge serves
# the new build. Run by .github/workflows/deploy.yml AFTER the new container is
# confirmed serving (see the "Deploy to EC2" step) — purging any earlier lets the
# edge re-cache HTML from the old container.
#
# Why purge everything, on every deploy: Next.js gives each build a random build
# ID (no `generateBuildId` in next.config.ts), and every page embeds it. Cached
# HTML from a previous build runs the old client code against the new server,
# which on 2026-11-11 caused a 42s click and a page reloading under the user. Every
# merge to main is a deploy — content PRs included — and static pages are cached
# for a year, so single-URL purges are not enough.
#
# Usage: cloudflare-purge.sh [EXPECTED_BUILD_ID]
#   CF_API_TOKEN  API token with ONLY Zone → Cache Purge → Purge, on this zone.
#   CF_ZONE_ID    The zone ID (Cloudflare dashboard → the site → Overview).
#   SITE          Default https://goldcompass.app
#   CHECK_PATHS   Space-separated paths to verify (default below).
#
# Unset credentials SKIP with a warning rather than failing: the deploy itself
# has already succeeded, and an unconfigured fork should not go red. Note GitHub
# passes an unset secret/variable as an EMPTY STRING, so test for emptiness.
# A configured purge that FAILS exits 1, so a stale edge is never silent.
# The post-purge check never fails the run: a page still on the old build is a
# warning, and Cloudflare challenging the runner's datacenter IP is a notice.

set -euo pipefail

EXPECTED_BUILD_ID="${1:-}"
SITE="${SITE:-https://goldcompass.app}"
CHECK_PATHS="${CHECK_PATHS:-/ /ar /about /ar/outlook /privacy}"
UA="goldcompass-deploy-check"

warn() { echo "::warning::$*"; }
err() { echo "::error::$*"; }

if [ -z "${CF_API_TOKEN:-}" ] || [ -z "${CF_ZONE_ID:-}" ]; then
  warn "CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID not set — skipping the cache purge. Purge manually: Cloudflare → Caching → Configuration → Purge Everything."
  exit 0
fi

response="$(curl -sS --retry 3 --retry-all-errors --max-time 30 \
  -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}' || true)"

# Cloudflare answers {"success":true,...}; match it textually rather than
# depending on jq being present on the runner image.
if ! printf '%s' "$response" | grep -Eq '"success"[[:space:]]*:[[:space:]]*true'; then
  err "Cloudflare purge failed. Response: ${response:-<no response>}"
  exit 1
fi
echo "Cloudflare cache purged (purge_everything)."

if [ -z "$EXPECTED_BUILD_ID" ]; then
  warn "No build ID passed — skipping the post-purge check."
  exit 0
fi

# Purges propagate in seconds; allow up to ~60s per path. A response that is
# Cloudflare challenging or blocking the *runner* is not evidence about the
# cache, so it is reported separately and not retried. The first production
# run (2026-11-14) spent 5 minutes retrying exactly that and warned on every
# path, while the same requests from a residential IP showed the new build.
body="$(mktemp)"; headers="$(mktemp)"
trap 'rm -f "$body" "$headers"' EXIT

verified="" stale="" blocked=""
for path in $CHECK_PATHS; do
  result="stale"
  for _ in $(seq 1 12); do
    code="$(curl -sS --max-time 15 -A "$UA" -o "$body" -D "$headers" -w '%{http_code}' "${SITE}${path}" 2>/dev/null || true)"
    if grep -q -- "$EXPECTED_BUILD_ID" "$body"; then
      result="ok"; break
    fi
    if [ "$code" = 403 ] || [ "$code" = 429 ] || [ "$code" = 503 ] || grep -qi '^cf-mitigated:' "$headers"; then
      result="blocked:${code}"; break
    fi
    sleep 5
  done
  case "$result" in
    ok) verified="${verified} ${path}"; echo "  ${path}: serving build ${EXPECTED_BUILD_ID}" ;;
    blocked:*) blocked="${blocked} ${path}(${result#blocked:})" ;;
    *) stale="${stale} ${path}" ;;
  esac
done

if [ -n "$blocked" ]; then
  echo "::notice::Cloudflare challenged or blocked the runner on:${blocked} — that says nothing about the cache, and the purge itself succeeded. Verify from a normal connection if needed."
fi
if [ -n "$stale" ]; then
  warn "After the purge, these paths still did not show build ${EXPECTED_BUILD_ID}:${stale}. Check manually: curl -sI ${SITE}/ | grep -i '^age'"
fi
