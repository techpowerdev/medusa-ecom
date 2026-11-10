#!/usr/bin/env bash
# PAY-2 (spec 06 AC-10): ยืนยันจาก log ของ `stripe listen` ว่ามี event payment_intent.succeeded
# ถูกส่งถึง endpoint แล้ว backend ตอบ 2xx (ไม่ใช่แค่ payment_intent.created)
# ใช้: check-stripe-webhooks.sh <log> <url ของ endpoint เช่น http://localhost:9000/hooks/payment/stripe_stripe>
set -euo pipefail
log=$1
url=$2

ids=$(grep -oE -- "--> payment_intent\.succeeded \[evt_[A-Za-z0-9]+\]" "$log" | grep -oE "evt_[A-Za-z0-9]+" || true)
for id in $ids; do
  if grep -qF -- "] POST $url [$id]" "$log" && grep -F -- "] POST $url [$id]" "$log" | grep -qE -- "<--  \[2[0-9]{2}\]"; then
    echo "ok: payment_intent.succeeded ($id) → $url ตอบ 2xx"
    exit 0
  fi
done
echo "::error::ไม่มี payment_intent.succeeded ที่ $url ตอบ 2xx (log: $log)"
exit 1
