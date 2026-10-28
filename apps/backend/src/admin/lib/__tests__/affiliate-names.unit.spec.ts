import { AdminListAffiliates } from "../../../api/admin/affiliate/validators"
import { affiliateNamesQuery, withAffiliateNames } from "../affiliate-names"

// AF-14 (spec 05 กฎ 38, AC-45): ดึงชื่อ/อีเมล affiliate ของแถวในหน้าปัจจุบันด้วย request เดียว
describe("affiliateNamesQuery", () => {
  it("collects unique affiliate ids of the page into one id[] query sized to the ids", () => {
    const query = affiliateNamesQuery([
      { affiliate_id: "aff_b" },
      { affiliate_id: "aff_a" },
      { affiliate_id: "aff_b" },
    ])
    expect(query).toEqual({ id: ["aff_a", "aff_b"], limit: 2, offset: 0, fields: "id,name,email" })
    // backend รับ query นี้ได้ (validator ของ AF-14)
    expect(AdminListAffiliates.safeParse(query).success).toBe(true)
  })

  it("is null for an empty page (no request)", () => {
    expect(affiliateNamesQuery([])).toBeNull()
  })
})

describe("withAffiliateNames", () => {
  it("attaches name and email by affiliate_id and leaves unknown ids without them", () => {
    const rows = [
      { id: "1", affiliate_id: "aff_a" },
      { id: "2", affiliate_id: "aff_gone" },
    ]
    expect(withAffiliateNames(rows, [{ id: "aff_a", name: "Ann", email: "ann@example.com" }])).toEqual([
      { id: "1", affiliate_id: "aff_a", affiliate: { name: "Ann", email: "ann@example.com" } },
      { id: "2", affiliate_id: "aff_gone" },
    ])
  })

  it("returns the rows unchanged while names are not loaded", () => {
    const rows = [{ id: "1", affiliate_id: "aff_a" }]
    expect(withAffiliateNames(rows, undefined)).toBe(rows)
  })
})
