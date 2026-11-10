import { StoreListMyGroupBuyMemberships } from "../validators"

// GB-8 (spec 04 API รอบ 10, AC-38): limit int 1..100 ค่าเริ่มต้น 20, offset int ≥ 0 ค่าเริ่มต้น 0 (query string)
describe("StoreListMyGroupBuyMemberships", () => {
  it("defaults limit=20 offset=0", () => {
    expect(StoreListMyGroupBuyMemberships.parse({})).toEqual({
      limit: 20,
      offset: 0,
    })
  })

  it("coerces query strings", () => {
    expect(StoreListMyGroupBuyMemberships.parse({ limit: "1", offset: "1" })).toEqual({ limit: 1, offset: 1 })
    expect(StoreListMyGroupBuyMemberships.parse({ limit: "100" }).limit).toBe(100)
  })

  it.each([{ limit: "101" }, { limit: "0" }, { limit: "abc" }, { limit: "1.5" }, { offset: "-1" }, { offset: "abc" }])(
    "rejects %p",
    (q) => {
      expect(StoreListMyGroupBuyMemberships.safeParse(q).success).toBe(false)
    },
  )
})
