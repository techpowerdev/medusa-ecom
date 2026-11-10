import { generateTemplateCode } from "../utils/template-code"

// ADR-011 ข้อ 1: code ต้นแบบ = "GBT-<random 12>" ห้ามขึ้นต้น "GB-" (กฎ GB-* ของ ADR-009) และเดาไม่ได้
describe("generateTemplateCode", () => {
  it("returns GBT- followed by 12 upper-case alphanumerics", () => {
    expect(generateTemplateCode()).toMatch(/^GBT-[A-Z0-9]{12}$/)
  })

  it("never starts with the group code prefix GB-", () => {
    expect(generateTemplateCode().startsWith("GB-")).toBe(false)
  })

  it("is random across calls", () => {
    const codes = new Set(Array.from({ length: 200 }, generateTemplateCode))
    expect(codes.size).toEqual(200)
  })
})
