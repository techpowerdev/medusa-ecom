import { describe, expect, it } from "vitest"

import { addressLines } from "./address-lines"

// SFUI-18a (spec 09 กฎ 57, AC-50): สรุปที่อยู่ตามลำดับไทย — บ้านเลขที่… ตำบล/แขวง เขต/อำเภอ จังหวัด รหัสไปรษณีย์
// SFUI-20c (กฎ 71, AC-64 — owner: ซ่อนบรรทัดประเทศ): ไม่มีบรรทัดประเทศ; ทุกช่องว่าง → []
describe("addressLines", () => {
  const full = {
    address_1: "99/1 หมู่ 2 ซ.สุขุมวิท 3 ถ.สุขุมวิท",
    address_2: "คลองเตยเหนือ",
    city: "วัฒนา",
    province: "กรุงเทพมหานคร",
    postal_code: "10110",
    country_code: "th",
  }

  it("ครบทุกช่อง → บรรทัดเดียวตามลำดับไทยคั่นด้วยช่องว่างเดียว ไม่มีบรรทัดประเทศ", () => {
    expect(addressLines(full)).toEqual(["99/1 หมู่ 2 ซ.สุขุมวิท 3 ถ.สุขุมวิท คลองเตยเหนือ วัฒนา กรุงเทพมหานคร 10110"])
    expect(addressLines(full).join(" ")).not.toMatch(/\bTH\b|Thailand|ประเทศไทย/)
  })

  it("ข้ามช่องว่าง/null/ช่องว่างล้วน — ไม่มีจุลภาคหรือช่องว่างซ้อน", () => {
    const [line] = addressLines({ ...full, address_2: null, province: "  ", city: "" })
    expect(line).toBe("99/1 หมู่ 2 ซ.สุขุมวิท 3 ถ.สุขุมวิท 10110")
    expect(line).not.toMatch(/,|\s{2}|^\s|\s$/)
  })

  it("ที่อยู่เดิมที่ไม่มี address_2 (ก่อนรอบ 49) แสดงได้", () => {
    expect(addressLines({ address_1: "11 ถนนพระราม 4", city: "วัฒนา", postal_code: "10110", country_code: "th" })).toEqual([
      "11 ถนนพระราม 4 วัฒนา 10110",
    ])
  })

  it("ไม่มีที่อยู่ / มีแต่ประเทศ → []", () => {
    expect(addressLines(null)).toEqual([])
    expect(addressLines(undefined)).toEqual([])
    expect(addressLines({})).toEqual([])
    expect(addressLines({ country_code: "th", address_1: "  " })).toEqual([])
  })
})
