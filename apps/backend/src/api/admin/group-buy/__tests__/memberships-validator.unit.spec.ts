import { AdminListGroupBuyMemberships } from "../validators"

// GB-6c (spec 04 API, AC-34): limit int 1..100 ค่าเริ่มต้น 50, offset int ≥ 0 ค่าเริ่มต้น 0 (query string)
describe("AdminListGroupBuyMemberships", () => {
  it("defaults limit=50 offset=0", () => {
    expect(AdminListGroupBuyMemberships.parse({})).toEqual({ limit: 50, offset: 0 })
  })

  it("coerces query strings", () => {
    expect(AdminListGroupBuyMemberships.parse({ limit: "1", offset: "1" })).toEqual({ limit: 1, offset: 1 })
    expect(AdminListGroupBuyMemberships.parse({ limit: "100" }).limit).toBe(100)
  })

  it.each([
    { limit: "101" },
    { limit: "0" },
    { limit: "abc" },
    { limit: "1.5" },
    { offset: "-1" },
    { offset: "abc" },
  ])("rejects %p", (q) => {
    expect(AdminListGroupBuyMemberships.safeParse(q).success).toBe(false)
  })
})
