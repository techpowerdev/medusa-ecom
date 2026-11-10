import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { DEFAULT_RETURN_WINDOW_DAYS, RETURN_ERRORS } from "@lib/util/return-request"

// CORE-20d (spec 01 กฎข้อ 66a/66c, AC-102): contract กับ backend ของ CORE-20b — อ่าน source ของ backend ตรง
// `FetchError` ของ js-sdk เก็บแค่ message ไม่มี `code` → storefront จับคู่ด้วยข้อความคงที่ของ backend
// test นี้ต้องล้มเมื่อ backend เปลี่ยนข้อความ/code/ค่าเริ่มต้นโดยไม่แก้ฝั่ง storefront
const BACKEND_SRC = path.resolve(__dirname, "../../backend/src")
const read = (file: string) => fs.readFileSync(path.join(BACKEND_SRC, file), "utf8")

/** `{ code: RETURN_X, message: "..." }` ทุกคู่ใน return-window.ts (แปลงชื่อ const เป็นค่า string) */
const backendReturnErrors = () => {
  const source = read("api/store/ownership/return-window.ts")
  const constants = new Map(
    Array.from(source.matchAll(/export const (RETURN_\w+) = "([^"]+)"/g), ([, name, value]) => [name, value])
  )
  return Array.from(source.matchAll(/\{\s*code:\s*(RETURN_\w+),\s*message:\s*"([^"]+)"\s*\}/g), ([, name, message]) => ({
    code: constants.get(name),
    message,
  }))
}

describe("contract: error code ของ POST /store/returns (CORE-20b)", () => {
  it("อ่านคู่ code/message จาก backend ได้ครบ 3 code", () => {
    expect(backendReturnErrors().map((e) => e.code).sort()).toEqual([
      "RETURN_ITEM_NOT_SHIPPABLE",
      "RETURN_ITEM_NOT_SHIPPED",
      "RETURN_WINDOW_EXPIRED",
    ])
  })

  it("map ของ storefront มี code และข้อความตรงกับ backend ทุกตัว", () => {
    const mapped = RETURN_ERRORS.map(({ code, message }) => ({ code, message }))
    expect(mapped).toEqual(expect.arrayContaining(backendReturnErrors()))
    expect(mapped).toHaveLength(backendReturnErrors().length)
  })
})

describe("contract: ค่าเริ่มต้นของ return_window_days", () => {
  it("เท่ากับ DEFAULT_REGION_STORE_POLICIES ของ backend", () => {
    const match = read("lib/region-store-policies.ts").match(/return_window_days:\s*(\d+)/)
    expect(match, "return_window_days ใน DEFAULT_REGION_STORE_POLICIES").not.toBeNull()
    expect(DEFAULT_RETURN_WINDOW_DAYS).toBe(Number(match![1]))
  })
})
