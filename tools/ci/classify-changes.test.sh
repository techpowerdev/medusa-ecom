#!/usr/bin/env bash
# OPS-10 (spec 07 AC-14): test ของ tools/ci/classify-changes.sh — 30 เคส (25 โหมด stdin + 5 rename โหมด git range)
# รันใน job `lint-typecheck` ของ ci.yml; แก้กติกาใน script แล้วต้องแก้เคสที่นี่ด้วย (ไม่งั้น test ล้ม)
# CLASSIFY=<path> ใช้ทดสอบ script อื่น (positive control: ชี้ไปที่สำเนาที่แก้กติกาแล้ว test ต้องล้ม)
set -uo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
classify=${CLASSIFY:-$root/tools/ci/classify-changes.sh}
case "$classify" in /*) ;; *) classify="$PWD/$classify" ;; esac

pass=0
fail=0

check() { # <ชื่อเคส> <ผลที่คาด code/backend> <ผลจริง>
  if [ "$2" = "$3" ]; then
    pass=$((pass + 1))
    echo "ok   - $1 → $3"
  else
    fail=$((fail + 1))
    echo "FAIL - $1 → ได้ $3 คาด $2"
  fi
}

result() { # แปลง stdout ของ classify เป็น "<code>/<backend>"
  local out
  out=$("$@" 2>/dev/null) || { echo "exit-error"; return; }
  echo "$(sed -n 's/^code=//p' <<< "$out")/$(sed -n 's/^backend=//p' <<< "$out")"
}

stdin_case() { # <ชื่อเคส> <ผลที่คาด> <ไฟล์...>
  local name=$1 want=$2
  shift 2
  check "$name" "$want" "$(printf '%s\n' "$@" | result "$classify")"
}

# --- โหมด stdin (25 เคส) ---
stdin_case "spec ใน docs/" false/false docs/spec/07-scaling-ops.md
stdin_case "README.md ที่ root" false/false README.md
stdin_case ".claude/agents/*.md" false/false .claude/agents/builder.md
stdin_case "png ใน docs/evidence/" false/false docs/evidence/payments/PAY-2/checkout.png
stdin_case "txt ใน docs/evidence/" false/false docs/evidence/ops/OPS-1-tests.txt
stdin_case ".md ใน apps/backend" false/false apps/backend/README.md
stdin_case "เอกสารหลายไฟล์" false/false docs/ROADMAP.md CLAUDE.md docs/decisions/ADR-001.md
stdin_case ".mdx ใน docs/" false/false docs/guide.mdx
stdin_case "storefront ล้วน" true/false apps/storefront/src/app/page.tsx
stdin_case "storefront + เอกสาร" true/false apps/storefront/src/lib/x.ts docs/spec/01-core-medusa.md
stdin_case "storefront + backend" true/true apps/storefront/src/app/page.tsx apps/backend/src/api/middlewares.ts
stdin_case "backend" true/true apps/backend/src/modules/x/service.ts
stdin_case "backend + เอกสาร" true/true docs/spec/04-group-buying.md apps/backend/src/workflows/x.ts
stdin_case "lockfile" true/true pnpm-lock.yaml
stdin_case "package.json ที่ root" true/true package.json
stdin_case "pnpm-workspace.yaml" true/true pnpm-workspace.yaml
stdin_case ".nvmrc" true/true .nvmrc
stdin_case "eslint.config.ts ที่ root" true/true eslint.config.ts
stdin_case "docker-compose.yml" true/true docker-compose.yml
stdin_case "docker-compose.prod.yml" true/true docker-compose.prod.yml
stdin_case "tools/ops" true/true tools/ops/smoke-worker-mode.sh
stdin_case "ไฟล์ CI (.github/workflows)" true/true .github/workflows/ci.yml
stdin_case ".mdx นอก docs/ (ไม่ใช่ .md)" true/true guide.mdx
stdin_case "prefix trap apps/storefront-legacy" true/true apps/storefront-legacy/src/x.ts
check "diff ว่าง (กันพลาด)" true/true "$(printf '' | result "$classify")"

# --- โหมด git range กับ rename (5 เคส): --no-renames ต้องนับทั้ง path เดิมและ path ใหม่ ---
repo=$(mktemp -d "${TMPDIR:-/tmp}/ops10-classify.XXXXXX")
trap 'rm -rf "$repo"' EXIT
g() { git -C "$repo" -c user.name=ops10 -c user.email=ops10@example.com -c commit.gpgsign=false "$@" >/dev/null; }
g init -q
mkdir -p "$repo/apps/backend/src" "$repo/apps/storefront/src" "$repo/docs"
for f in apps/backend/src/a.ts apps/backend/src/b.ts apps/backend/src/c.ts docs/d.md apps/storefront/src/e.ts; do
  printf 'line one of %s\nline two\nline three\n' "$(basename "$f")" > "$repo/$f"
done
g add -A
g commit -q -m base

rename_case() { # <ชื่อเคส> <ผลที่คาด> <จาก> <ไป>
  local base
  base=$(git -C "$repo" rev-parse HEAD)
  g checkout -q -b "case-$RANDOM$RANDOM" "$base"
  mkdir -p "$repo/$(dirname "$4")"
  g mv "$3" "$4"
  g commit -q -m "mv $3 $4"
  check "$1" "$2" "$(cd "$repo" && result "$classify" "$base...HEAD")"
  g checkout -q "$base"
}
rename_case "rename backend → docs/" true/true apps/backend/src/a.ts docs/a.ts
rename_case "rename backend → storefront" true/true apps/backend/src/b.ts apps/storefront/src/b.ts
rename_case "rename .ts → .md" true/true apps/backend/src/c.ts apps/backend/src/c.md
rename_case "rename docs → docs" false/false docs/d.md docs/archive/d.md
rename_case "rename storefront → storefront" true/false apps/storefront/src/e.ts apps/storefront/src/lib/e.ts

total=$((pass + fail))
echo "classify-changes: $pass/$total passed"
[ "$total" -eq 30 ] || { echo "FAIL - จำนวนเคสต้องเป็น 30 (ได้ $total)"; exit 1; }
[ "$fail" -eq 0 ]
