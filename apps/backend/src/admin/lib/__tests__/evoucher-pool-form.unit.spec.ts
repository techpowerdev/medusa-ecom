import {
  POOL_FORM_DEFAULTS,
  POOL_PARSE_OPTIONS,
  poolFormSchema,
} from "../evoucher-pool-form"

// ADM-3 (spec 08 AC-6, กฎ 8): ฟอร์ม Create pool บนหน้า variant — zod + optionalInt/optionalFloat ของ dashboard
describe("poolFormSchema", () => {
  const filled = {
    ...POOL_FORM_DEFAULTS,
    partner_id: "evpart_1",
    name: "  Starbucks 500  ",
    how_to_use: "Show the code at the counter",
  }

  const errorsOf = (input: unknown) => {
    const parsed = poolFormSchema.safeParse(input, POOL_PARSE_OPTIONS)
    expect(parsed.success).toBe(false)
    return Object.fromEntries(parsed.error!.issues.map((i) => [i.path.join("."), i.message]))
  }

  it("ค่าเริ่มต้น low_stock_threshold = 20", () => {
    expect(POOL_FORM_DEFAULTS.low_stock_threshold).toBe("20")
  })

  it("แปลงค่าฟอร์มเป็น body ของ createPool (ไม่รวม variant_id)", () => {
    expect(poolFormSchema.parse(filled, POOL_PARSE_OPTIONS)).toEqual({
      partner_id: "evpart_1",
      name: "Starbucks 500",
      how_to_use: "Show the code at the counter",
      face_value: null,
      validity_note: null,
      low_stock_threshold: 20,
    })
  })

  it("แปลง face_value/low_stock_threshold/validity_note ที่กรอก", () => {
    expect(
      poolFormSchema.parse(
        { ...filled, face_value: "499.5", low_stock_threshold: "0", validity_note: " 1 year " },
        POOL_PARSE_OPTIONS
      )
    ).toMatchObject({ face_value: 499.5, low_stock_threshold: 0, validity_note: "1 year" })
  })

  it("low_stock_threshold ว่าง → 20 (ค่าเดิมของฟอร์ม)", () => {
    expect(poolFormSchema.parse({ ...filled, low_stock_threshold: "" }).low_stock_threshold).toBe(20)
  })

  it("ไม่เลือก partner และไม่กรอกช่องบังคับ → error ที่ทุกช่องบังคับ", () => {
    expect(errorsOf(POOL_FORM_DEFAULTS)).toEqual({
      partner_id: "Select a partner",
      name: "Name is required",
      how_to_use: "How to use is required",
    })
  })

  it("name ที่มีแต่ช่องว่าง → error", () => {
    expect(errorsOf({ ...filled, name: "   " })).toEqual({ name: "Name is required" })
  })

  it.each(["-1", "abc"])("face_value %p → error", (face_value) => {
    expect(errorsOf({ ...filled, face_value })).toEqual({ face_value: "Must be a number of 0 or more" })
  })

  it.each(["-1", "1.5", "abc"])("low_stock_threshold %p → error", (low_stock_threshold) => {
    expect(errorsOf({ ...filled, low_stock_threshold })).toEqual({
      low_stock_threshold: "Must be a whole number of 0 or more",
    })
  })
})
