import { storeOwnershipMiddlewares } from "../middlewares"
import { rejectStoreReturnOverrides } from "../return-overrides"
import { storeReturnOptionRuleError, validateStoreReturnShippingOption } from "../return-shipping-option"

// CORE-17 (owner 2026-10-26): option ของ POST /store/returns ต้องมี rule is_return = "true" (เหมือนที่ admin dashboard
// ของ Medusa ใช้คัด return option) และ enabled_in_store = "true" (context ที่ store flow ของ Medusa ใช้)
const rule = (attribute: string, value: string, operator = "eq") => ({ attribute, value, operator })

describe("storeReturnOptionRuleError", () => {
  it("accepts an option whose rules mark it as a return option enabled in store", () => {
    expect(storeReturnOptionRuleError([rule("enabled_in_store", "true"), rule("is_return", "true")])).toBeNull()
  })

  it("rejects an outbound option or an option without the is_return rule", () => {
    expect(storeReturnOptionRuleError([rule("enabled_in_store", "true"), rule("is_return", "false")])).toMatch(
      /not a return/i
    )
    expect(storeReturnOptionRuleError([rule("enabled_in_store", "true")])).toMatch(/not a return/i)
    expect(storeReturnOptionRuleError([])).toMatch(/not a return/i)
    expect(
      storeReturnOptionRuleError([rule("enabled_in_store", "true"), rule("is_return", "true"), rule("is_return", "true", "ne")])
    ).toMatch(/not a return/i)
  })

  it("rejects a return option that is disabled in store or has no enabled_in_store rule", () => {
    expect(storeReturnOptionRuleError([rule("enabled_in_store", "false"), rule("is_return", "true")])).toMatch(
      /not available in store/i
    )
    expect(storeReturnOptionRuleError([rule("is_return", "true")])).toMatch(/not available in store/i)
  })
})

describe("POST /store/returns middleware order", () => {
  it("runs the option check after the CORE-16 override check", () => {
    const entry = storeOwnershipMiddlewares.find((m) => m.matcher === "/store/returns")!
    const chain = entry.middlewares!
    expect(chain.indexOf(validateStoreReturnShippingOption)).toBe(chain.indexOf(rejectStoreReturnOverrides) + 1)
    expect(chain[chain.length - 1]).toBe(validateStoreReturnShippingOption)
  })
})
