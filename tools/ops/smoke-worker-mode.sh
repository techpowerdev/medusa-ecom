#!/usr/bin/env bash
# OPS-1 smoke test ของ AC-1 (docs/spec/07-scaling-ops.md):
# backend image เดียวกันบูตเป็น server และ worker ได้; scheduled jobs ถูกโหลดเฉพาะบน worker
# รันจาก root ของ repo: tools/ops/smoke-worker-mode.sh (ต้องมี docker compose v2)
set -euo pipefail

PROJECT="${SMOKE_PROJECT:-ops1test}"
# ใช้ postgres/redis ภายใน project นี้เสมอ — ไม่ให้ DATABASE_URL/REDIS_URL ของ shell (dev) รั่วเข้ามา
unset DATABASE_URL REDIS_URL
export SERVER_PORT="${SERVER_PORT:-9104}"
export LOG_LEVEL=debug # JobLoader ของ Medusa log "Jobs registered." ที่ระดับ debug
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -hex 16)}"
export JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
export COOKIE_SECRET="${COOKIE_SECRET:-$(openssl rand -hex 32)}"
export STRIPE_API_KEY="${STRIPE_API_KEY:-sk_test_dummy}" # smoke ไม่เรียก Stripe; provider ต้องการ key ตอนบูตเท่านั้น
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_dummy}"

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

if [ "$failures" -ne 0 ]; then
  echo "smoke-worker-mode: $failures check(s) failed"
  compose logs --tail 50 server worker || true
  exit 1
fi
echo "smoke-worker-mode: all checks passed"
