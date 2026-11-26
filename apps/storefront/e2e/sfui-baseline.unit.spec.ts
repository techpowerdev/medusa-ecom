import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

import baseline from "./support/sfui-baseline.json"
import {
  STOREFRONT,
  extractTestIds,
  extractThai,
  readSource,
  sourceFiles,
  squash,
} from "./support/sfui-source"

// SFUI (spec 09 กฎ 9–10, AC-5): data-testid และข้อความไทยทุกค่าที่มีใน src/** ก่อนเริ่มย้าย (baseline สร้างจาก origin/develop
// ก่อนแก้ใดๆ ใน SFUI-1a) ต้องยังพบใน src/** — เทียบหลังลบช่องว่างทั้งหมด (ไม่สนการตัดบรรทัด)
// แก้ e2e/support/sfui-baseline.json ได้เฉพาะเมื่อ spec 09 ระบุข้อยกเว้น — ข้อยกเว้นอยู่ใน EXCEPTIONS (ไม่แก้ไฟล์ baseline)
const corpus = squash(sourceFiles().map(readSource).join("\n"))

// spec 09 AC-5 ข้อยกเว้น (SFUI-6): ค่า default `radio-button` ของ `common/components/radio` ที่ AC-16 สั่งลบ — component นี้
// ไม่มีผู้ใช้ตั้งแต่บน develop (ไม่มีไฟล์ใด import) และไม่มี e2e ใดอ้าง testid นี้
const EXCEPTIONS = ["radio-button"]

const missing = (values: string[]) =>
  values.filter((value) => !EXCEPTIONS.includes(value) && !corpus.includes(squash(value)))

test("AC-5: ข้อยกเว้นอยู่ใน baseline จริง และไม่มี e2e ใดอ้าง", () => {
  for (const value of EXCEPTIONS) expect(baseline.testids, value).toContain(value)
  const e2eDir = path.join(STOREFRONT, "e2e")
  const specs = fs.readdirSync(e2eDir).filter((name) => /\.spec\.ts$/.test(name) && name !== "sfui-baseline.unit.spec.ts")
  for (const value of EXCEPTIONS) {
    const users = specs.filter((name) => fs.readFileSync(path.join(e2eDir, name), "utf8").includes(`"${value}"`))
    expect(users, value).toEqual([])
  }
})

test("AC-5: baseline ไม่ว่าง (กันผ่านแบบว่างเปล่า)", () => {
  expect(baseline.testids.length).toBeGreaterThan(400)
  expect(baseline.thai.length).toBeGreaterThan(400)
})

test("AC-5: data-testid ทุกค่าใน baseline ยังอยู่ใน src/**", () => {
  expect(missing(baseline.testids), "data-testid ที่หายไป").toEqual([])
})

test("AC-5: ข้อความไทยทุกค่าใน baseline ยังอยู่ใน src/**", () => {
  expect(missing(baseline.thai), "ข้อความไทยที่หายไป").toEqual([])
})

// positive/negative control ของตัวดึง (รูปแบบที่ spec ระบุ)
test("AC-5: ตัวดึง testid รองรับ JSX, {\"…\"}, template literal, ternary และ object key", () => {
  const source = [
    'const a = <div data-testid="plain" />',
    'const b = <div data-testid={"braced"} />',
    "const c = <div data-testid={`row-${id}`} />",
    'const d = <div data-testid={x ? "yes" : "no"} />',
    'const e = createElement("p", { "data-testid": "object-key" })',
    "const f = <div data-testid={dataTestId} />",
    '// <div data-testid="in-comment" />',
  ].join("\n")
  expect(extractTestIds("x.tsx", source)).toEqual([
    "plain",
    "braced",
    "row-${id}",
    "yes",
    "no",
    "object-key",
  ])
})

test("AC-5: ตัวดึงข้อความไทยเก็บสตริงและข้อความ JSX ที่มีอักษรไทย ไม่เก็บ comment/ละติน", () => {
  const source = [
    "// ความเห็นภาษาไทย",
    'const a = "ตะกร้า"',
    "const b = 'ชำระเงิน'",
    "const c = `รวม ${n} ชิ้น`",
    "const d = <p>\n  สินค้า   ทั้งหมด\n</p>",
    'const e = "English only"',
  ].join("\n")
  expect(extractThai("x.tsx", source)).toEqual([
    "ตะกร้า",
    "ชำระเงิน",
    "รวม ${n} ชิ้น",
    "สินค้า ทั้งหมด",
  ])
})
