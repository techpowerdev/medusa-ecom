import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// CORE-4j (spec 01 กฎข้อ 73d, AC-111 grep): `createExpiredPromotion` ลบ campaign เมื่อสร้าง promotion ไม่สำเร็จ
// ต้องตรวจ `.ok()` ของการลบนั้น (cleanup ที่ล้มเงียบทิ้ง campaign ค้าง) — review #170
const source = fs.readFileSync(path.join(__dirname, "core-4g-checkout-polish.spec.ts"), "utf8")

/** เนื้อหาของ function `name` (นับวงเล็บปีกกาจาก `{` แรกหลังชื่อ) */
const functionBody = (src: string, name: string) => {
  const start = src.indexOf(`function ${name}(`)
  expect(start, `ไม่พบ function ${name}`).toBeGreaterThanOrEqual(0)
  // ข้าม parameter และ type ของผลคืน (`): Promise<...>`) ไปหา `{` ที่เปิด body
  const open = src.indexOf("{", src.indexOf("):", start))
  let depth = 1
  let i = open + 1
  while (depth > 0 && i < src.length) {
    if (src[i] === "{") depth++
    if (src[i] === "}") depth--
    i++
  }
  return src.slice(open, i)
}

test("AC-111: createExpiredPromotion ตรวจ ok() ของการลบ campaign", () => {
  const body = functionBody(source, "createExpiredPromotion")
  const deletes = body.match(/request\.delete\(/g)?.length ?? 0
  expect(deletes, "createExpiredPromotion ลบ campaign").toBeGreaterThan(0)
  // ทุก `request.delete(` ต้องเก็บผลไว้ในตัวแปรแล้วตรวจ `.ok()` ของตัวแปรนั้น
  const assigned = (body.match(/const\s+\w+\s*=\s*await\s+request\.delete\(/g) ?? []).map(
    (line) => line.match(/const\s+(\w+)/)![1]
  )
  expect(assigned.length, "ผลของ request.delete ถูกเก็บในตัวแปร").toBe(deletes)
  for (const name of assigned) {
    expect(body, `${name}.ok() ถูกตรวจ`).toMatch(new RegExp(`${name}\\.ok\\(\\)`))
  }
})
