import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"

jest.setTimeout(120 * 1000)

type SeededPrice = { amount: number; currency_code: string }

// CORE-9 (spec 01 กฎข้อ 15, AC-27): หลัง seed + index สร้างเสร็จ ทุก hit ของ /store/search มีราคา THB ที่ seed
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let seededThb: Map<string, number>

    beforeAll(async () => {
      const container = getContainer()
      await seedThailand({ container, args: [] })

      // "index สร้างเสร็จ": สินค้าถูกสร้างหลังบูต จึงสั่ง reindex แล้วรอจนเสร็จ (ไม่พึ่ง event แบบ async)
      await container.resolve(Modules.SEARCH).reindex({ index: "product" })

      headers = { "x-publishable-api-key": await getPublishableKey(container) }

      // ราคา THB ที่ seed อ่านจาก price set ตรงๆ (ไม่ผ่าน pricing context แบบเดียวกับ index)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["handle", "variants.prices.amount", "variants.prices.currency_code"],
      })
      seededThb = new Map(
        products.map((p) => {
          const variants = (p.variants ?? []) as { prices?: SeededPrice[] | null }[]
          const amounts = variants.flatMap((v) =>
            (v.prices ?? [])
              .filter((price) => price.currency_code === "thb")
              .map((price) => Number(price.amount))
          )
          return [p.handle as string, Math.min(...amounts)]
        })
      )
    })

    it("AC-27: query ว่างแบบที่ instantsearch-adapter ส่ง → ทุก hit มี min_price_thb เท่าราคา THB ที่ seed", async () => {
      // body เดียวกับที่ @medusajs/instantsearch-adapter ส่ง (batch + additionalSearchParameters ของ storefront)
      const { status, data } = await api.post(
        "/store/search",
        {
          queries: [
            {
              entity: "product",
              pagination: { take: 12, skip: 0 },
              search_options: { match_strategy: "last" },
            },
          ],
        },
        { headers }
      )

      expect(status).toBe(200)
      // hit ของ /store/search = { id, document } (document = field ที่ retrievable ของ index)
      const docs = (data.results[0].hits as { document: Record<string, unknown> }[]).map(
        (hit) => hit.document
      )
      expect(seededThb.size).toBeGreaterThan(0)
      expect(docs.map((doc) => doc.handle).sort()).toEqual([...seededThb.keys()].sort())

      for (const doc of docs) {
        const expected = seededThb.get(doc.handle as string)
        expect(typeof expected).toBe("number")
        expect(doc.min_price_thb).toBe(expected)
        expect(Object.keys(doc).filter((k) => /_(eur|usd)$/.test(k))).toEqual([])
      }
    })
  },
})
