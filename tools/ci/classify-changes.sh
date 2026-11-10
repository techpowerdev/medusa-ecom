#!/usr/bin/env bash
# จัดกลุ่มไฟล์ที่เปลี่ยน แล้วพิมพ์ `code=true|false` และ `backend=true|false` (ใช้ใน job `changes` ของ ci.yml)
#   classify-changes.sh <base>...<head>   → คำนวณรายชื่อไฟล์ด้วย git diff --no-renames (โหมดที่ CI ใช้)
#   classify-changes.sh < files.txt       → อ่านรายชื่อไฟล์ (บรรทัดละไฟล์) จาก stdin
# --no-renames: rename ต้องนับทั้ง path เดิมและ path ใหม่ ไม่อย่างนั้นการย้ายไฟล์ backend ไป docs/ หรือ
# apps/storefront/ หรือเปลี่ยนเป็น .md จะเห็นแค่ path ใหม่แล้วได้ code=false/backend=false
# - เอกสาร = `docs/**` (รวมไฟล์ทุกชนิดใน docs/evidence/) และ `*.md` ทุกที่ (รวม .claude/**/*.md) → ไม่นับเป็นโค้ด
# - code    = มีไฟล์ที่ไม่ใช่เอกสารอย่างน้อยหนึ่งไฟล์
# - backend = มีไฟล์โค้ดที่อยู่นอก `apps/storefront/**` (apps/backend, lockfile, package.json ที่ root,
#             pnpm-workspace.yaml, .nvmrc, .github/workflows, docker-compose*, tools/ และ config ที่ root อื่นๆ)
# ไม่มีไฟล์เลย (กันพลาด) → ทั้งสองเป็น true
set -euo pipefail

if [ "$#" -gt 0 ]; then
  files=$(git diff --name-only --no-renames "$1")
else
  files=$(cat)
fi
# รายชื่อไฟล์ไปที่ stderr ให้เห็นใน log ของ CI (stdout เป็น output ของ job เท่านั้น)
printf '%s\n' "$files" >&2

code=false
backend=false
count=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  count=$((count + 1))
  case "$f" in
    docs/* | *.md) ;;
    apps/storefront/*) code=true ;;
    *) code=true; backend=true ;;
  esac
done <<< "$files"

if [ "$count" -eq 0 ]; then code=true; backend=true; fi
echo "code=$code"
echo "backend=$backend"
