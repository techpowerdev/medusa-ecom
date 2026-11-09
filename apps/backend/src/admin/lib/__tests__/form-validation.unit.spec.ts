import { POOL_FORM_DEFAULTS, POOL_PARSE_OPTIONS, poolFormSchema } from "../evoucher-pool-form"
import { FLASH_SALE_PARSE_OPTIONS, POSITIVE_INT_MESSAGE, flashSaleFormSchema, toFlashSaleFormValues } from "../flash-sale-form"
import { BAD_NUMBER_INPUT, numberInputValue } from "../form-validation"

// ADM-12 (spec 08 AC-16, กฎ 15): <input type="number"> ที่พิมพ์ "e"/"1e" ได้ value "" แต่ validity.badInput = true
// ค่าฟอร์มต้องไม่เป็น "ว่าง" (ไม่จำกัด / default) แต่เป็นค่าที่ schema ของช่องนั้นปฏิเสธด้วยข้อความเดิม
const input = (value: string, badInput: boolean) => ({ value, validity: { badInput } })

describe("numberInputValue", () => {
  it.each([
    ["", true, BAD_NUMBER_INPUT],
    ["", false, ""],
    ["12", false, "12"],
  ])("value %p, badInput %p → %p", (value, badInput, expected) => {
    expect(numberInputValue(input(value, badInput))).toBe(expected)
  })
})

describe("schema ปฏิเสธ BAD_NUMBER_INPUT ด้วยข้อความของช่อง", () => {
  const issuesOf = (parsed: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) => {
    expect(parsed.success).toBe(false)
    return Object.fromEntries(parsed.error!.issues.map((i) => [String(i.path[0]), i.message]))
  }

  it.each(["per_customer_limit", "total_cap"] as const)("flash sale %s", (name) => {
    const values = { ...toFlashSaleFormValues(null), [name]: BAD_NUMBER_INPUT }
    expect(issuesOf(flashSaleFormSchema.safeParse(values, FLASH_SALE_PARSE_OPTIONS))).toEqual({
      [name]: POSITIVE_INT_MESSAGE,
    })
  })

  it.each([
    ["face_value", "Must be a number of 0 or more"],
    ["low_stock_threshold", "Must be a whole number of 0 or more"],
  ])("pool %s", (name, message) => {
    const values = { ...POOL_FORM_DEFAULTS, partner_id: "p", name: "n", how_to_use: "h", [name]: BAD_NUMBER_INPUT }
    expect(issuesOf(poolFormSchema.safeParse(values, POOL_PARSE_OPTIONS))).toEqual({ [name]: message })
  })
})
