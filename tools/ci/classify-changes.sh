#!/usr/bin/env bash
# อ่านรายชื่อไฟล์ที่เปลี่ยน (บรรทัดละไฟล์) จาก stdin แล้วพิมพ์ `code=true|false` (ใช้ใน job `changes` ของ ci.yml)
# เอกสาร = `docs/**` (รวมไฟล์ทุกชนิดใน docs/evidence/) และ `*.md` ทุกที่ (รวม .claude/**/*.md)
# มีไฟล์อื่นอย่างน้อยหนึ่งไฟล์ หรือไม่มีไฟล์เลย (กันพลาด) → code=true
set -euo pipefail

code=false
count=0
while IFS= read -r f || [ -n "$f" ]; do
  [ -z "$f" ] && continue
  count=$((count + 1))
  case "$f" in
    docs/* | *.md) ;;
    *) code=true ;;
  esac
done

if [ "$count" -eq 0 ]; then code=true; fi
echo "code=$code"
