import { describe, expect, it } from "vitest"

import { fieldErrorMessage, type FieldValidity } from "./field-validation"

// SFUI-11b (spec 09 กฎ 32b, AC-30): ข้อความ error ระดับช่องจาก ValidityState ของ validation native
const THAI = /[฀-๿]/
const ok: FieldValidity = { valid: true, valueMissing: false, typeMismatch: false, patternMismatch: false }
const bad = (key: keyof Omit<FieldValidity, "valid">): FieldValidity => ({ ...ok, valid: false, [key]: true })
const other: FieldValidity = { ...ok, valid: false }

describe("fieldErrorMessage (กฎ 32b)", () => {
  it.each([
    ["valueMissing ของ input", bad("valueMissing"), { label: "อีเมล" }, "กรุณากรอกอีเมล"],
    ["valueMissing ของ select", bad("valueMissing"), { label: "ประเทศ", control: "select" as const }, "กรุณาเลือกประเทศ"],
    ["typeMismatch มี title", bad("typeMismatch"), { label: "อีเมล", title: "กรุณากรอกอีเมลให้ถูกต้อง" }, "กรุณากรอกอีเมลให้ถูกต้อง"],
    ["typeMismatch ไม่มี title", bad("typeMismatch"), { label: "อีเมล" }, "กรุณากรอกอีเมลให้ถูกต้อง"],
    ["patternMismatch มี title", bad("patternMismatch"), { label: "รหัสแนะนำ", title: "ใช้ตัวอักษร a-z ตัวเลข และขีด ยาว 3-32 ตัว" }, "ใช้ตัวอักษร a-z ตัวเลข และขีด ยาว 3-32 ตัว"],
    ["patternMismatch ไม่มี title", bad("patternMismatch"), { label: "รหัสแนะนำ" }, "รูปแบบรหัสแนะนำไม่ถูกต้อง"],
    ["กิ่งอื่น (เช่น tooShort)", other, { label: "รหัสผ่าน" }, "รหัสผ่านไม่ถูกต้อง"],
    ["title ว่างถือว่าไม่มี", bad("typeMismatch"), { label: "อีเมล", title: "" }, "กรุณากรอกอีเมลให้ถูกต้อง"],
  ])("%s", (_name, validity, options, expected) => {
    const message = fieldErrorMessage(validity, options)
    expect(message).toBe(expected)
    expect(message).toMatch(THAI)
    expect(message).not.toContain("*")
  })

  it("valid → null", () => {
    expect(fieldErrorMessage(ok, { label: "อีเมล" })).toBeNull()
  })
})
