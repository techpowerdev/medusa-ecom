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
