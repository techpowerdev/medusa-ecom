import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// CORE-23b (spec 01 AC-97, กฎข้อ 61): e2e ของ AC-88 ต้องไม่มี `if (await x.isVisible())` ครอบ expect
// (assertion ที่อยู่ในกิ่ง if ไม่ถูกตรวจเมื่อกิ่งไม่ทำงาน — test ผ่านได้โดยไม่ยืนยันอะไร)
const SPEC = path.resolve(__dirname, "core-23-profile-order.spec.ts")

test("AC-97: e2e ของ AC-88 ไม่ใช้ if (await x.isVisible())", () => {
  const source = fs.readFileSync(SPEC, "utf8")
  const ac88 = source.slice(source.indexOf('test("AC-88'))
  expect(source).toContain('test("AC-88')
  expect(ac88).not.toMatch(/if\s*\(\s*await\s+[^)]*\.isVisible\(\)/)
})
