import { describe, expect, it } from "vitest"
import { convertToLocale } from "./money"

// spec 01 "CORE-4 Storefront i18n / theme / THB" business rule 1, AC-7, AC-8
const LOCALES = ["th-TH", "en-US"] as const

describe("convertToLocale — THB", () => {
  describe("AC-7: 1000 THB แสดงเป็น ฿1,000", () => {
    it.each(LOCALES)("locale %s", (locale) => {
      expect(
        convertToLocale({ amount: 1000, currency_code: "thb", locale })
      ).toBe("฿1,000")
    })

    it("ไม่ระบุ locale (default th-TH)", () => {
      expect(convertToLocale({ amount: 1000, currency_code: "thb" })).toBe(
        "฿1,000"
      )
    })

    it("currency_code ไม่สนตัวพิมพ์ (THB)", () => {
      expect(convertToLocale({ amount: 1000, currency_code: "THB" })).toBe(
        "฿1,000"
      )
    })
  })

  describe("AC-8: ทศนิยมตามค่า", () => {
    const cases: Array<[number, string]> = [
      [1000.5, "฿1,000.50"],
      [0.1, "฿0.10"],
      [0, "฿0"],
      [-100, "-฿100"],
      [1234567.891, "฿1,234,567.89"],
      [999.999, "฿1,000"],
    ]

    for (const locale of LOCALES) {
      it.each(cases)(`${locale}: %s → %s`, (amount, expected) => {
        expect(convertToLocale({ amount, currency_code: "thb", locale })).toBe(
          expected
        )
      })
    }

    it.each(LOCALES)(
      "%s: maximumFractionDigits ของผู้เรียกไม่ถูก override",
      (locale) => {
        const expected = new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "thb",
          currencyDisplay: "narrowSymbol",
          maximumFractionDigits: 0,
        }).format(1000.5)

        expect(
          convertToLocale({
            amount: 1000.5,
            currency_code: "thb",
            locale,
            maximumFractionDigits: 0,
          })
        ).toBe(expected)
      }
    )
  })

  describe("สกุลเงินอื่นคงพฤติกรรมเดิม", () => {
    it("USD en-US", () => {
      expect(
        convertToLocale({ amount: 1000, currency_code: "usd", locale: "en-US" })
      ).toBe("$1,000.00")
    })

    it("ไม่มี currency_code → amount.toString()", () => {
      expect(convertToLocale({ amount: 12.5, currency_code: "" })).toBe("12.5")
    })
  })
})
