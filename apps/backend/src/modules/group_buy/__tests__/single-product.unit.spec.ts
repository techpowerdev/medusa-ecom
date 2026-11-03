import { MedusaError } from "@medusajs/framework/utils"
import { GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED } from "../errors"
import { assertSingleProductScope, type ScopeRule, singleProductIdOf } from "../utils/single-product"

const productRule = (values: ScopeRule["values"]) => ({ attribute: "items.product.id", operator: "in", values })

// spec 04 กฎข้อ 30 (GB-6e, AC-49): 1 แคมเปญ = 1 สินค้า — target_rules ต้องเป็น items.product.id in [ค่าเดียว]
describe("singleProductIdOf", () => {
  it.each([
    ["values เป็น array ของ string (body ของ API)", [productRule(["prod_A"])]],
    ["values เป็น string เดี่ยว (validator ของ Medusa รับได้)", [productRule("prod_A")]],
    ["values เป็น { value } (รูปที่อ่านผ่าน Query)", [productRule([{ value: "prod_A" }])]],
  ])("คืน product id เมื่อ %s", (_, rules) => {
    expect(singleProductIdOf(rules)).toEqual("prod_A")
  })

  it.each([
    ["ไม่มี target_rules", undefined],
    ["target_rules ว่าง", []],
    ["values ว่าง", [productRule([])]],
    ["values สองค่า", [productRule(["prod_A", "prod_B"])]],
    ["values สองค่าแบบ { value }", [productRule([{ value: "prod_A" }, { value: "prod_B" }])]],
    ["scope ระดับ variant", [{ attribute: "items.variant_id", operator: "in", values: ["variant_A"] }]],
    ["operator ไม่ใช่ in", [{ attribute: "items.product.id", operator: "eq", values: ["prod_A"] }]],
    ["values เป็น string ว่าง", [productRule([""])]],
    ["rule สินค้า + rule อื่นของ items", [productRule(["prod_A"]), { attribute: "items.variant_id", operator: "in", values: ["v"] }]],
    ["rule สินค้าสองข้อ", [productRule(["prod_A"]), productRule(["prod_B"])]],
  ])("คืน null เมื่อ %s", (_, rules) => {
    expect(singleProductIdOf(rules as never)).toBeNull()
  })
})

describe("assertSingleProductScope", () => {
  it("ผ่านเมื่อมีสินค้าเดียว", () => {
    expect(() => assertSingleProductScope([productRule(["prod_A"])], MedusaError.Types.INVALID_DATA)).not.toThrow()
  })

  it.each([MedusaError.Types.INVALID_DATA, MedusaError.Types.NOT_ALLOWED])(
    "throw MedusaError %s พร้อม code และข้อความที่มี code เมื่อไม่ใช่สินค้าเดียว",
    (type) => {
      let error: MedusaError | undefined
      try {
        assertSingleProductScope([productRule(["prod_A", "prod_B"])], type)
      } catch (e) {
        error = e as MedusaError
      }
      expect(error).toBeInstanceOf(MedusaError)
      expect(error).toEqual(expect.objectContaining({ type, code: GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED }))
      expect(error!.message).toContain(GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED)
    }
  )
})
