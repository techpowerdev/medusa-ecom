#!/usr/bin/env bash
# OPS-28 (spec 07 AC-43a): test ของ tools/ci/assert-absent.sh — ขั้นตรวจ "ต้องไม่พบข้อความ" ต้อง fail-closed
# (ผ่านเฉพาะเมื่อ grep คืน 1 = ไม่พบ; พบ หรือ grep error เช่น path ไม่มี/อ่านไม่ได้ → ล้ม)
# รันใน job `lint-typecheck` ของ ci.yml; ASSERT_ABSENT=<path> ใช้ทดสอบ script อื่น (positive control)
set -uo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
script=${ASSERT_ABSENT:-$root/tools/ci/assert-absent.sh}
case "$script" in /*) ;; *) script="$PWD/$script" ;; esac

tmp=$(mktemp -d)
trap 'chmod -R u+rwx "$tmp"; rm -rf "$tmp"' EXIT
needle="Needle Text"

pass=0
fail=0
skip=0

ok() { pass=$((pass + 1)); echo "ok   - $1"; }
ng() { fail=$((fail + 1)); echo "FAIL - $1"; }

run() { # รัน script ด้วย sh (POSIX) เก็บ exit code ใน $rc และ output ใน $out
  out=$(sh "$script" "$@" 2>&1)
  rc=$?
}

expect_pass() { # <ชื่อเคส> <args...>
  local name=$1
  shift
  run "$@"
  if [ "$rc" -eq 0 ]; then ok "$name → exit 0"; else ng "$name → ได้ exit $rc คาด 0 (output: $out)"; fi
}

expect_fail() { # <ชื่อเคส> <ข้อความที่ต้องอยู่ใน output> <args...>
  local name=$1 want=$2
  shift 2
  run "$@"
  if [ "$rc" -eq 0 ]; then
    ng "$name → ได้ exit 0 คาด ≠ 0"
  elif [ -n "$want" ] && ! grep -qF -- "$want" <<< "$out"; then
    ng "$name → output ไม่มี '$want' (output: $out)"
  elif ! grep -qF -- "::error::" <<< "$out"; then
    ng "$name → output ไม่มี ::error:: (output: $out)"
  else
    ok "$name → exit $rc"
  fi
}

mkdir -p "$tmp/clean" "$tmp/hit/sub" "$tmp/nm/node_modules/pkg" "$tmp/many"
printf 'production bundle\n' > "$tmp/clean/a.js"
printf 'ok\n' > "$tmp/hit/sub/ok.js"
printf 'x %s y\n' "$needle" > "$tmp/hit/sub/bad.js"
printf 'ok\n' > "$tmp/nm/app.js"
printf '%s\n' "$needle" > "$tmp/nm/node_modules/pkg/index.js"
for i in 1 2 3; do printf 'file %s\n' "$i" > "$tmp/many/f$i.js"; done

expect_pass "ไม่พบ (ไฟล์เดียว)" "$needle" "$tmp/clean/a.js"
expect_pass "ไม่พบ (directory แบบ recursive)" "$needle" "$tmp/clean"
expect_fail "พบใน directory → output มีชื่อไฟล์" "$tmp/hit/sub/bad.js" "$needle" "$tmp/hit"
expect_fail "พบ (ไฟล์ระบุตรง) → output มีชื่อไฟล์" "$tmp/hit/sub/bad.js" "$needle" "$tmp/hit/sub/ok.js" "$tmp/hit/sub/bad.js"
expect_fail "path ไม่มีอยู่ (เช่น glob ไม่ตรงจนเป็นตัวอักษร)" "" "$needle" "$tmp/missing/*.js"
expect_fail "path ไม่มีอยู่ปนกับไฟล์ที่ไม่พบ" "" "$needle" "$tmp/clean/a.js" "$tmp/missing.js"
expect_pass "ข้อความอยู่เฉพาะใต้ node_modules/" "$needle" "$tmp/nm"
expect_pass "หลายไฟล์ที่ไม่มีข้อความ" "$needle" "$tmp/many/f1.js" "$tmp/many/f2.js" "$tmp/many/f3.js"
expect_fail "ไม่ส่ง path" "" "$needle"
expect_fail "ข้อความว่าง" "" "" "$tmp/clean"

if [ "$(id -u)" -eq 0 ]; then
  skip=$((skip + 1))
  echo "skip - ไฟล์อ่านไม่ได้ (chmod 000): uid = 0 อ่านได้เสมอ จึงข้ามเคสนี้"
else
  mkdir -p "$tmp/locked"
  printf 'ok\n' > "$tmp/locked/a.js"
  printf 'ok\n' > "$tmp/locked/secret.js"
  chmod 000 "$tmp/locked/secret.js"
  expect_fail "ไฟล์อ่านไม่ได้ (chmod 000) ใน directory" "" "$needle" "$tmp/locked"
  expect_fail "ไฟล์อ่านไม่ได้ (chmod 000) ระบุตรง" "" "$needle" "$tmp/locked/secret.js"
fi

total=$((pass + fail))
echo "assert-absent: $pass/$total passed ($skip skipped)"
[ "$((total + skip * 2))" -eq 12 ] || { echo "FAIL - จำนวนเคสต้องเป็น 12 (ได้ $total + skip $skip)"; exit 1; }
[ "$fail" -eq 0 ]
