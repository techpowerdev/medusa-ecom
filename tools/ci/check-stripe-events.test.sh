#!/usr/bin/env bash
# OPS-10 (spec 07 AC-15): test ของ tools/ci/check-stripe-events.sh ด้วยไฟล์จำลอง + ไฟล์จริงของ repo
set -uo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
check_script=$root/tools/ci/check-stripe-events.sh
tmp=$(mktemp -d "${TMPDIR:-/tmp}/ops10-events.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
pass=0
fail=0

doc() { # <ไฟล์> <event...> → เอกสารที่มีหัวข้อ "Stripe webhooks" และหัวข้ออื่นที่มี bullet event ปน (ต้องไม่ถูกนับ)
  local f=$1
  shift
  { echo "# Production"; echo "## Stripe webhooks"; echo "endpoint ทั้งสอง:"
    for e in "$@"; do echo "- \`$e\` — คำอธิบาย"; done
    echo "## หัวข้ออื่น"; echo "- \`charge.refunded\` — ไม่ใช่รายการสมัคร"; } > "$f"
}
ci() { # <ไฟล์> <ค่า events=>
  printf 'jobs:\n  e2e:\n    steps:\n      - run: |\n          events=%s\n          stripe listen --events "$events"\n' "$2" > "$1"
}
expect() { # <ชื่อเคส> <exit ที่คาด 0|1> <doc> <ci>
  local got=0
  "$check_script" "$3" "$4" > "$tmp/out" 2>&1 || got=1
  if [ "$got" = "$2" ]; then pass=$((pass + 1)); echo "ok   - $1 (exit $got)"
  else fail=$((fail + 1)); echo "FAIL - $1 (exit $got คาด $2)"; sed 's/^/       /' "$tmp/out"; fi
}

doc "$tmp/d1" payment_intent.created payment_intent.succeeded
ci "$tmp/c1" payment_intent.created,payment_intent.succeeded
expect "เซตเท่ากัน" 0 "$tmp/d1" "$tmp/c1"
ci "$tmp/c2" payment_intent.succeeded,payment_intent.created
expect "เซตเท่ากันแม้ลำดับต่าง" 0 "$tmp/d1" "$tmp/c2"
ci "$tmp/c3" payment_intent.created
expect "ci.yml ขาด event" 1 "$tmp/d1" "$tmp/c3"
ci "$tmp/c4" payment_intent.created,payment_intent.succeeded,payment_intent.canceled
expect "ci.yml มี event เกิน" 1 "$tmp/d1" "$tmp/c4"
ci "$tmp/c5" payment_intent.created,payment_intent.succeeded,charge.refunded
expect "bullet นอกหัวข้อไม่ถูกนับ" 1 "$tmp/d1" "$tmp/c5"
printf '# Production\n## อื่น\n- `payment_intent.created`\n' > "$tmp/d2"
expect "ไม่มีหัวข้อ Stripe webhooks" 1 "$tmp/d2" "$tmp/c1"
printf 'jobs: {}\n' > "$tmp/c6"
expect "ci.yml ไม่มี events=" 1 "$tmp/d1" "$tmp/c6"
expect "ไฟล์จริงของ repo (production.md × ci.yml)" 0 "$root/docs/ops/production.md" "$root/.github/workflows/ci.yml"

echo "check-stripe-events: $pass/$((pass + fail)) passed"
[ "$fail" -eq 0 ]
