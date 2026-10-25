import { exclusiveAutomaticRule } from "../promotion-exclusivity"
import { promotionsMissingExclusivityRule } from "../flash-sale-exclusivity"

// FS-5 (spec 03 กฎข้อ 7): automatic promotion ของ flash campaign ที่ยังไม่มี exclusivity rule
describe("promotionsMissingExclusivityRule", () => {
  const ruleFromQuery = {
    attribute: "exclusivity.code_applied",
    operator: "ne",
    values: [{ value: "true" }],
  }

  it("returns automatic promotions without the exclusivity rule only", () => {
    const promotions = [
      { id: "p_auto_missing", code: "FLASH-A", is_automatic: true, rules: [] },
      { id: "p_auto_ok", code: "FLASH-B", is_automatic: true, rules: [ruleFromQuery] },
      { id: "p_auto_ok_input", code: "FLASH-C", is_automatic: true, rules: [exclusiveAutomaticRule()] },
      { id: "p_code", code: "SAVE10", is_automatic: false, rules: [] },
      {
        id: "p_auto_other_rule",
        code: "FLASH-D",
        is_automatic: true,
        rules: [{ attribute: "customer.groups.id", operator: "in", values: [{ value: "g1" }] }],
      },
    ]

    expect(promotionsMissingExclusivityRule(promotions).map((p) => p.id)).toEqual([
      "p_auto_missing",
      "p_auto_other_rule",
    ])
  })

  it("treats missing rules as no rule and tolerates null/undefined lists", () => {
    expect(
      promotionsMissingExclusivityRule([{ id: "p1", is_automatic: true, rules: null }]).map((p) => p.id)
    ).toEqual(["p1"])
    expect(promotionsMissingExclusivityRule(null)).toEqual([])
    expect(promotionsMissingExclusivityRule(undefined)).toEqual([])
  })
})
