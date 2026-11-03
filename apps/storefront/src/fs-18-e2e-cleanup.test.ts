import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// FS-18 (spec 03 กฎข้อ 23b, AC-25 grep): e2e ของ FS-14/FS-17 (`flash-sale-fs14.spec.ts`) และ FS-16 ลบข้อมูลที่สร้างทั้งหมดใน
// `afterAll` (โปรโมชัน + แคมเปญ + สินค้า + collection) ผ่าน helper ที่ลบครบก่อนแล้วจึงตรวจ `ok()` ทุกตัว, ท้าย `afterAll`
// ยืนยันด้วย admin API ว่าไม่เหลือสินค้า/collection ที่ชื่อมี run id และทุก `toPass` ระบุ `intervals` 1–2 วินาที

const E2E = path.resolve(__dirname, "..", "e2e")
const SPECS = ["flash-sale-fs14.spec.ts", "flash-sale-fs16.spec.ts"]
const read = (file: string) => readFileSync(path.join(E2E, file), "utf8")

/** ข้อความในวงเล็บของการเรียกที่เริ่มที่ `start` (ตำแหน่งของ `(`) */
function callArgs(src: string, start: number): string {
  let depth = 0
  for (let i = start; i < src.length; i++) {
    if (src[i] === "(") depth++
    if (src[i] === ")" && --depth === 0) return src.slice(start + 1, i)
  }
  throw new Error("วงเล็บไม่ปิด")
}

const afterAllBody = (src: string) => {
  const at = src.indexOf("test.afterAll(")
  expect(at, "ต้องมี test.afterAll").toBeGreaterThan(-1)
  return callArgs(src, at + "test.afterAll".length)
}

describe.each(SPECS)("%s (FS-18, AC-25)", (file) => {
  const src = read(file)

  it("afterAll ลบโปรโมชัน แคมเปญ สินค้า collection ผ่าน deleteAllThenExpectOk แล้วยืนยันว่าไม่เหลือ", () => {
    const body = afterAllBody(src)
    expect(body).toContain("deleteAllThenExpectOk(")
    for (const resource of ["promotions", "campaigns", "products", "collections"]) {
      expect(body, `afterAll ต้องลบ /admin/${resource}`).toContain(`/admin/${resource}/`)
    }
    expect(body).toContain("expectNoneLeft(")
    expect(body.indexOf("expectNoneLeft(")).toBeGreaterThan(body.indexOf("deleteAllThenExpectOk("))
    // ไม่ assert ทีละ request ระหว่างลบ (assert ล้มตัวแรก = ตัวที่เหลือค้าง)
    expect(body).not.toMatch(/request\.(delete|post)\(/)
  })

  it("ทุก toPass ระบุ intervals 1–2 วินาที", () => {
    const calls = Array.from(src.matchAll(/\.toPass\(/g)).map((m) =>
      callArgs(src, m.index! + ".toPass".length)
    )
    for (const args of calls) {
      const intervals = args.match(/intervals:\s*\[([^\]]*)\]/)
      expect(intervals, `toPass(${args}) ไม่มี intervals`).not.toBeNull()
      for (const ms of intervals![1].split(",").map((v) => Number(v.replace(/_/g, "").trim()))) {
        expect(ms).toBeGreaterThanOrEqual(1_000)
        expect(ms).toBeLessThanOrEqual(2_000)
      }
    }
  })
})
