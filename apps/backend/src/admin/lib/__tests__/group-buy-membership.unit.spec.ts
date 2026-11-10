import { readFileSync } from "fs"
import { join } from "path"
import { canSetGroupOutcome, customerLabel, orderAdminPath } from "../group-buy-campaign"

// GB-6c (spec 04 Admin UI, AC-35)
describe("orderAdminPath", () => {
  it("links a draft order to the draft-orders page of the dashboard", () => {
    expect(orderAdminPath({ order_id: "order_1", order: { is_draft_order: true } })).toBe("/draft-orders/order_1")
  })

  it("links a converted order to the orders page", () => {
    expect(orderAdminPath({ order_id: "order_1", order: { is_draft_order: false } })).toBe("/orders/order_1")
  })
})

describe("canSetGroupOutcome", () => {
  it.each([
    ["open", true],
    ["succeeded", false],
    ["failed", false],
  ] as const)("%s → %s", (status, shown) => {
    expect(canSetGroupOutcome({ status })).toBe(shown)
  })
})

// review #114 nit 3: route คืน customer = null เมื่อไม่พบลูกค้า (เช่นถูกลบ)
describe("customerLabel", () => {
  it("shows the email when the customer exists", () => {
    expect(customerLabel({ customer_id: "cus_1", customer: { email: "a@example.com" } })).toBe("a@example.com")
  })

  it("falls back to the customer id when customer is null", () => {
    expect(customerLabel({ customer_id: "cus_1", customer: null })).toBe("cus_1 (deleted)")
  })
})

// GB-6d (กฎข้อ 23, AC-41): type Membership ของ admin ไม่ประกาศ field ที่ไม่ใช้ (order.total)
describe("Membership type", () => {
  it("does not declare the unused order.total", () => {
    const source = readFileSync(join(__dirname, "..", "group-buy.ts"), "utf8")
    const block = source.match(/export type Membership = \{[\s\S]*?\n\}/)?.[0]
    expect(block).toBeDefined()
    expect(block).not.toMatch(/\btotal\b/)
  })
})
