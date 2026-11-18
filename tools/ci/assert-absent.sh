#!/bin/sh
# OPS-28 (spec 07 AC-43): ตรวจว่า "ต้องไม่พบ" <ข้อความ> ใน <path>... แบบ fail-closed
# ค้นแบบ fixed string, recursive เมื่อ path เป็น directory, ข้าม node_modules
# ผ่าน (exit 0) เฉพาะเมื่อ grep คืน 1 = ไม่พบ; คืน 0 = พบ → ล้มพร้อมรายชื่อไฟล์;
# คืน ≥ 2 = ตรวจไม่ได้ (path ไม่มี, glob ไม่ตรงจนเป็นตัวอักษร, ไฟล์อ่านไม่ได้) → ล้ม — ไม่นับเป็น "ไม่พบ"
# POSIX sh: รันใน image node:*-bookworm-slim ได้ (ci.yml job docker-worker-mode mount เข้า container ที่ /ci)
# ใช้: assert-absent.sh <ข้อความ> <path>...
set -u

if [ "$#" -lt 2 ] || [ -z "$1" ]; then
  echo "::error::assert-absent.sh: ต้องระบุ <ข้อความ ไม่ว่าง> <path>..."
  exit 2
fi
text=$1
shift

found=$(grep -rlF --exclude-dir=node_modules -e "$text" -- "$@")
rc=$?

case "$rc" in
  1)
    echo "OK ไม่พบ \"$text\" ใน $# path ($1 …)"
    exit 0
    ;;
  0)
    echo "$found"
    echo "::error::พบ \"$text\" ในไฟล์ข้างบน"
    exit 1
    ;;
  *)
    [ -n "$found" ] && echo "$found"
    echo "::error::ตรวจ \"$text\" ไม่ได้ (grep exit $rc — path ไม่มี/อ่านไม่ได้) — ไม่ถือว่าไม่พบ"
    exit "$rc"
    ;;
esac
