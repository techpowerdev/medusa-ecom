import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { DEFAULT_RETURN_WINDOW_DAYS, RETURN_ERRORS, RETURN_NOT_STOCKED } from "@lib/util/return-request"

// CORE-20d (spec 01 กฎข้อ 66a/66c, AC-102): contract กับ backend ของ CORE-20b — อ่าน source ของ backend ตรง
// CORE-83 (กฎข้อ 140, ADR-028): storefront ตัดสินจาก `code` (medusaFetch) — contract เทียบ code ไม่เทียบข้อความ
// test นี้ต้องล้มเมื่อ backend เปลี่ยน code/ค่าเริ่มต้นโดยไม่แก้ฝั่ง storefront
const BACKEND_SRC = path.resolve(__dirname, "../../backend/src")
const read = (file: string) => fs.readFileSync(path.join(BACKEND_SRC, file), "utf8")

/** ค่าของ `export const RETURN_X = "..."` ในไฟล์ของ backend (ไม่รวมชื่อที่ลงท้าย _MESSAGE) */
const backendCodes = (file: string) =>
  Array.from(read(file).matchAll(/export const (RETURN_\w+) = "([^"]+)"/g))
    .filter(([, name]) => !name.endsWith("_MESSAGE"))
    .map(([, , value]) => value)
    .sort()

describe("contract: error code ของ POST /store/returns (CORE-20b)", () => {
  it("code ของ return-window.ts ครบ 3 ตัว และ map ของ storefront มี code ตรงกันทุกตัว", () => {
    const codes = backendCodes("api/store/ownership/return-window.ts")
    expect(codes).toEqual(["RETURN_ITEM_NOT_SHIPPABLE", "RETURN_ITEM_NOT_SHIPPED", "RETURN_WINDOW_EXPIRED"])
    expect(RETURN_ERRORS.map((e) => e.code).sort()).toEqual(codes)
  })

  it("map มีแค่ code + ข้อความไทย (ไม่มีข้อความอังกฤษของ backend)", () => {
    for (const error of RETURN_ERRORS) {
      expect(Object.keys(error).sort()).toEqual(["code", "text"])
    }
  })
})

// CORE-71 (กฎข้อ 129) / CORE-76 (กฎข้อ 134b): location ของ return option ไม่มีของ หรือ option ไม่มี stock location (CORE-55)
describe("contract: error ที่ให้ติดต่อร้าน (CORE-55 return-location.ts)", () => {
  it("code ที่ storefront จับคู่ตรงกับ code ของ backend", () => {
    expect(backendCodes("api/store/ownership/return-location.ts")).toEqual(["RETURN_ITEM_NOT_STOCKED", "RETURN_NO_LOCATION"])
    expect([...RETURN_NOT_STOCKED.codes].sort()).toEqual(backendCodes("api/store/ownership/return-location.ts"))
  })

  it("backend throw ด้วย code (อาร์กิวเมนต์ที่ 3 ของ MedusaError) ทั้งสองจุด", () => {
    const source = read("api/store/ownership/return-location.ts")
    expect(source).toMatch(/RETURN_NO_LOCATION_MESSAGE,\s*RETURN_NO_LOCATION\)/)
    expect(source).toMatch(/RETURN_ITEM_NOT_STOCKED_MESSAGE,\s*RETURN_ITEM_NOT_STOCKED\)/)
  })
})

describe("contract: ค่าเริ่มต้นของ return_window_days", () => {
  it("เท่ากับ DEFAULT_REGION_STORE_POLICIES ของ backend", () => {
    const match = read("lib/region-store-policies.ts").match(/return_window_days:\s*(\d+)/)
    expect(match, "return_window_days ใน DEFAULT_REGION_STORE_POLICIES").not.toBeNull()
    expect(DEFAULT_RETURN_WINDOW_DAYS).toBe(Number(match![1]))
  })
})
