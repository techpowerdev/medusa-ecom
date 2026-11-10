import { AdminCreateGroupBuyCampaign } from "../validators"

// GB-2c (spec 04 กฎข้อ 12, AC-20c): ต้นแบบ is_tax_inclusive ค่าเริ่มต้น true เพราะราคา THB รวม VAT
const body = (extra: Record<string, unknown> = {}) => ({
  name: "GB 11.11",
  target_type: "orders",
  target_value: 3,
  group_mode: "both",
  ends_at: "2026-11-11T00:00:00.000Z",
  application_method: {
    type: "fixed",
    target_type: "items",
    allocation: "each",
    max_quantity: 1,
    value: 100,
    currency_code: "thb",
    // GB-6e (กฎข้อ 30): 1 แคมเปญ = 1 สินค้า
    target_rules: [{ attribute: "items.product.id", operator: "in", values: ["prod_a"] }],
  },
  ...extra,
})

describe("AdminCreateGroupBuyCampaign — is_tax_inclusive", () => {
  it("defaults to true when not sent", () => {
    expect(AdminCreateGroupBuyCampaign.parse(body()).is_tax_inclusive).toBe(true)
  })

  it.each([true, false])("keeps an explicit %s", (value) => {
    expect(AdminCreateGroupBuyCampaign.parse(body({ is_tax_inclusive: value })).is_tax_inclusive).toBe(
      value
    )
  })

  it.each(["true", 1, null])("rejects a non-boolean (%p)", (value) => {
    expect(AdminCreateGroupBuyCampaign.safeParse(body({ is_tax_inclusive: value })).success).toBe(false)
  })
})

// GB-6e (spec 04 กฎข้อ 30a, AC-49): validator ปฏิเสธ scope ที่ไม่ใช่สินค้าเดียว ด้วยข้อความที่มี code
describe("AdminCreateGroupBuyCampaign — single product (GB-6e)", () => {
  const withRules = (target_rules?: unknown[]) => {
    const b = body()
    return { ...b, application_method: { ...b.application_method, target_rules } }
  }

  it.each([
    ["two products", [{ attribute: "items.product.id", operator: "in", values: ["prod_a", "prod_b"] }]],
    ["empty values", [{ attribute: "items.product.id", operator: "in", values: [] }]],
    ["no target rules", undefined],
    ["a variant scope", [{ attribute: "items.variant_id", operator: "in", values: ["variant_a"] }]],
  ])("rejects %s with GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED", (_, rules) => {
    const result = AdminCreateGroupBuyCampaign.safeParse(withRules(rules))
    expect(result.success).toBe(false)
    expect(JSON.stringify(result.error?.issues)).toContain("GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED")
  })
})
