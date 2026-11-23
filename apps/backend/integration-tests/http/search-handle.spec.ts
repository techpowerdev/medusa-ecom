import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"

jest.setTimeout(120 * 1000)

// CORE-70 (spec 01 กฎข้อ 128, AC-169): ชื่อสินค้า seed เป็นภาษาไทย ("เสื้อยืด Medusa") คำ "shirt" อยู่ใน handle เท่านั้น
// `GET /store/products?q=` ของ Medusa ค้น handle ด้วย แต่ index เดิมไม่ค้น → drawer ค้น "shirt" ไม่เจอ (ทดสอบ manual เฟส 3a)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    it('AC-169: POST /store/search q "shirt" แบบที่ instantsearch-adapter ส่ง → ได้สินค้า seed handle t-shirt', async () => {
      const container = getContainer()
      await seedThailand({ container, args: [] })
      await container.resolve(Modules.SEARCH).reindex({ index: "product" })
      const headers = { "x-publishable-api-key": await getPublishableKey(container) }

      // body เดียวกับที่ @medusajs/instantsearch-adapter ส่ง (additionalSearchParameters ของ storefront)
      const { status, data } = await api.post(
        "/store/search",
        {
          queries: [
            {
              entity: "product",
              filters: { q: "shirt" },
              pagination: { take: 12, skip: 0 },
              search_options: { match_strategy: "last" },
            },
          ],
        },
        { headers }
      )

      expect(status).toBe(200)
      const handles = (data.results[0].hits as { document: { handle?: string } }[]).map(
        (hit) => hit.document.handle
      )
      expect(handles).toContain("t-shirt")
    })
  },
})
