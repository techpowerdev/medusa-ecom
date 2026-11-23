import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"

jest.setTimeout(120 * 1000)

// ต้องตรงกับ `search_options` ที่ apps/storefront/src/lib/search-client.ts ส่ง (Vitest `search-client.test.ts` ตรวจว่า
// adapter ส่งค่านี้จริง): CORE-88 (กฎข้อ 144) typo_tolerance เฉพาะคำค้นที่ trim แล้ว ≥ 3 code point
const searchOptions = (q: string) =>
  [...q.trim()].length >= 3
    ? { match_strategy: "last", typo_tolerance: true }
    : { match_strategy: "last" }

// CORE-75 (spec 01 กฎข้อ 133, AC-174): ชื่อไทยไม่มีเว้นวรรค → parser ของ Postgres ได้ lexeme เดียว ค้นได้แค่คำนำหน้า
// body เดียวกับที่ storefront ส่ง — seed: "เสื้อยืด Medusa" (t-shirt),
// "เสื้อสเวตเตอร์ Medusa" (sweatshirt) + สินค้าในเทสต์ "กางเกงยีนส์ขายาว" (pants)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const PANTS = "e2e-core75-pants"

    const search = async (q: string, headers: Record<string, string>) => {
      const { status, data } = await api.post(
        "/store/search",
        {
          queries: [
            {
              entity: "product",
              filters: { q },
              pagination: { take: 12, skip: 0 },
              search_options: searchOptions(q),
            },
          ],
        },
        { headers }
      )
      expect(status).toBe(200)
      return (data.results[0].hits as { document: { handle?: string } }[]).map(
        (hit) => hit.document.handle as string
      )
    }

    it("AC-174 + AC-185: คำไทยกลางคำ/ท้ายคำ/คำนำหน้าเจอสินค้าที่ตรง คำที่ไม่เกี่ยวและคำ 2 อักขระไม่เจอ", async () => {
      const container = getContainer()
      await seedThailand({ container, args: [] })
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id"] })
      const { data: profiles } = await query.graph({ entity: "shipping_profile", fields: ["id"] })
      await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "กางเกงยีนส์ขายาว",
              handle: PANTS,
              status: ProductStatus.PUBLISHED,
              shipping_profile_id: profiles[0].id,
              sales_channels: channels.map((c) => ({ id: c.id })),
              options: [{ title: "ขนาด", values: ["M"] }],
              variants: [
                {
                  title: "M",
                  options: { ขนาด: "M" },
                  manage_inventory: false,
                  prices: [{ currency_code: "thb", amount: 590 }],
                },
              ],
            },
          ],
        },
      })
      await container.resolve(Modules.SEARCH).reindex({ index: "product" })
      const headers = { "x-publishable-api-key": await getPublishableKey(container) }

      const cases: [string, string[]][] = [
        // กลางคำ / ท้ายคำ (ล้มก่อนแก้ — lexeme เดียว "เสื้อยืด")
        ["ยืด", ["t-shirt"]],
        ["สเวตเตอร์", ["sweatshirt"]],
        ["ยีนส์", [PANTS]],
        ["ขายาว", [PANTS]],
        // คำนำหน้า (ใช้ได้อยู่แล้ว — ต้องไม่ถดถอย)
        ["เสื้อ", ["sweatshirt", "t-shirt"]],
        ["กางเกง", [PANTS]],
        // อังกฤษใน handle: "shirt" เจอทั้ง t-shirt และ sweatshirt (เดิมเจอแค่ t-shirt)
        ["shirt", ["sweatshirt", "t-shirt"]],
        // คำที่ไม่ควรเจอ
        ["หมวก", []],
        ["รองเท้า", []],
        // CORE-88 (กฎข้อ 144, AC-185): คำ 2 อักขระไม่อยู่ในชื่อสินค้าใด — เดิม word_similarity กับ "ขนาด:M" ≈ 0.33 > 0.3 ได้ทั้ง catalog
        ["ขา", []],
        ["  ขา  ", []],
      ]
      const got: Record<string, string[]> = {}
      for (const [q] of cases) {
        got[q] = (await search(q, headers)).sort()
      }
      expect(got).toEqual(Object.fromEntries(cases))

      // เติมเว้นวรรคเอง: ผลใกล้เคียง (เสื้อสเวตเตอร์) หลุดมาได้ แต่สินค้าที่ตรงที่สุดต้องอยู่อันดับแรก
      expect((await search("เสื้อ ยืด", headers))[0]).toBe("t-shirt")
    })
  },
})
