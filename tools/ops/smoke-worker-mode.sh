#!/usr/bin/env bash
# OPS-1 smoke test ของ AC-1 (docs/spec/07-scaling-ops.md):
# backend image เดียวกันบูตเป็น server และ worker ได้; scheduled jobs ถูกโหลดเฉพาะบน worker
# OPS-2: event ที่ server emit ต้องถึง subscriber บน worker ผ่าน Redis event bus
# รันจาก root ของ repo: tools/ops/smoke-worker-mode.sh (ต้องมี docker compose v2)
set -euo pipefail

PROJECT="${SMOKE_PROJECT:-ops1test}"
# cleanup รัน `down -v` → ห้ามใช้ชื่อ project ของ dev (จะลบ volume pg-data ของ medusa-ecom)
case "$PROJECT" in medusa-ecom*) echo "SMOKE_PROJECT=$PROJECT ใช้ไม่ได้ (ชนกับ project ของ dev)" >&2; exit 2 ;; esac
# ใช้ postgres/redis ภายใน project นี้เสมอ — ไม่ให้ DATABASE_URL/REDIS_URL ของ shell (dev) รั่วเข้ามา
unset DATABASE_URL REDIS_URL
export SERVER_PORT="${SERVER_PORT:-9104}"
export LOG_LEVEL=debug # JobLoader ของ Medusa log "Jobs registered." ที่ระดับ debug
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -hex 16)}"
export JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
export COOKIE_SECRET="${COOKIE_SECRET:-$(openssl rand -hex 32)}"
export STRIPE_API_KEY="${STRIPE_API_KEY:-sk_test_dummy}" # smoke ไม่เรียก Stripe; provider ต้องการ key ตอนบูตเท่านั้น
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_dummy}"
# OPS-7 prod guards (image = NODE_ENV=production): smoke ไม่ใช่ prod → provider ทดสอบ + ค่าที่ guard บังคับ
export ALLOW_TEST_PROVIDERS="${ALLOW_TEST_PROVIDERS:-true}"
export AFFILIATE_TOKEN_SECRET="${AFFILIATE_TOKEN_SECRET:-$(openssl rand -hex 32)}"
export STOREFRONT_URL="${STOREFRONT_URL:-http://localhost:8000}"

compose() { docker compose -p "$PROJECT" -f docker-compose.prod.yml "$@"; }
cleanup() { [ -n "${KEEP_UP:-}" ] || compose down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT

failures=0
check() { # check <description> <expected> <actual>
  if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (expected $2, got $3)"; failures=$((failures + 1)); fi
}
# HTTP status จากภายใน container (worker ไม่ต้อง publish port)
status() { compose exec -T "$1" node -e "fetch('http://localhost:9000$2').then(r=>console.log(r.status)).catch(()=>console.log('ERR'))"; }

compose up -d --build --wait server worker

check "server GET /health" 200 "$(status server /health)"
check "worker GET /health" 200 "$(status worker /health)"
check "server serves admin at /app" 200 "$(status server /app)"
check "worker does not serve admin" 404 "$(status worker /app)"
check "worker does not serve store API" 404 "$(status worker /store/products)"
check "server serves store API (400 = missing publishable key)" 400 "$(status server /store/products)"
check "server runs with MEDUSA_WORKER_MODE=server" server "$(compose exec -T server printenv MEDUSA_WORKER_MODE)"
check "worker runs with MEDUSA_WORKER_MODE=worker" worker "$(compose exec -T worker printenv MEDUSA_WORKER_MODE)"
check "worker loads scheduled jobs" 1 "$(compose logs worker | grep -c 'Jobs registered' || true)"
check "server does not load scheduled jobs" 0 "$(compose logs server | grep -c 'Jobs registered' || true)"

# OPS-2: admin สร้าง product บน server → product.created → subscriber search-ingestion ของ Medusa รันบน worker
# (event-bus-redis log "Processing <event> ..." เฉพาะ process ที่รัน BullMQ worker)
ADMIN_EMAIL="smoke-$(openssl rand -hex 4)@example.com"
ADMIN_PASSWORD="$(openssl rand -hex 16)"
compose exec -T server /app/node_modules/.bin/medusa user -e "$ADMIN_EMAIL" -p "$ADMIN_PASSWORD" >/dev/null
create_product() {
  compose exec -T -e ADMIN_EMAIL="$ADMIN_EMAIL" -e ADMIN_PASSWORD="$ADMIN_PASSWORD" server node -e "
    const base = 'http://localhost:9000'
    const json = { 'content-type': 'application/json' }
    fetch(base + '/auth/user/emailpass', { method: 'POST', headers: json,
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) })
      .then((r) => r.json())
      .then(({ token }) => fetch(base + '/admin/products', { method: 'POST',
        headers: { ...json, authorization: 'Bearer ' + token },
        body: JSON.stringify({ title: 'OPS-2 smoke ' + Date.now(), options: [{ title: 'Size', values: ['M'] }] }) }))
      .then((r) => console.log(r.status), () => console.log('ERR'))"
}
# นับเป็นส่วนต่างจากก่อนสร้าง product — KEEP_UP=1 แล้วรันซ้ำ container เดิมยังมี log ของรอบก่อน
processed_total() { compose logs "$1" | grep -c 'Processing product.created ' || true; }
base_worker="$(processed_total worker)"
base_server="$(processed_total server)"
processed_on() { local base="base_$1"; echo $(( $(processed_total "$1") - ${!base} )); }
check "server creates product via admin API" 200 "$(create_product)"
# event-bus-redis: "Processing product.created (priority: N) which has ..."; event-bus-local ไม่มี priority
for _ in $(seq 1 30); do [ "$(processed_on worker)" -ge 1 ] && break; sleep 1; done
check "worker processes product.created emitted by server" 1 "$(processed_on worker)"
check "server does not process events itself" 0 "$(processed_on server)"

if [ "$failures" -ne 0 ]; then
  echo "smoke-worker-mode: $failures check(s) failed"
  compose logs --tail 50 server worker || true
  exit 1
fi
echo "smoke-worker-mode: all checks passed"
