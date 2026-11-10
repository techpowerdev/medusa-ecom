import {
  EXCLUSIVITY_CODE_APPLIED_ATTRIBUTE,
  PROMOTION_NOT_COMBINABLE,
  exclusiveAutomaticRule,
  exclusivityPromotionContext,
  hasCompletionConflict,
  introducesGroupBuyConflict,
  isExclusiveAutomatic,
  isGroupBuyCode,
  resolvePromoCodes,
} from "../promotion-exclusivity"

// PROMO-1 (spec 03 กฎข้อ 6, ADR-009): helper pure สำหรับ exclusivity ระหว่าง flash / group buy / code อื่น
const pick = (path: string, obj: Record<string, unknown>) =>
  path.split(".").reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], obj)

describe("promotion exclusivity helpers", () => {
  it("exposes the context attribute and error code from ADR-009", () => {
    expect(EXCLUSIVITY_CODE_APPLIED_ATTRIBUTE).toEqual("exclusivity.code_applied")
    expect(PROMOTION_NOT_COMBINABLE).toEqual("PROMOTION_NOT_COMBINABLE")
  })

  describe("exclusiveAutomaticRule", () => {
    it("returns the 'ne true' rule on the exclusivity attribute", () => {
      expect(exclusiveAutomaticRule()).toEqual({
        attribute: "exclusivity.code_applied",
        operator: "ne",
        values: ["true"],
      })
    })

    it("returns a fresh object each call", () => {
      const rule = exclusiveAutomaticRule()
      rule.values.push("x")
      expect(exclusiveAutomaticRule().values).toEqual(["true"])
    })
  })

  describe("isExclusiveAutomatic", () => {
    const ruleFromQuery = {
      attribute: "exclusivity.code_applied",
      operator: "ne",
      values: [{ value: "true" }],
    }

    it("is true for an automatic promotion with the rule (query shape)", () => {
      expect(isExclusiveAutomatic({ is_automatic: true, rules: [ruleFromQuery] })).toBe(true)
    })

    it("is true for an automatic promotion with the rule (helper shape)", () => {
      expect(isExclusiveAutomatic({ is_automatic: true, rules: [exclusiveAutomaticRule()] })).toBe(
        true
      )
    })

    it("is true when the rule sits among other rules", () => {
      expect(
        isExclusiveAutomatic({
          is_automatic: true,
          rules: [{ attribute: "region_id", operator: "eq", values: [{ value: "reg_1" }] }, ruleFromQuery],
        })
      ).toBe(true)
    })

    it("is false for an automatic promotion without the rule", () => {
      expect(isExclusiveAutomatic({ is_automatic: true, rules: [] })).toBe(false)
      expect(isExclusiveAutomatic({ is_automatic: true })).toBe(false)
    })

    it("is false for a code promotion even with the rule", () => {
      expect(isExclusiveAutomatic({ is_automatic: false, rules: [ruleFromQuery] })).toBe(false)
    })

    it("is false when the rule uses another operator or value", () => {
      expect(
        isExclusiveAutomatic({ is_automatic: true, rules: [{ ...ruleFromQuery, operator: "eq" }] })
      ).toBe(false)
      expect(
        isExclusiveAutomatic({
          is_automatic: true,
          rules: [{ ...ruleFromQuery, values: [{ value: "false" }] }],
        })
      ).toBe(false)
    })
  })

  describe("isGroupBuyCode", () => {
    it("matches the GB- prefix only", () => {
      expect(isGroupBuyCode("GB-abc123")).toBe(true)
      expect(isGroupBuyCode("SAVE10")).toBe(false)
      expect(isGroupBuyCode("XGB-1")).toBe(false)
    })
  })

  describe("resolvePromoCodes", () => {
    it("add: unions existing and input codes without duplicates", () => {
      expect(resolvePromoCodes({ existing: ["F"], input: ["SAVE10", "F"], action: "add" })).toEqual([
        "F",
        "SAVE10",
      ])
    })

    it("defaults to add", () => {
      expect(resolvePromoCodes({ existing: ["A"], input: ["B"] })).toEqual(["A", "B"])
    })

    it("remove: drops input codes from existing", () => {
      expect(
        resolvePromoCodes({ existing: ["SAVE10", "F"], input: ["SAVE10"], action: "remove" })
      ).toEqual(["F"])
    })

    it("replace: keeps only input codes", () => {
      expect(resolvePromoCodes({ existing: ["SAVE10"], input: ["F"], action: "replace" })).toEqual([
        "F",
      ])
      expect(resolvePromoCodes({ existing: ["SAVE10"], input: [], action: "replace" })).toEqual([])
    })
  })

  describe("exclusivityPromotionContext", () => {
    it("sets the attribute to 'true' when a code is applied", () => {
      const ctx = exclusivityPromotionContext(true)
      expect(pick(EXCLUSIVITY_CODE_APPLIED_ATTRIBUTE, ctx)).toEqual("true")
    })

    it("sets the attribute to 'false' (never empty) when no code is applied", () => {
      const ctx = exclusivityPromotionContext(false)
      expect(pick(EXCLUSIVITY_CODE_APPLIED_ATTRIBUTE, ctx)).toEqual("false")
    })
  })

  describe("introducesGroupBuyConflict", () => {
    it("rejects adding another code to a GB cart", () => {
      expect(
        introducesGroupBuyConflict({ existing: ["GB-1"], resultingManualCodes: ["GB-1", "SAVE10"] })
      ).toBe(true)
    })

    it("rejects adding a GB code to a cart with another code", () => {
      expect(
        introducesGroupBuyConflict({ existing: ["SAVE10"], resultingManualCodes: ["SAVE10", "GB-1"] })
      ).toBe(true)
    })

    it("rejects two GB codes", () => {
      expect(
        introducesGroupBuyConflict({ existing: [], resultingManualCodes: ["GB-1", "GB-2"] })
      ).toBe(true)
    })

    it("allows a GB code alone or with automatic promotions only", () => {
      expect(introducesGroupBuyConflict({ existing: ["F"], resultingManualCodes: ["GB-1"] })).toBe(false)
    })

    it("allows non-GB codes together (Medusa default stacking)", () => {
      expect(
        introducesGroupBuyConflict({ existing: ["A"], resultingManualCodes: ["A", "SAVE10"] })
      ).toBe(false)
    })

    it("does not reject a refresh that introduces no new code", () => {
      expect(
        introducesGroupBuyConflict({
          existing: ["GB-1", "SAVE10"],
          resultingManualCodes: ["GB-1", "SAVE10"],
        })
      ).toBe(false)
    })
  })

  describe("hasCompletionConflict", () => {
    const F = {
      code: "FLASH",
      is_automatic: true,
      rules: [{ attribute: "exclusivity.code_applied", operator: "ne", values: [{ value: "true" }] }],
    }
    const N = { code: "AUTO", is_automatic: true, rules: [] }
    const SAVE10 = { code: "SAVE10", is_automatic: false, rules: [] }
    const GB = { code: "GB-1", is_automatic: false, rules: [] }
    const OTHER = { code: "OTHER", is_automatic: false, rules: [] }

    it("flags an exclusive automatic promotion together with any code", () => {
      expect(hasCompletionConflict([F, SAVE10])).toBe(true)
      expect(hasCompletionConflict([F, GB])).toBe(true)
    })

    it("flags GB together with another code", () => {
      expect(hasCompletionConflict([GB, SAVE10])).toBe(true)
    })

    it("allows valid combinations", () => {
      expect(hasCompletionConflict([F])).toBe(false)
      expect(hasCompletionConflict([F, N])).toBe(false)
      expect(hasCompletionConflict([N, SAVE10])).toBe(false)
      expect(hasCompletionConflict([SAVE10, OTHER])).toBe(false)
      expect(hasCompletionConflict([GB, N])).toBe(false)
      expect(hasCompletionConflict([])).toBe(false)
    })
  })
})
