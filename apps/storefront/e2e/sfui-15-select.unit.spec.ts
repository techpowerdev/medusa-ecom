import fs from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"

import manifest from "./support/shadcn-ui.json"
import { STOREFRONT, readSource } from "./support/sfui-source"

// SFUI-15 (spec 09 กฎ 40a, 48, 51, AC-42; ADR-033 D1/D7): select ของ storefront = `select`/`field`/`label` ของ shadcn จาก CLI
// ประกอบตามตัวอย่าง docs ตรงที่ใช้ — ไม่มี component กลางใหม่; ผล `pnpm dlx shadcn@4.23.1 add <name> --dry-run --diff` ("No changes.") แนบใน PR
// (test นี้ offline — ความตรงกับ registry ตรวจด้วย hash ของ AC-19 ใน `sfui-7-ui-pristine.unit.spec.ts`)

/** ไฟล์ที่ไม่ใช่ test ใน `src/components/**` และ `src/modules/common/components/**` ณ develop `6257d781` (ก่อนรอบ 49) — ลบได้ เพิ่มไม่ได้ */
const KNOWN_COMPONENT_FILES = [
  "src/components/button.tsx",
  "src/components/sheet.tsx",
  "src/components/slider.tsx",
  ...Object.keys(manifest.files).map((name) => `src/components/ui/${name}`),
  ...[
    "cart-totals",
    "checkbox",
    "copy-button",
    "countdown",
    "delete-button",
    "divider",
    "filter-radio-group",
    "input",
    "interactive-link",
    "line-item-options",
    "line-item-price",
    "line-item-unit-price",
    "localized-client-link",
    "native-select",
    "option-dot",
    "share-link-button",
  ].map((name) => `src/modules/common/components/${name}/index.tsx`),
]

function filesUnder(dir: string): string[] {
  return fs.readdirSync(path.join(STOREFRONT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`
    return entry.isDirectory() ? filesUnder(rel) : [rel]
  })
}

test.describe("SFUI-15 select ของ shadcn (AC-42)", () => {
  test("select, field, label อยู่ใน ui/ และ manifest ของ CLI (กฎ 40a)", () => {
    for (const name of ["select.tsx", "field.tsx", "label.tsx"]) {
      expect(Object.keys(manifest.files), name).toContain(name)
      expect(fs.existsSync(path.join(STOREFRONT, "src/components/ui", name)), name).toBe(true)
    }
  })

  test("ไม่มีไฟล์ใหม่ใน src/components/** และ src/modules/common/components/** นอกจาก test (ไม่มี component กลางของ select)", () => {
    const added = [...filesUnder("src/components"), ...filesUnder("src/modules/common/components")]
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) => !KNOWN_COMPONENT_FILES.includes(file))
    expect(added).toEqual([])
  })

  test("e2e/support/select.ts หาด้วย testid เท่านั้น และมี chooseOption/expectSelected/selectOptions (กฎ 48)", () => {
    const source = readSource("e2e/support/select.ts")
    for (const banned of ["getByRole", "getByText", "selectOption("]) {
      expect(source.includes(banned), banned).toBe(false)
    }
    for (const name of ["chooseOption", "expectSelected", "selectOptions"]) {
      expect(source).toMatch(new RegExp(`export async function ${name}\\(`))
    }
  })
})
