#!/usr/bin/env bash
#
# Reconcile the EC2 origin security group so ONLY Cloudflare's published edge
# ranges can reach ports 80/443. Safe to re-run: it diffs the group's current
# rules against cloudflare.com/ips-v4 + ips-v6, adds what's missing, and revokes
# what is no longer a Cloudflare range.
#
#   ./whitelist-cloudflare-ips.sh           # print the plan, change nothing
#   ./whitelist-cloudflare-ips.sh --apply   # execute the plan
#
# Why this matters (CLAUDE.md §4 + the 2026-07-27 status entry): the app trusts
# CF-Connecting-IP / X-Forwarded-For to identify visitors. If the origin is
# reachable directly, any caller can forge those headers to defeat the per-IP
# rate limit and poison the ip_address we forward to Buttondown. Locking the SG
# to Cloudflare is what makes those headers trustworthy.
#
# Scope: only rules whose port range is exactly 80-80 or 443-443 are managed.
# SSH (22) and everything else is left alone. Any *other* rule that happens to
# expose a managed port (e.g. a wide 0-65535 range) is reported as a warning
# rather than revoked — widening like that is either deliberate or a mistake
# worth a human look, not something a script should silently undo.
#
# Requires: awscli v2 with credentials that can describe/authorize/revoke on the
# group — see deploy/iam-cloudflare-sg-policy.json. No jq needed.
#
# Run this from a workstation, NOT from the EC2 box. The box has no instance
# profile (aws CLI there reports "Unable to locate credentials"), and that is
# worth keeping: an instance role able to edit its own security group turns any
# RCE/SSRF on the public-facing app into "attacker opens port 22 to the world".
# This is occasional maintenance — Cloudflare's ranges change about once a year —
# not a deploy step, and if the rules are ever wrong the box may be unreachable
# anyway, so it has to be fixable from outside.

set -euo pipefail

SG_ID="${SG_ID:-sg-0fdafbfe1cd01b937}"
AWS_REGION="${AWS_REGION:-us-east-1}"
MANAGED_PORTS=(80 443)
RULE_DESCRIPTION="Cloudflare-edge"

# A truncated or hijacked fetch must never be able to revoke the whole allowlist
# and take the origin offline, so require a plausible number of ranges.
MIN_V4_RANGES=5
MIN_V6_RANGES=3

APPLY=false
case "${1:-}" in
  --apply) APPLY=true ;;
  "" | --plan | --dry-run) ;;
  *)
    echo "usage: ${0##*/} [--apply]" >&2
    exit 2
    ;;
esac

command -v aws >/dev/null || {
  echo "error: aws CLI not found on PATH" >&2
  exit 1
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# ---------------------------------------------------------------- desired state

fetch_ranges() {
  curl -fsSL --retry 3 --max-time 30 "$1" | tr -d '\r' | grep -v '^[[:space:]]*$'
}

echo "Fetching Cloudflare ranges..."
fetch_ranges https://www.cloudflare.com/ips-v4 | sort >"$tmp/cf_v4"
fetch_ranges https://www.cloudflare.com/ips-v6 | sort >"$tmp/cf_v6"

v4_count="$(wc -l <"$tmp/cf_v4" | tr -d ' ')"
v6_count="$(wc -l <"$tmp/cf_v6" | tr -d ' ')"
if [ "$v4_count" -lt "$MIN_V4_RANGES" ] || [ "$v6_count" -lt "$MIN_V6_RANGES" ]; then
  echo "error: implausible range list (v4=$v4_count, v6=$v6_count) — refusing to reconcile" >&2
  exit 1
fi
sort "$tmp/cf_v4" "$tmp/cf_v6" >"$tmp/desired"
echo "  ${v4_count} IPv4 + ${v6_count} IPv6 ranges"

# ---------------------------------------------------------------- current state

echo "Reading security group ${SG_ID} (${AWS_REGION})..."
if ! aws ec2 describe-security-group-rules \
  --region "$AWS_REGION" \
  --filters "Name=group-id,Values=${SG_ID}" \
  --query 'SecurityGroupRules[?IsEgress==`false`].[SecurityGroupRuleId,IpProtocol,FromPort,ToPort,CidrIpv4,CidrIpv6]' \
  --output text >"$tmp/rules" 2>"$tmp/describe_err"; then
  cat "$tmp/describe_err" >&2
  if grep -q 'UnauthorizedOperation' "$tmp/describe_err"; then
    cat >&2 <<'HINT'

hint: this identity can write security-group rules but not read them, so the
      reconcile can't run — there is no way to diff against state you can't see.
      Grant it ec2:DescribeSecurityGroupRules (Resource: "*", which is all EC2
      Describe* actions support). Read-only; it adds no ability to change rules.
HINT
  fi
  exit 1
fi

for port in "${MANAGED_PORTS[@]}"; do : >"$tmp/cur_$port"; done
: >"$tmp/warnings"

# Does this rule's protocol/port range cover $port (without being an exact match)?
covers_port() {
  local proto="$1" from="$2" to="$3" port="$4"
  [ "$proto" = "-1" ] && return 0
  [ "$proto" = "tcp" ] || return 1
  { [ "$from" = "None" ] || [ "$to" = "None" ]; } && return 1
  [ "$from" -le "$port" ] && [ "$to" -ge "$port" ]
}

while IFS=$'\t' read -r rule_id proto from to cidr4 cidr6; do
  [ -n "${rule_id:-}" ] || continue

  cidr="$cidr4"
  [ "$cidr" = "None" ] && cidr="$cidr6"
  # No CIDR means a source-SG or prefix-list rule — not ours to reconcile.
  [ "$cidr" = "None" ] && continue

  exact=false
  for port in "${MANAGED_PORTS[@]}"; do
    if [ "$proto" = "tcp" ] && [ "$from" = "$port" ] && [ "$to" = "$port" ]; then
      printf '%s\t%s\n' "$cidr" "$rule_id" >>"$tmp/cur_$port"
      exact=true
      break
    fi
  done
  $exact && continue

  for port in "${MANAGED_PORTS[@]}"; do
    if covers_port "$proto" "$from" "$to" "$port"; then
      printf '  ! %s (%s %s-%s %s) also exposes port %s — left untouched\n' \
        "$rule_id" "$proto" "$from" "$to" "$cidr" "$port" >>"$tmp/warnings"
    fi
  done
done <"$tmp/rules"

# ---------------------------------------------------------------------- the plan

changes=0
for port in "${MANAGED_PORTS[@]}"; do
  cut -f1 "$tmp/cur_$port" | sort >"$tmp/cur_cidrs_$port"
  comm -13 "$tmp/cur_cidrs_$port" "$tmp/desired" >"$tmp/add_$port"
  comm -23 "$tmp/cur_cidrs_$port" "$tmp/desired" >"$tmp/revoke_$port"

  n_cur="$(wc -l <"$tmp/cur_cidrs_$port" | tr -d ' ')"
  n_add="$(wc -l <"$tmp/add_$port" | tr -d ' ')"
  n_revoke="$(wc -l <"$tmp/revoke_$port" | tr -d ' ')"
  changes=$((changes + n_add + n_revoke))

  echo
  echo "port ${port}: ${n_cur} rule(s) now, +${n_add} / -${n_revoke}"
  while read -r cidr; do [ -n "$cidr" ] && echo "  + ${cidr}"; done <"$tmp/add_$port"
  while read -r cidr; do [ -n "$cidr" ] && echo "  - ${cidr}"; done <"$tmp/revoke_$port"
done

if [ -s "$tmp/warnings" ]; then
  echo
  echo "warnings:"
  cat "$tmp/warnings"
fi

if [ "$changes" -eq 0 ]; then
  echo
  echo "Already in sync — nothing to do."
  exit 0
fi

if ! $APPLY; then
  echo
  echo "Plan only. Re-run with --apply to make these changes."
  exit 0
fi

# --------------------------------------------------------------------- apply it

echo
for port in "${MANAGED_PORTS[@]}"; do
  while read -r cidr; do
    [ -n "$cidr" ] || continue
    case "$cidr" in
      *:*) range="Ipv6Ranges=[{CidrIpv6=${cidr},Description=${RULE_DESCRIPTION}}]" ;;
      *) range="IpRanges=[{CidrIp=${cidr},Description=${RULE_DESCRIPTION}}]" ;;
    esac
    echo "authorizing ${cidr} on ${port}"
    aws ec2 authorize-security-group-ingress \
      --region "$AWS_REGION" \
      --group-id "$SG_ID" \
      --ip-permissions "IpProtocol=tcp,FromPort=${port},ToPort=${port},${range}" \
      --output text >/dev/null
  done <"$tmp/add_$port"

  while read -r cidr; do
    [ -n "$cidr" ] || continue
    rule_id="$(grep -F "$(printf '%s\t' "$cidr")" "$tmp/cur_$port" | cut -f2)"
    echo "revoking ${cidr} on ${port} (${rule_id})"
    aws ec2 revoke-security-group-ingress \
      --region "$AWS_REGION" \
      --group-id "$SG_ID" \
      --security-group-rule-ids "$rule_id" \
      --output text >/dev/null
  done <"$tmp/revoke_$port"
done

echo
echo "Done. Verify the site still answers through Cloudflare, and that a direct"
echo "hit to the Elastic IP now times out:"
echo "  curl -sS -o /dev/null -w '%{http_code}\\n' https://goldcompass.app/"
echo "  curl -sS --max-time 5 http://<elastic-ip>/   # expect a timeout"
