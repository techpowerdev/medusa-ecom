import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

import { REPO_ROOT } from "./support/paths"
import { THAI } from "./support/thai-text"

// CORE-64 (spec 01 กฎข้อ 122b, AC-163(c)): คู่มือ admin สำหรับ promotion แบบ fixed — ไฟล์ unit แยกของ CORE-64
// (ไม่ต่อใน core-46-e2e-hygiene.unit.spec.ts เพื่อเลี่ยง conflict กับงานที่รันขนาน)
const GUIDE = path.join(REPO_ROOT, "docs", "guides", "admin-promotions.md")

// ชื่อปุ่ม/ป้ายของ dashboard 2.22.1 ที่คู่มือต้องอ้างตามจริง (คงอังกฤษ)
const DASHBOARD_LABELS = ["Does promotion include taxes?", "Tax Inclusive", "Amount off products", "Amount off order"]

test("AC-163(c): docs/guides/admin-promotions.md มีอยู่ เป็นภาษาไทย และอ้างป้ายของ dashboard ครบ", () => {
  expect(fs.existsSync(GUIDE), GUIDE).toBe(true)
  const guide = fs.readFileSync(GUIDE, "utf8")
  expect(guide).toMatch(THAI)
  for (const label of DASHBOARD_LABELS) {
    expect(guide, `คู่มือต้องมี "${label}"`).toContain(label)
  }
})
