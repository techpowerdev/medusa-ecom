#!/usr/bin/env bash
# OPS-10 (spec 07 AC-15): รายการ event ในหัวข้อ "## Stripe webhooks" ของ docs/ops/production.md
# ต้องเท่ากับค่า `events=` ของขั้น `stripe listen` ใน ci.yml แบบเซต (รันใน job lint-typecheck)
#   check-stripe-events.sh [production.md] [ci.yml]
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
doc=${1:-$root/docs/ops/production.md}
ci=${2:-$root/.github/workflows/ci.yml}

# bullet "- `event.name`" ภายในหัวข้อ "## Stripe webhooks" เท่านั้น (จบที่หัวข้อระดับ ## ถัดไป)
# ตัด whitespace ท้ายหัวข้อก่อนเทียบ (OPS-16: หัวข้อที่มี trailing space ยังเป็นหัวข้อเดียวกัน)
doc_events=$(awk '/^## /{h=$0; sub(/[[:space:]]+$/, "", h); in_sec=(h=="## Stripe webhooks")} in_sec' "$doc" |
  sed -nE 's/^- `([a-z_]+(\.[a-z_]+)+)`.*/\1/p' | sort -u)
lines=$(grep -cE '^[[:space:]]*events=' "$ci" || true)
if [ "$lines" -ne 1 ]; then
  echo "::error::$ci ต้องมีบรรทัด events= ของ stripe listen หนึ่งบรรทัด (พบ $lines)"
  exit 1
fi
ci_events=$(grep -E '^[[:space:]]*events=' "$ci" | sed -E 's/^[[:space:]]*events=//; s/["'\'']//g' | tr ',' '\n' |
  sed -E 's/^[[:space:]]+|[[:space:]]+$//g' | grep -v '^$' | sort -u)

if [ -z "$doc_events" ]; then
  echo "::error::$doc ไม่มีหัวข้อ \"## Stripe webhooks\" หรือไม่มีรายการ event ในหัวข้อนั้น"
  exit 1
fi
if [ "$doc_events" != "$ci_events" ]; then
  echo "::error::event ใน $doc (Stripe webhooks) ไม่ตรงกับ events= ใน $ci"
  echo "มีเฉพาะในเอกสาร: $(comm -23 <(echo "$doc_events") <(echo "$ci_events") | tr '\n' ' ')"
  echo "มีเฉพาะใน ci.yml: $(comm -13 <(echo "$doc_events") <(echo "$ci_events") | tr '\n' ' ')"
  exit 1
fi
echo "ok: Stripe webhook events ตรงกัน ($(echo "$doc_events" | wc -l | tr -d ' ') event)"
