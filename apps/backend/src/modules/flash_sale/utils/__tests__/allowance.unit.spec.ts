import { customerAllowance } from "../allowance"

// FS-20 (spec 03 กฎข้อ 25, AC-27): สิทธิ์ flash ที่เหลือของลูกค้า — used = FlashSaleUsage.units ของ (campaign, customer) หรือ 0
describe("customerAllowance", () => {
  it("remaining = limit - used", () => {
    expect(customerAllowance(2, { units: 1 })).toEqual({
      per_customer_limit: 2,
      used_units: 1,
      remaining_for_customer: 1,
    })
  })

  it("no usage row counts as 0 used", () => {
    expect(customerAllowance(2, undefined)).toEqual({
      per_customer_limit: 2,
      used_units: 0,
      remaining_for_customer: 2,
    })
  })

  it("never goes below 0 (limit lowered after purchase)", () => {
    expect(customerAllowance(1, { units: 3 }).remaining_for_customer).toBe(0)
  })

  it("no limit → per_customer_limit and remaining are null, used is still reported", () => {
    expect(customerAllowance(null, { units: 4 })).toEqual({
      per_customer_limit: null,
      used_units: 4,
      remaining_for_customer: null,
    })
  })
})
