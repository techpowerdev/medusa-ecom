import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// CORE-23b (spec 01 AC-97, กฎข้อ 61): e2e ของ AC-88 ต้องไม่มี `if (await x.isVisible())` ครอบ expect
// (assertion ที่อยู่ในกิ่ง if ไม่ถูกตรวจเมื่อกิ่งไม่ทำงาน — test ผ่านได้โดยไม่ยืนยันอะไร)
const SPEC = path.resolve(__dirname, "core-23-profile-order.spec.ts")
// CORE-5d กฎข้อ 77e: เงื่อนไขของ if มีวงเล็บได้ (getByTestId("x"), locator แบบ chain) ไม่ข้ามไปถึงตัว block ของ if
const IF_AWAIT_IS_VISIBLE =
  /if\s*\(\s*await\s+(?:(?!\)\s*\{|;)[\s\S])*?\.isVisible\(/

test("AC-97: e2e ของ AC-88 ไม่ใช้ if (await x.isVisible())", () => {
  const source = fs.readFileSync(SPEC, "utf8")
  const ac88 = source.slice(source.indexOf('test("AC-88'))
  expect(source).toContain('test("AC-88')
  expect(ac88).not.toMatch(IF_AWAIT_IS_VISIBLE)
})

for (const code of [
  "if (await x.isVisible()) {",
  'if (await page.getByTestId("x").isVisible()) {',
  'if (await page.getByTestId("x").first().isVisible()) {',
  'if (await page.locator("a").getByRole("button", { name: "y" }).isVisible()) {',
  'if (\n  await page\n    .getByTestId("x")\n    .isVisible()\n) {',
]) {
  test(`AC-115 (77e): จับ ${code.replace(/\s+/g, " ")}`, () => {
    expect(code).toMatch(IF_AWAIT_IS_VISIBLE)
  })
}

test("AC-115 (77e): ไม่จับ isVisible ที่อยู่ในตัว block ของ if", () => {
  expect(
    'if (await page.getByTestId("a").count()) {\n  await b.isVisible()\n}'
  ).not.toMatch(IF_AWAIT_IS_VISIBLE)
})
