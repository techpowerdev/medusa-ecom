import {
  buildGroupPromotionInput,
  generateJoinToken,
  type TemplatePromotion,
} from "../utils/group-promotion"

const template: TemplatePromotion = {
  id: "promo_template",
  code: "GBT-ABCDEFGHJKLM",
  status: "draft",
  is_automatic: false,
  is_tax_inclusive: true,
  campaign_id: "camp_1",
  application_method: {
    type: "percentage",
    target_type: "items",
    allocation: "each",
    value: 30,
    currency_code: null,
    max_quantity: 10,
    apply_to_quantity: null,
    buy_rules_min_quantity: null,
    target_rules: [
      { attribute: "items.product.id", operator: "in", values: [{ value: "prod_x" }, { value: "prod_z" }] },
    ],
  },
  rules: [{ attribute: "customer.groups.id", operator: "eq", values: [{ value: "cusgroup_vip" }] }],
}

// ADR-011 ข้อ 2 + spec 04 createGroupWorkflow ขั้น 4 (AC-20b): clone ต้นแบบ → GB-<token> status=active
describe("buildGroupPromotionInput", () => {
  it("clones the template as an active, code-based GB-<token> promotion in the same campaign", () => {
    expect(buildGroupPromotionInput(template, "TOKEN123", "camp_1")).toEqual({
      code: "GB-TOKEN123",
      type: "standard",
      status: "active",
      is_automatic: false,
      is_tax_inclusive: true,
      campaign_id: "camp_1",
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "each",
        value: 30,
        max_quantity: 10,
        target_rules: [
          { attribute: "items.product.id", operator: "in", values: ["prod_x", "prod_z"] },
        ],
      },
      rules: [{ attribute: "customer.groups.id", operator: "eq", values: ["cusgroup_vip"] }],
    })
  })

  it("keeps currency_code for a fixed discount and copies empty rule lists", () => {
    const fixed = buildGroupPromotionInput(
      {
        ...template,
        is_tax_inclusive: false,
        application_method: {
          ...template.application_method,
          type: "fixed",
          value: 100,
          currency_code: "thb",
          max_quantity: null,
          target_rules: [],
        },
        rules: [],
      },
      "T",
      "camp_1"
    )
    expect(fixed.application_method).toEqual({
      type: "fixed",
      target_type: "items",
      allocation: "each",
      value: 100,
      currency_code: "thb",
      max_quantity: null,
      target_rules: [],
    })
    expect(fixed.rules).toEqual([])
    expect(fixed.is_tax_inclusive).toBe(false)
  })

  // GB-26 (spec 04 กฎข้อ 51b, AC-69b, ADR-026 ภาคผนวก): link group_buy_campaign.campaign เป็น source of truth
  it("uses the campaign id passed in (from the link) even when template.campaign_id differs", () => {
    expect(buildGroupPromotionInput(template, "X", "camp_link").campaign_id).toEqual("camp_link")
  })

  it("never reuses the template code or status", () => {
    const input = buildGroupPromotionInput(template, "X", "camp_1")
    expect(input.code).not.toEqual(template.code)
    expect(input.status).toEqual("active")
  })
})

// spec 04 createGroupWorkflow ขั้น 3: join_token unique สุ่ม URL-safe
describe("generateJoinToken", () => {
  it("is URL-safe upper-case alphanumerics of length 12", () => {
    const token = generateJoinToken()
    expect(token).toMatch(/^[A-Z0-9]{12}$/)
    expect(encodeURIComponent(token)).toEqual(token)
  })

  it("is random across calls", () => {
    expect(new Set(Array.from({ length: 200 }, generateJoinToken)).size).toEqual(200)
  })
})
