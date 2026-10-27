#!/usr/bin/env bash
# OPS-8 smoke test ของ AC-5 (docs/spec/07-scaling-ops.md, ADR-012):
# Redis ของ event bus ถูก `docker pause` 30 วินาทีแล้ว unpause → event ที่ server emit หลัง unpause ต้องถูก subscriber
# บน worker ประมวลผลภายใน 60 วินาที หรือ worker จบ process (exit ≠ 0) ภายใน 60 วินาทีแล้วถูก restart และประมวลผลได้
# ห้ามเกิดกรณี worker ค้างไม่ประมวลผลขณะที่ /health ยังตอบ 200
# รันจาก root ของ repo: tools/ops/smoke-redis-outage.sh (ต้องมี docker compose v2)
#   SMOKE_DATABASE_URL=postgres://...  ใช้ DB ที่มีอยู่แล้ว (ต้องสร้าง DB ไว้ก่อน) แทน postgres ภายใน project
#     ห้ามชี้ไป DB `medusa` ของ dev; host.docker.internal ใช้ได้เฉพาะ Docker Desktop (docs/ops/production.md)
set -euo pipefail

PROJECT="${SMOKE_PROJECT:-ops8test}"
# cleanup รัน `down -v` → ห้ามใช้ชื่อ project ของ dev (จะลบ volume pg-data ของ medusa-ecom)
case "$PROJECT" in medusa-ecom*) echo "SMOKE_PROJECT=$PROJECT ใช้ไม่ได้ (ชนกับ project ของ dev)" >&2; exit 2 ;; esac
PAUSE_SECONDS="${PAUSE_SECONDS:-30}"
DEADLINE_SECONDS=60
# ใช้ redis (และ postgres ถ้าไม่ได้ตั้ง SMOKE_DATABASE_URL) ภายใน project นี้เสมอ — ไม่ให้ค่าของ shell (dev) รั่วเข้ามา
unset REDIS_URL
if [ -n "${SMOKE_DATABASE_URL:-}" ]; then export DATABASE_URL="$SMOKE_DATABASE_URL"; else unset DATABASE_URL; fi
export SERVER_PORT="${SERVER_PORT:-9108}"
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
redis_id() { compose ps -a -q redis; }
cleanup() {
  [ -n "$(redis_id 2>/dev/null)" ] && docker unpause "$(redis_id)" >/dev/null 2>&1 || true
  [ -n "${KEEP_UP:-}" ] || compose down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

failures=0
check() { # check <description> <expected> <actual>
  if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (expected $2, got $3)"; failures=$((failures + 1)); fi
}

if [ -n "${SMOKE_DATABASE_URL:-}" ]; then
  compose build server
  compose up -d --wait redis
  compose run --rm --no-deps migrate
  compose up -d --wait --no-deps server worker
else
  compose up -d --build --wait server worker
fi

ADMIN_EMAIL="smoke-$(openssl rand -hex 4)@example.com"
ADMIN_PASSWORD="$(openssl rand -hex 16)"
compose exec -T server /app/node_modules/.bin/medusa user -e "$ADMIN_EMAIL" -p "$ADMIN_PASSWORD" >/dev/null
# admin สร้าง product บน server → product.created → subscriber search-ingestion ของ Medusa รันบน worker
# (title ต้องไม่ซ้ำ — handle ที่ได้จาก title ซ้ำทำให้ได้ 400)
create_product() {
  compose exec -T -e ADMIN_EMAIL="$ADMIN_EMAIL" -e ADMIN_PASSWORD="$ADMIN_PASSWORD" server node -e "
    const base = 'http://localhost:9000'
    const json = { 'content-type': 'application/json' }
    fetch(base + '/auth/user/emailpass', { method: 'POST', headers: json,
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) })
      .then((r) => r.json())
      .then(({ token }) => fetch(base + '/admin/products', { method: 'POST',
        headers: { ...json, authorization: 'Bearer ' + token },
        body: JSON.stringify({ title: 'OPS-8 smoke ' + Date.now(), options: [{ title: 'Size', values: ['M'] }] }) }))
      .then((r) => console.log(r.status), () => console.log('ERR'))"
}
# event-bus-redis log "Processing product.created (priority: N) ..." เฉพาะ process ที่รัน BullMQ worker
# นับเป็นส่วนต่างจากตอนเริ่ม — KEEP_UP=1 แล้วรันซ้ำ container เดิมยังมี log ของรอบก่อน
processed_total() { compose logs worker 2>/dev/null | grep -c 'Processing product.created ' || true; }
processed() { echo $(( $(processed_total) - processed_base )); }
restarts() { docker inspect -f '{{.RestartCount}}' "$(compose ps -a -q worker)"; }
worker_health() {
  compose exec -T worker node -e "fetch('http://localhost:9000/health').then(r=>console.log(r.status)).catch(()=>console.log('ERR'))" 2>/dev/null || echo DOWN
}
wait_processed() { # wait_processed <count> <seconds> → 0 เมื่อ worker ประมวลผลครบ <count> ครั้งภายในเวลา
  for _ in $(seq 1 "$2"); do [ "$(processed)" -ge "$1" ] && return 0; sleep 1; done
  return 1
}

processed_base="$(processed_total)"
# baseline: ก่อน Redis ขาด event ถึง worker
check "server creates product before outage" 200 "$(create_product)"
wait_processed 1 30 || true
check "worker processes product.created before outage" 1 "$(processed)"
restarts_before="$(restarts)"

echo "pausing redis for ${PAUSE_SECONDS}s"
docker pause "$(redis_id)" >/dev/null
sleep "$PAUSE_SECONDS"
docker unpause "$(redis_id)" >/dev/null
echo "redis unpaused"
echo "worker log lines mentioning ETIMEDOUT during outage: $(compose logs worker 2>/dev/null | grep -c ETIMEDOUT || true)"

check "server creates product after unpause" 200 "$(create_product)"
if wait_processed 2 "$DEADLINE_SECONDS"; then
  echo "PASS worker processes product.created emitted after unpause within ${DEADLINE_SECONDS}s (restarts: $((  $(restarts) - restarts_before )))"
elif [ "$(restarts)" -gt "$restarts_before" ]; then
  # worker จบ process เองภายในเวลา → restart policy เริ่มใหม่ แล้วต้องประมวลผล job ที่ค้างใน queue ได้
  echo "worker exited and was restarted ($(( $(restarts) - restarts_before )) time(s)); waiting for it to process"
  wait_processed 2 120 || true
  check "restarted worker processes product.created emitted after unpause" 2 "$(processed)"
else
  echo "FAIL worker did not process product.created within ${DEADLINE_SECONDS}s and did not exit (worker /health: $(worker_health))"
  failures=$((failures + 1))
fi

if [ "$failures" -ne 0 ]; then
  echo "smoke-redis-outage: $failures check(s) failed"
  compose logs --tail 60 server worker || true
  exit 1
fi
echo "smoke-redis-outage: all checks passed"
