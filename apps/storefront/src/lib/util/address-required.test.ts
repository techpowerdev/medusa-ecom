import { describe, expect, it } from "vitest"

import { MISSING_ADDRESS_MESSAGE, REQUIRED_ADDRESS_FIELDS, missingRequiredAddress } from "./address-required"
import { trimInvisible } from "./trim-invisible"

// SFUI-18c (spec 09 กฎ 55, AC-53; Q-R49-4 owner: ตำบลบังคับกรอก): ตำบล/แขวง (address_2) เป็นช่องบังคับของที่อยู่ทั้ง checkout และหน้าบัญชี
describe("address-required", () => {
  const full = {
    first_name: "สมหญิง",
    last_name: "รักไทย",
    address_1: "99/1 หมู่ 2",
    address_2: "คลองเตยเหนือ",
    city: "วัฒนา",
    postal_code: "10110",
  }

  it("REQUIRED_ADDRESS_FIELDS มี address_2", () => {
    expect(REQUIRED_ADDRESS_FIELDS).toContain("address_2")
  })

  it("ครบทุกช่อง → ไม่ missing", () => {
    expect(missingRequiredAddress(full)).toBe(false)
  })

  it.each([
    ["ว่าง", ""],
    ["null", null],
    ["ช่องว่าง/zero-width ล้วน (หลัง trimInvisible ของผู้เรียก)", trimInvisible(" ​⁠ ")],
  ])("address_2 %s → missing", (_case, value) => {
    expect(missingRequiredAddress({ ...full, address_2: value })).toBe(true)
  })

  it("ไม่มี key address_2 → missing", () => {
    const { address_2: _omit, ...rest } = full
    expect(missingRequiredAddress(rest)).toBe(true)
  })

  it("ข้อความ MISSING_ADDRESS_MESSAGE ตามกฎ 55", () => {
    expect(MISSING_ADDRESS_MESSAGE).toBe(
      "กรุณากรอกชื่อ นามสกุล ที่อยู่ ตำบล/แขวง เขต/อำเภอ และรหัสไปรษณีย์ให้ครบ (ช่องที่มีแต่ช่องว่างถือว่ายังไม่ได้กรอก)"
    )
  })
})
