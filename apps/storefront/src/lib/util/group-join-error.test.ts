import fs from "node:fs"
import path from "node:path"
import { FetchError } from "@medusajs/js-sdk"
import { describe, expect, it } from "vitest"

import { SIGN_IN_AGAIN_MESSAGE } from "./error-message"
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

describe("groupJoinErrorCode — FetchError ของ js-sdk 2.22.1 ไม่มี code จึงจับจากข้อความคงที่ของ backend", () => {
  it("FetchError 409 → code จากข้อความ (รวมข้อความที่ medusaError ทำตัวแรกใหญ่ + จุดท้าย)", () => {
    expect(groupJoinErrorCode(new FetchError("The group is full", "Conflict", 409))).toBe("GB_GROUP_FULL")
    expect(groupJoinErrorCode(new FetchError("At most 3 units per person.", "Conflict", 409))).toBe(
      "GB_UNITS_LIMIT_EXCEEDED"
    )
  })

  it("ข้อความที่มีชื่อ code อยู่ (กฎข้อ 30a: 400 ระบุ code ในข้อความ) → code นั้น", () => {
    const err = new FetchError("Campaign needs one product (GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED)", "Bad Request", 400)
    expect(groupJoinErrorCode(err)).toBe("GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED")
  })

  it("contract: ทุก conflict(CODE, ข้อความ) ใน join.ts ของ backend จับกลับเป็น code เดิมได้", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../../../backend/src/modules/group_buy/utils/join.ts"), "utf8")
    const found = Array.from(src.matchAll(/conflict\(\s*(\w+),\s*["`]([^"`]+)["`]/g), ([, code, message]) => ({
      code,
      message: message.replace(/\$\{[^}]+\}/g, "5"),
    }))
    expect(found.map((f) => f.code).sort()).toEqual(
      GROUP_JOIN_CODES.filter((c) => c !== "GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED").sort()
    )
    for (const { code, message } of found) {
      expect(groupJoinErrorCode(new FetchError(message, "Conflict", 409)), message).toBe(code)
    }
  })
})

// GB-7a2: server action join คืน `ActionResult` (CORE-4i) — แปลง error ฝั่ง server เป็น code แล้วฝั่ง client แปลงเป็นข้อความ
describe("groupJoinFailure + groupJoinActionMessage (GB-7a2)", () => {
  it("code ที่รู้จัก → code นั้น และข้อความเดียวกับ groupJoinErrorMessage", () => {
    const err = new FetchError("The group is full", "Conflict", 409)
    expect(groupJoinFailure(err)).toEqual({ error: "GB_GROUP_FULL" })
    expect(groupJoinActionMessage("GB_GROUP_FULL")).toBe("กลุ่มนี้เต็มแล้ว")
    expect(groupJoinActionMessage("GB_UNITS_LIMIT_EXCEEDED", { maxUnitsPerPerson: 3 })).toBe(
      "เกินจำนวนชิ้นสูงสุดต่อคน (3 ชิ้น)"
    )
  })

  it("401 → unauthorized; 400/403/404 → closed; อื่นๆ → failed", () => {
    expect(groupJoinFailure(new FetchError("Unauthorized", "Unauthorized", 401))).toEqual({ error: "unauthorized" })
    expect(groupJoinFailure({ status: 400, message: "The group is no longer open for joining" })).toEqual({ error: "closed" })
    expect(groupJoinFailure({ status: 403 })).toEqual({ error: "closed" })
    expect(groupJoinFailure({ status: 404 })).toEqual({ error: "closed" })
    expect(groupJoinFailure(new Error("network"))).toEqual({ error: "failed" })
    expect(groupJoinActionMessage("unauthorized")).toBe(SIGN_IN_AGAIN_MESSAGE)
    expect(groupJoinActionMessage("closed")).toBe("กลุ่มหรือแคมเปญนี้ปิดรับแล้ว")
    expect(groupJoinActionMessage("failed")).toBe("เข้าร่วมไม่สำเร็จ กรุณาลองใหม่")
  })

  // review: 400 "The cart has no items" (INVALID_DATA) ไม่ใช่ "ปิดรับแล้ว"
  it("400 The cart has no items → empty_cart ข้อความไทยของตัวเอง ไม่ซ้ำกับข้อความอื่น", () => {
    const err = new FetchError("The cart has no items.", "Bad Request", 400)
    expect(groupJoinFailure(err)).toEqual({ error: "empty_cart" })
    const text = groupJoinErrorMessage(err)
    expect(text).toMatch(THAI)
    expect(text).toBe(groupJoinActionMessage("empty_cart"))
    expect(text).not.toBe("กลุ่มหรือแคมเปญนี้ปิดรับแล้ว")
    expect(text).not.toBe("เข้าร่วมไม่สำเร็จ กรุณาลองใหม่")
  })

  it("ผลเป็น object ธรรมดา (ส่งข้าม boundary ของ server action ได้)", () => {
    expect(JSON.parse(JSON.stringify(groupJoinFailure(new FetchError("The group is full", "Conflict", 409))))).toEqual({
      error: "GB_GROUP_FULL",
    })
  })
})
