import {
  FLASH_SALE_PARSE_OPTIONS,
  POSITIVE_INT_MESSAGE,
  flashSaleFormSchema,
  optionalPositiveInt,
  toFlashSaleFormValues,
} from "../flash-sale-form"

// ADM-3 (spec 08 AC-6, กฎ 8): ช่องจำนวนเต็มบวกที่ว่างได้ = optionalInt ของ dashboard + refine (≥ 1) + transform ("" → null)
describe("optionalPositiveInt", () => {
  it.each([
    ["", null],
    [undefined, null],
    ["2", 2],
    [3, 3],
  ])("%p → %p", (input, expected) => {
    const parsed = optionalPositiveInt.safeParse(input)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toBe(expected)
  })

  it.each(["0", "1.5", "abc", "-1"])("%p → error", (input) => {
    expect(optionalPositiveInt.safeParse(input).success).toBe(false)
  })
})

describe("flashSaleFormSchema", () => {
  const values = {
    per_customer_limit: "2",
    total_cap: "",
    show_countdown: true,
    show_remaining: false,
    banner_text: "  ",
  }

  it("แปลงค่าฟอร์มเป็น body ของ POST .../config", () => {
    expect(flashSaleFormSchema.parse(values, FLASH_SALE_PARSE_OPTIONS)).toEqual({
      per_customer_limit: 2,
      total_cap: null,
      show_countdown: true,
      show_remaining: false,
      banner_text: null,
    })
  })

  it("คง banner_text ที่ไม่ว่างไว้ตามที่กรอก", () => {
    expect(flashSaleFormSchema.parse({ ...values, banner_text: "Hot deal" }).banner_text).toBe("Hot deal")
  })

  it.each(["0", "1.5", "abc"])("total_cap %p → error ที่ช่อง total_cap พร้อมข้อความภาษาอังกฤษ", (total_cap) => {
    const parsed = flashSaleFormSchema.safeParse({ ...values, total_cap }, FLASH_SALE_PARSE_OPTIONS)
    expect(parsed.success).toBe(false)
    // "abc" ล้มหลาย refine ของ optionalInt — react-hook-form แสดง issue แรกของช่อง
    expect(parsed.error!.issues.length).toBeGreaterThanOrEqual(1)
    for (const issue of parsed.error!.issues) {
      expect(issue.path).toEqual(["total_cap"])
      expect(issue.message).toBe(POSITIVE_INT_MESSAGE)
    }
  })
})

describe("toFlashSaleFormValues", () => {
  it("ไม่มี config → ค่าว่าง", () => {
    expect(toFlashSaleFormValues(null)).toEqual({
      per_customer_limit: "",
      total_cap: "",
      show_countdown: false,
      show_remaining: false,
      banner_text: "",
    })
  })

  it("config ที่บันทึกแล้ว → ค่าในฟอร์ม (null = ว่าง)", () => {
    expect(
      toFlashSaleFormValues({
        per_customer_limit: 2,
        total_cap: null,
        show_countdown: true,
        show_remaining: true,
        banner_text: "Hot",
      })
    ).toEqual({
      per_customer_limit: "2",
      total_cap: "",
      show_countdown: true,
      show_remaining: true,
      banner_text: "Hot",
    })
  })
})
