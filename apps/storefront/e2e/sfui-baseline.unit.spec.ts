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

// spec 09 AC-5 ข้อยกเว้น (SFUI-6): `radio-button` = ค่า default ของ `common/components/radio` (`MedusaRadio`) — บน develop render ใน checkout
// (address-select, payment-container, shipping) แต่หายจาก DOM ตั้งแต่ SFUI-3d/3e ที่เปลี่ยนเป็น `RadioGroupItem` + `OptionDot`
// (testid ของตัวเลือกอยู่บนปุ่ม role="radio" ตาม ADR-030 ข้อ 11) และ AC-16 สั่งลบไฟล์ใน SFUI-6; ไม่มี e2e ใดอ้าง testid นี้
const EXCEPTIONS = ["radio-button"]

const missing = (values: string[]) =>
  values.filter((value) => !EXCEPTIONS.includes(value) && !corpus.includes(squash(value)))

/** ไฟล์ `.ts` ทั้งหมดใต้ e2e/ (รวม e2e/support/**) ยกเว้นไฟล์นี้ */
function e2eFiles(dir: string = path.join(STOREFRONT, "e2e")): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return e2eFiles(full)
    return /\.ts$/.test(entry.name) && full !== __filename ? [full] : []
  })
}

test("AC-5: ข้อยกเว้นอยู่ใน baseline จริง และไม่มีไฟล์ใน e2e/ (รวม support) อ้าง", () => {
  const files = e2eFiles()
  expect(files.some((file) => file.includes(`${path.sep}support${path.sep}`)), "รวม e2e/support/**").toBe(true)
  for (const value of EXCEPTIONS) {
    expect(baseline.testids, value).toContain(value)
    const quoted = new RegExp(`['"\`]${value}['"\`]`)
    const users = files.filter((file) => quoted.test(fs.readFileSync(file, "utf8")))
    expect(users.map((file) => path.relative(STOREFRONT, file)), value).toEqual([])
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
