import { expect, test } from "@playwright/test"

import baseline from "./support/sfui-baseline.json"
import {
  extractTestIds,
  extractThai,
  readSource,
  sourceFiles,
  squash,
} from "./support/sfui-source"

// SFUI (spec 09 กฎ 9–10, AC-5): data-testid และข้อความไทยทุกค่าที่มีใน src/** ก่อนเริ่มย้าย (baseline สร้างจาก origin/develop
// ก่อนแก้ใดๆ ใน SFUI-1a) ต้องยังพบใน src/** — เทียบหลังลบช่องว่างทั้งหมด (ไม่สนการตัดบรรทัด)
// แก้ e2e/support/sfui-baseline.json ได้เฉพาะเมื่อ spec 09 ระบุข้อยกเว้น (ยังไม่มี)
const corpus = squash(sourceFiles().map(readSource).join("\n"))

const missing = (values: string[]) => values.filter((value) => !corpus.includes(squash(value)))

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
