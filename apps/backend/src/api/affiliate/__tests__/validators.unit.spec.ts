import { PostAffiliateRegisterSchema } from "../validators"

// AF-21 / AC-53 (spec 05 กฎ 45 + กฎ 14 + Q4): code ที่เป็นคำสงวนสมัครไม่ได้ เทียบแบบไม่สนตัวพิมพ์
const RESERVED = ["admin", "affiliate", "store", "auth", "api", "app", "www", "support", "shop"]
const MESSAGE = "This referral code is reserved"

const issues = (code: string) => {
  const result = PostAffiliateRegisterSchema.safeParse({ name: "Ann", code })
  return { success: result.success, messages: result.success ? [] : result.error.issues.map((i) => i.message) }
}

describe("PostAffiliateRegisterSchema reserved codes (AF-21, rule 45)", () => {
  it.each(RESERVED)("rejects reserved code %p", (code) => {
    const { success, messages } = issues(code)

    expect(success).toBe(false)
    expect(messages).toContain(MESSAGE)
  })

  it.each(["ADMIN", "AdMin"])("rejects reserved code %p case-insensitively", (code) => {
    const { success, messages } = issues(code)

    expect(success).toBe(false)
    expect(messages).toContain(MESSAGE)
  })

  it.each(["admin1", "my-shop", "ann"])("accepts non-reserved code %p", (code) => {
    expect(issues(code).success).toBe(true)
  })
})
