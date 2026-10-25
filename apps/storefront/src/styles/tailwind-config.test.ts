import { describe, expect, it } from "vitest"
import tailwindConfig from "../../tailwind.config.js"

// spec 01 "CORE-4 Storefront i18n / theme / THB" business rule 3, AC-9
describe("tailwind.config.js — brand theme (AC-9)", () => {
  const extend = tailwindConfig.theme.extend as unknown as {
    colors: Record<string, Record<string, string>>
    fontFamily: { sans: string[] }
  }

  it("มีสีกลุ่ม brand ครบ DEFAULT และ 50..900", () => {
    const keys = [
      "DEFAULT",
      "50",
      "100",
      "200",
      "300",
      "400",
      "500",
      "600",
      "700",
      "800",
      "900",
    ]
    const brand = extend.colors.brand

    expect(brand).toBeDefined()
    for (const key of keys) {
      expect(brand[key], `brand.${key}`).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it("fontFamily.sans ตัวแรกคือ Noto Sans Thai (CSS variable จาก next/font)", () => {
    expect(extend.fontFamily.sans[0]).toBe("var(--font-noto-sans-thai)")
  })
})
