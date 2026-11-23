import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { SIGN_IN_AGAIN_MESSAGE } from "./error-message"
import { MedusaApiError } from "./medusa-api-error"
import {
  GROUP_JOIN_CODES,
  groupJoinActionMessage,
  groupJoinErrorCode,
  groupJoinErrorMessage,
  groupJoinFailure,
} from "./group-join-error"

// GB-7a2a (spec 04 กฎข้อ 29f, 30a; AC-28 ส่วน unit): code ของ join/สร้างกลุ่ม → ข้อความไทยที่ต่างกันทุกตัว
const THAI = /[฀-๿]/
const conflict = (code: string, message = "x") => ({ status: 409, code, message })
// CORE-84 (กฎข้อ 140, ADR-028): error ของ `medusaFetch` — ข้อความไม่มีผลต่อการตัดสิน
const apiError = (status: number, code: string | null, message = "changed wording") =>
  new MedusaApiError({ status, type: status === 409 ? "conflict" : "invalid_data", code, message })

describe("groupJoinErrorMessage", () => {
  it("ทุก code ในกฎข้อ 29f + GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED มีข้อความไทย และไม่ซ้ำกัน (รวม 400/อื่นๆ/401)", () => {
    expect([...GROUP_JOIN_CODES].sort()).toEqual(
      [
        "GB_ALREADY_IN_OTHER_GROUP",
        "GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED",
        "GB_CART_ALREADY_JOINED",
        "GB_GROUP_FULL",
        "GB_ITEMS_NOT_ELIGIBLE",
        "GB_MAX_TOTAL_ORDERS_REACHED",
        "GB_SHIPPING_PROFILE_NOT_COVERED",
        "GB_UNITS_LIMIT_EXCEEDED",
        "PROMOTION_NOT_COMBINABLE",
      ].sort()
    )
    const texts = [
      ...GROUP_JOIN_CODES.map((c) => groupJoinErrorMessage(conflict(c))),
      groupJoinErrorMessage({ status: 400, message: "The group is no longer open for joining" }),
      groupJoinErrorMessage({ status: 500, message: "boom" }),
      groupJoinErrorMessage({ status: 401, message: "Unauthorized" }),
    ]
    for (const t of texts) expect(t).toMatch(THAI)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it("ข้อความตามกฎข้อ 29f/30a", () => {
    expect(groupJoinErrorMessage(conflict("GB_GROUP_FULL"))).toBe("กลุ่มนี้เต็มแล้ว")
    expect(groupJoinErrorMessage({ status: 400, code: "GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED" })).toBe(
      "แคมเปญนี้ยังไม่พร้อมเปิดกลุ่ม"
    )
    expect(groupJoinErrorMessage({ status: 400 })).toBe("กลุ่มหรือแคมเปญนี้ปิดรับแล้ว")
    // review #229: 403 (mode ไม่เปิดให้สร้างทีม) และ 404 (กลุ่ม/แคมเปญไม่มีแล้ว) = ปิดรับ ไม่ใช่ "ลองใหม่"
    expect(groupJoinErrorMessage({ status: 403, message: "Forbidden" })).toBe("กลุ่มหรือแคมเปญนี้ปิดรับแล้ว")
    expect(groupJoinErrorMessage({ status: 404, message: "Not found" })).toBe("กลุ่มหรือแคมเปญนี้ปิดรับแล้ว")
    expect(groupJoinErrorMessage(new Error("network"))).toBe("เข้าร่วมไม่สำเร็จ กรุณาลองใหม่")
    expect(groupJoinErrorMessage(null)).toBe("เข้าร่วมไม่สำเร็จ กรุณาลองใหม่")
    expect(groupJoinErrorMessage({ status: 401 })).toBe(SIGN_IN_AGAIN_MESSAGE)
    expect(groupJoinErrorMessage({ status: 409, code: "SOMETHING_ELSE" })).toBe("เข้าร่วมไม่สำเร็จ กรุณาลองใหม่")
  })

  it("GB_UNITS_LIMIT_EXCEEDED แสดงจำนวนสูงสุดต่อคนเมื่อรู้ค่า", () => {
    expect(groupJoinErrorMessage(conflict("GB_UNITS_LIMIT_EXCEEDED"), { maxUnitsPerPerson: 3 })).toBe(
      "เกินจำนวนชิ้นสูงสุดต่อคน (3 ชิ้น)"
    )
    expect(groupJoinErrorMessage(conflict("GB_UNITS_LIMIT_EXCEEDED"), { maxUnitsPerPerson: null })).toBe(
      "เกินจำนวนชิ้นสูงสุดต่อคน"
    )
  })
})

describe("groupJoinErrorCode — ตัดสินจาก code ของ MedusaApiError (CORE-84)", () => {
  it("code ที่รู้จัก → code นั้น ไม่ว่าข้อความเป็นอะไร; ไม่มี code → null", () => {
    expect(groupJoinErrorCode(apiError(409, "GB_GROUP_FULL"))).toBe("GB_GROUP_FULL")
    expect(groupJoinErrorCode(apiError(400, "GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED"))).toBe(
      "GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED"
    )
    expect(groupJoinErrorCode(apiError(409, null, "GB_GROUP_FULL"))).toBeNull()
    expect(groupJoinErrorCode(apiError(409, "toString"))).toBeNull()
  })

  it("contract: code ที่ backend throw ใน join.ts/single-product.ts/shipping-profile.ts อยู่ใน map ครบ", () => {
    const read = (file: string) =>
      fs.readFileSync(path.resolve(__dirname, "../../../../backend/src/modules/group_buy/utils", file), "utf8")
    const conflicts = Array.from(read("join.ts").matchAll(/conflict\(\s*(\w+),/g), ([, code]) => code)
    expect(conflicts.sort()).toEqual(
      GROUP_JOIN_CODES.filter(
        (c) => c !== "GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED" && c !== "GB_SHIPPING_PROFILE_NOT_COVERED"
      ).sort()
    )
    expect(read("join.ts")).toMatch(/INVALID_DATA,\s*"[^"]+",\s*GB_CART_EMPTY\)/)
    expect(read("single-product.ts")).toMatch(/new MedusaError\(type, SINGLE_PRODUCT_MESSAGE, GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED\)/)
    expect(read("shipping-profile.ts")).toMatch(/SHIPPING_PROFILE_NOT_COVERED_MESSAGE,\s*GB_SHIPPING_PROFILE_NOT_COVERED\s*\)/)
  })
})

// GB-7a2: server action join คืน `ActionResult` (CORE-4i) — แปลง error ฝั่ง server เป็น code แล้วฝั่ง client แปลงเป็นข้อความ
describe("groupJoinFailure + groupJoinActionMessage (GB-7a2)", () => {
  it("code ที่รู้จัก → code นั้น และข้อความเดียวกับ groupJoinErrorMessage", () => {
    const err = apiError(409, "GB_GROUP_FULL")
    expect(groupJoinFailure(err)).toEqual({ error: "GB_GROUP_FULL" })
    expect(groupJoinActionMessage("GB_GROUP_FULL")).toBe("กลุ่มนี้เต็มแล้ว")
    expect(groupJoinActionMessage("GB_UNITS_LIMIT_EXCEEDED", { maxUnitsPerPerson: 3 })).toBe(
      "เกินจำนวนชิ้นสูงสุดต่อคน (3 ชิ้น)"
    )
  })

  it("401 → unauthorized; 400/403/404 → closed; อื่นๆ → failed", () => {
    expect(groupJoinFailure(apiError(401, null, "Unauthorized"))).toEqual({ error: "unauthorized" })
    expect(groupJoinFailure({ status: 400, message: "The group is no longer open for joining" })).toEqual({ error: "closed" })
    expect(groupJoinFailure({ status: 403 })).toEqual({ error: "closed" })
    expect(groupJoinFailure({ status: 404 })).toEqual({ error: "closed" })
    expect(groupJoinFailure(new Error("network"))).toEqual({ error: "failed" })
    expect(groupJoinActionMessage("unauthorized")).toBe(SIGN_IN_AGAIN_MESSAGE)
    expect(groupJoinActionMessage("closed")).toBe("กลุ่มหรือแคมเปญนี้ปิดรับแล้ว")
    expect(groupJoinActionMessage("failed")).toBe("เข้าร่วมไม่สำเร็จ กรุณาลองใหม่")
  })

  // review: 400 cart ว่าง (INVALID_DATA) ไม่ใช่ "ปิดรับแล้ว" — CORE-84: จาก code GB_CART_EMPTY
  it("400 GB_CART_EMPTY → empty_cart ข้อความไทยของตัวเอง ไม่ซ้ำกับข้อความอื่น", () => {
    const err = apiError(400, "GB_CART_EMPTY")
    expect(groupJoinFailure(err)).toEqual({ error: "empty_cart" })
    const text = groupJoinErrorMessage(err)
    expect(text).toMatch(THAI)
    expect(text).toBe(groupJoinActionMessage("empty_cart"))
    expect(text).not.toBe("กลุ่มหรือแคมเปญนี้ปิดรับแล้ว")
    expect(text).not.toBe("เข้าร่วมไม่สำเร็จ กรุณาลองใหม่")
  })

  it("ผลเป็น object ธรรมดา (ส่งข้าม boundary ของ server action ได้)", () => {
    expect(JSON.parse(JSON.stringify(groupJoinFailure(apiError(409, "GB_GROUP_FULL"))))).toEqual({
      error: "GB_GROUP_FULL",
    })
  })
})

// GB-14 (spec 04 กฎข้อ 35d, AC-54): 400 code GB_SHIPPING_PROFILE_NOT_COVERED → code นั้น ไม่ใช่ "ปิดรับแล้ว"
describe("GB_SHIPPING_PROFILE_NOT_COVERED (GB-14)", () => {
  const CODE = "GB_SHIPPING_PROFILE_NOT_COVERED"

  it("400 ที่มี code นี้ → code นั้น (ไม่ใช่ closed); ชื่อ code อยู่แค่ในข้อความ → closed (CORE-84 ไม่อ่านข้อความ)", () => {
    expect(groupJoinFailure(apiError(400, CODE))).toEqual({ error: CODE })
    expect(groupJoinFailure(apiError(400, null, `${CODE}: x`))).toEqual({ error: "closed" })
  })

  it("ข้อความไทยของ code นี้ต่างจากข้อความของทุก code อื่น", () => {
    const text = groupJoinActionMessage(CODE)
    expect(text).toMatch(THAI)
    const others = [
      ...GROUP_JOIN_CODES.filter((c) => c !== CODE).map((c) => groupJoinActionMessage(c)),
      groupJoinActionMessage("closed"),
      groupJoinActionMessage("failed"),
      groupJoinActionMessage("empty_cart"),
      groupJoinActionMessage("unauthorized"),
    ]
    expect(others).not.toContain(text)
  })
})
