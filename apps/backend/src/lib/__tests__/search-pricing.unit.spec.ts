import fs from "node:fs"
import path from "node:path"
// test อยู่นอก src/search/ เพราะ Medusa โหลดทุกไฟล์ใน src/search/ เป็น search index
import { PRICE_CURRENCIES, priceFields, toProductPricing } from "../../search/helpers/pricing"

// กฎข้อ 15: สองฝั่งต้องเท่ากัน — อ่านค่าจากไฟล์ของ storefront (นอก rootDir ของ backend จึง import ไม่ได้)
const STOREFRONT_SEARCH_CLIENT = path.resolve(
  __dirname,
  "../../../../storefront/src/lib/search-client.ts"
)
const storefrontCurrencies = (): string[] => {
  const source = fs.readFileSync(STOREFRONT_SEARCH_CLIENT, "utf8")
  const match = source.match(/SEARCH_PRICE_CURRENCIES\s*=\s*\[([^\]]*)\]/)
  if (!match) throw new Error(`ไม่พบ SEARCH_PRICE_CURRENCIES ใน ${STOREFRONT_SEARCH_CLIENT}`)
  return [...match[1].matchAll(/["']([a-z]{3})["']/g)].map((m) => m[1])
}

const variant = (amount: number) => ({
  calculated_price: { calculated_amount: amount, original_amount: amount },
})

// CORE-9 (spec 01 กฎข้อ 15, AC-26): search index เก็บราคาเฉพาะ THB
describe("search pricing (CORE-9)", () => {
  it("PRICE_CURRENCIES เป็น ['thb'] และเท่ากับ SEARCH_PRICE_CURRENCIES ของ storefront", () => {
    expect([...PRICE_CURRENCIES]).toEqual(["thb"])
    expect([...PRICE_CURRENCIES]).toEqual(storefrontCurrencies())
  })

  it("schema ของ index มีเฉพาะ field ราคา _thb", () => {
    expect(Object.keys(priceFields).sort()).toEqual([
      "max_price_thb",
      "min_price_thb",
      "on_sale_thb",
      "original_price_thb",
    ])
  })

  it("toProductPricing ได้ min/max/original/on_sale ของ THB และไม่มี field _eur/_usd", () => {
    const pricing = toProductPricing({
      thb: [variant(590), variant(990)],
    } as Parameters<typeof toProductPricing>[0])

    expect(pricing).toEqual({
      min_price_thb: 590,
      max_price_thb: 990,
      original_price_thb: 590,
      on_sale_thb: false,
    })
    expect(Object.keys(pricing).filter((k) => /_(eur|usd)$/.test(k))).toEqual([])
  })
})
