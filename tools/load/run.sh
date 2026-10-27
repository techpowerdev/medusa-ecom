#!/usr/bin/env bash
# OPS-4 load test (docs/spec/07-scaling-ops.md AC-2, AC-3, Q-O3 a–e) — รันจาก root ของ repo: tools/load/run.sh
# บูต stack แบบ prod ของ OPS-1 (server + worker + Postgres + Redis, NODE_ENV=production) → seed → seed-load
# → k6 (image pin เวอร์ชัน, ต่อ network ของ compose) → ตรวจผลจาก DB
# gate: order ที่ได้ส่วนลด = total_cap, units_sold = total_cap, สมาชิกกลุ่ม = ขนาดกลุ่ม, 5xx = 0
# p95 รายงานอย่างเดียว (runner เครื่องเดียวกับ k6 ไม่แทน production — Q-O3 a)
# รันในเครื่องด้วยโหลดเล็ก เช่น LOAD_FLASH_CUSTOMERS=30 LOAD_FLASH_TOTAL_CAP=10 LOAD_BURST_RATE=20 \
#   LOAD_BURST_DURATION=10s LOAD_JOIN_CUSTOMERS=20 LOAD_GROUP_SIZE=5 tools/load/run.sh
set -euo pipefail

PROJECT="${LOAD_PROJECT:-loadtest}"
# cleanup รัน `down -v` → ห้ามใช้ชื่อ project ของ dev
case "$PROJECT" in medusa-ecom*) echo "LOAD_PROJECT=$PROJECT ใช้ไม่ได้ (ชนกับ project ของ dev)" >&2; exit 2 ;; esac
unset DATABASE_URL REDIS_URL
export SERVER_PORT="${SERVER_PORT:-9106}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -hex 16)}"
export JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
export COOKIE_SECRET="${COOKIE_SECRET:-$(openssl rand -hex 32)}"
export STRIPE_API_KEY="sk_test_dummy" STRIPE_WEBHOOK_SECRET="whsec_dummy" # ไม่เรียก Stripe — manual payment
# ADR-010: provider ทดสอบ (pp_system_default + อีเมล local) — stack ของ load test เท่านั้น
export ALLOW_TEST_PROVIDERS=true
export AFFILIATE_TOKEN_SECRET="${AFFILIATE_TOKEN_SECRET:-$(openssl rand -hex 32)}"
export STOREFRONT_URL="${STOREFRONT_URL:-http://localhost:8000}"

FLASH_CUSTOMERS="${LOAD_FLASH_CUSTOMERS:-300}"
TOTAL_CAP="${LOAD_FLASH_TOTAL_CAP:-100}"
BURST_RATE="${LOAD_BURST_RATE:-500}"
BURST_DURATION="${LOAD_BURST_DURATION:-60s}"
JOIN_CUSTOMERS="${LOAD_JOIN_CUSTOMERS:-200}"
GROUP_SIZE="${LOAD_GROUP_SIZE:-10}"
K6_IMAGE="grafana/k6:2.3.0"
OUT="$(pwd)/${LOAD_OUT:-tools/load/out}"
DATA="$(mktemp -d)" # token ของลูกค้าทดสอบ — ไม่อยู่ใน OUT (artifact)

compose() { docker compose -p "$PROJECT" -f docker-compose.prod.yml "$@"; }
cleanup() { rm -rf "$DATA"; [ -n "${KEEP_UP:-}" ] || compose down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
mkdir -p "$OUT"
chmod 777 "$OUT" # k6 ใน container รันเป็น user อื่น

compose up -d --build --wait server worker
medusa_exec() { compose exec -T "${@:2}" server /app/node_modules/.bin/medusa exec "$1"; }
medusa_exec ./src/scripts/seed.js -e SEED_ADMIN_EMAIL="load-admin@example.com" -e SEED_ADMIN_PASSWORD="$(openssl rand -hex 16)"
medusa_exec ./src/scripts/seed-load.js -e LOAD_OUTPUT=/tmp/load-data.json \
  -e LOAD_FLASH_CUSTOMERS="$FLASH_CUSTOMERS" -e LOAD_FLASH_TOTAL_CAP="$TOTAL_CAP" \
  -e LOAD_JOIN_CUSTOMERS="$JOIN_CUSTOMERS" -e LOAD_GROUP_SIZE="$GROUP_SIZE"
compose cp server:/tmp/load-data.json "$DATA/load-data.json"
chmod 755 "$DATA" && chmod 644 "$DATA/load-data.json"

k6() { # k6 <script> — exit code เก็บไว้ ไม่หยุด script (ตรวจ DB และรายงานให้ครบก่อน)
  docker run --rm --network "${PROJECT}_default" -v "$DATA:/data:ro" -v "$(pwd)/tools/load:/scripts:ro" -v "$OUT:/out" \
    -e BASE_URL=http://server:9000 -e LOAD_DATA=/data/load-data.json \
    -e LOAD_BURST_RATE="$BURST_RATE" -e LOAD_BURST_DURATION="$BURST_DURATION" \
    "$K6_IMAGE" run --quiet --summary-export "/out/$1.json" "/scripts/$1.js" || echo "$1: k6 exit $?" >>"$OUT/k6-failures.txt"
}
rm -f "$OUT/k6-failures.txt"
k6 flash-sale
k6 group-buy-join

sql() { compose exec -T postgres psql -U medusa -d medusa -tAc "$1"; }
FLASH_CAMPAIGN="$(jq -r .flash.campaign_id "$DATA/load-data.json")"
GROUP_ID="$(jq -r .group_buy.group_id "$DATA/load-data.json")"
# order ที่ได้ส่วนลด = order (ไม่ใช่ draft) ที่มี adjustment ของ promotion ในแคมเปญ flash
ORDERS="$(sql "SELECT count(DISTINCT o.id) FROM \"order\" o
  JOIN order_item oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
  JOIN order_line_item_adjustment a ON a.item_id = oi.item_id AND a.deleted_at IS NULL
  JOIN promotion p ON p.id = a.promotion_id
  WHERE p.campaign_id = '$FLASH_CAMPAIGN' AND o.deleted_at IS NULL AND o.is_draft_order = false")"
UNITS_SOLD="$(sql "SELECT units_sold FROM flash_sale_config WHERE campaign_id = '$FLASH_CAMPAIGN' AND deleted_at IS NULL")"
MEMBERS="$(sql "SELECT count(DISTINCT customer_id) FROM group_buy_membership
  WHERE group_id = '$GROUP_ID' AND status IN ('joined', 'awaiting_payment', 'paid') AND deleted_at IS NULL")"

metric() { jq -r "($2) // \"-\"" "$OUT/$1.json" 2>/dev/null || echo "-"; }
failures=0
{
  echo "## OPS-4 load test ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
  echo
  echo "flash: $FLASH_CUSTOMERS ลูกค้า, total_cap=$TOTAL_CAP, burst $BURST_RATE rps × $BURST_DURATION | join: $JOIN_CUSTOMERS ลูกค้า, กลุ่ม $GROUP_SIZE คน"
  echo
  echo "| ตรวจ | คาดหวัง | ได้ | ผล |"
  echo "|---|---|---|---|"
  row() { if [ "$2" = "$3" ]; then r=PASS; else r=FAIL; failures=$((failures + 1)); fi; echo "| $1 | $2 | $3 | $r |"; }
  row "AC-2 order ที่ได้ส่วนลด (DB)" "$TOTAL_CAP" "$ORDERS"
  row "AC-2 units_sold (DB)" "$TOTAL_CAP" "$UNITS_SOLD"
  row "AC-2 checkout ที่ได้ 409 FLASH_SOLD_OUT" "$((FLASH_CUSTOMERS - TOTAL_CAP))" "$(metric flash-sale '.metrics.checkout_sold_out.count')"
  row "AC-2 checkout ผลอื่น" 0 "$(metric flash-sale '.metrics.checkout_unexpected.count')"
  row "AC-2 5xx" 0 "$(metric flash-sale '.metrics.http_5xx.count')"
  row "AC-3 สมาชิกกลุ่ม (DB)" "$GROUP_SIZE" "$MEMBERS"
  row "AC-3 join ผลอื่น (ไม่ใช่ 201/409)" 0 "$(metric group-buy-join '.metrics.join_unexpected.count')"
  row "AC-3 5xx" 0 "$(metric group-buy-join '.metrics.http_5xx.count')"
  echo
  echo "รายงานอย่างเดียว (ไม่ใช่ gate — Q-O3 a; เป้า p95 < 300ms):"
  echo
  echo "| scenario | p95 (ms) | req/s ทั้ง run | iteration ที่ k6 ทิ้ง | burst non-2xx |"
  echo "|---|---|---|---|---|"
  echo "| flash burst | $(metric flash-sale '.metrics["http_req_duration{scenario:burst}"]["p(95)"] | floor') | $(metric flash-sale '.metrics.http_reqs.rate | floor') | $(metric flash-sale '.metrics.dropped_iterations.count') | $(metric flash-sale '.metrics.burst_non_2xx.count') |"
  echo "| flash checkout | $(metric flash-sale '.metrics["http_req_duration{scenario:checkout}"]["p(95)"] | floor') | - | - | - |"
  echo "| group-buy join | $(metric group-buy-join '.metrics["http_req_duration{scenario:join}"]["p(95)"] | floor') | - | - | - |"
  [ -s "$OUT/k6-failures.txt" ] && { echo; echo "k6 threshold ล้ม:"; cat "$OUT/k6-failures.txt"; failures=$((failures + 1)); }
  echo
  echo "failures: $failures"
} >"$OUT/report.md"
cat "$OUT/report.md"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && cat "$OUT/report.md" >>"$GITHUB_STEP_SUMMARY"
if grep -q "^failures: 0$" "$OUT/report.md"; then
  echo "load test: ผ่าน"
else
  compose logs --tail 100 server worker >"$OUT/backend-tail.log" 2>&1 || true
  echo "load test: ไม่ผ่าน" >&2
  exit 1
fi
