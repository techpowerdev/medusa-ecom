#!/usr/bin/env bash
# อ่านรายชื่อไฟล์ที่เปลี่ยน (บรรทัดละไฟล์) จาก stdin แล้วพิมพ์ `code=true|false` และ `backend=true|false`
# (ใช้ใน job `changes` ของ ci.yml)
# - เอกสาร = `docs/**` (รวมไฟล์ทุกชนิดใน docs/evidence/) และ `*.md` ทุกที่ (รวม .claude/**/*.md) → ไม่นับเป็นโค้ด
# - code    = มีไฟล์ที่ไม่ใช่เอกสารอย่างน้อยหนึ่งไฟล์
# - backend = มีไฟล์โค้ดที่อยู่นอก `apps/storefront/**` (apps/backend, lockfile, package.json ที่ root,
#             pnpm-workspace.yaml, .nvmrc, .github/workflows, docker-compose*, tools/ และ config ที่ root อื่นๆ)
# ไม่มีไฟล์เลย (กันพลาด) → ทั้งสองเป็น true
set -euo pipefail

code=false
backend=false
count=0
while IFS= read -r f || [ -n "$f" ]; do
  [ -z "$f" ] && continue
  count=$((count + 1))
  case "$f" in
    docs/* | *.md) ;;
    apps/storefront/*) code=true ;;
    *) code=true; backend=true ;;
  esac
done

if [ "$count" -eq 0 ]; then code=true; backend=true; fi
echo "code=$code"
echo "backend=$backend"
