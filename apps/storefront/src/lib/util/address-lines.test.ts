import { describe, expect, it } from "vitest"

import { addressLines } from "./address-lines"

// SFUI-18a (spec 09 กฎ 57, AC-50): สรุปที่อยู่ตามลำดับไทย — บ้านเลขที่… ตำบล/แขวง เขต/อำเภอ จังหวัด รหัสไปรษณีย์ แล้วบรรทัดประเทศ
describe("addressLines", () => {
  const full = {
    address_1: "99/1 หมู่ 2 ซ.สุขุมวิท 3 ถ.สุขุมวิท",
    address_2: "คลองเตยเหนือ",
    city: "วัฒนา",
    province: "กรุงเทพมหานคร",
    postal_code: "10110",
    country_code: "th",
  }

  it("ครบทุกช่อง → ลำดับไทยคั่นด้วยช่องว่างเดียว และบรรทัดประเทศเป็นรหัสตัวใหญ่", () => {
    expect(addressLines(full)).toEqual([
      "99/1 หมู่ 2 ซ.สุขุมวิท 3 ถ.สุขุมวิท คลองเตยเหนือ วัฒนา กรุงเทพมหานคร 10110",
      "TH",
    ])
  })

  it("ข้ามช่องว่าง/null/ช่องว่างล้วน — ไม่มีจุลภาคหรือช่องว่างซ้อน", () => {
    const [line] = addressLines({ ...full, address_2: null, province: "  ", city: "" })
    expect(line).toBe("99/1 หมู่ 2 ซ.สุขุมวิท 3 ถ.สุขุมวิท 10110")
    expect(line).not.toMatch(/,|\s{2}|^\s|\s$/)
  })

  it("ที่อยู่เดิมที่ไม่มี address_2 (ก่อนรอบ 49) แสดงได้", () => {
    expect(addressLines({ address_1: "11 ถนนพระราม 4", city: "วัฒนา", postal_code: "10110", country_code: "th" })).toEqual([
      "11 ถนนพระราม 4 วัฒนา 10110",
      "TH",
    ])
  })

  it("ไม่มีที่อยู่ → บรรทัดว่างทั้งสอง", () => {
    expect(addressLines(null)).toEqual(["", ""])
    expect(addressLines(undefined)).toEqual(["", ""])
    expect(addressLines({})).toEqual(["", ""])
  })
})
