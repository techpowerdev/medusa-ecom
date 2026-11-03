import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createCollectionsWorkflow, createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"

jest.setTimeout(180 * 1000)

const THAI = /[฀-๿]/

// CORE-10c (spec 01 กฎข้อ 35, 80; AC-72, AC-109): category ตัวอย่างชื่อไทย handle คงที่ หาด้วย handle
// และ collection `featured` ที่มีอยู่แต่ไม่มีสินค้า (seed ล้มกลางทาง) ถูกผูกสินค้า seed โดยไม่แก้ชื่อ
// ทุก test สร้างข้อมูลเองใน test (runner restore DB ก่อนทุก test)
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const seed = () => seedThailand({ container: getContainer(), args: [] })
    const categories = async () =>
      (await query().graph({ entity: "product_category", fields: ["id", "name", "handle"] })).data
    const featured = async () =>
      (
        await query().graph({
          entity: "product_collection",
          fields: ["id", "title", "products.id"],
          filters: { handle: "featured" },
        })
      ).data

    beforeEach(() => {
      delete process.env.SEED_ADMIN_PASSWORD
    })

    it("AC-72 names every sample category in Thai with fixed handles, idempotent", async () => {
      await seed()

      const first = await categories()
      expect(first.map((c) => c.handle).sort()).toEqual(["shirts", "sweatshirts"])
      for (const category of first) {
        expect(category.name).toMatch(THAI)
      }

      await seed()
      expect(await categories()).toHaveLength(first.length)
    })

    it("AC-72 links each sample product to its category by handle", async () => {
      await seed()

      const { data } = await query().graph({ entity: "product", fields: ["handle", "categories.handle"] })
      const byHandle = Object.fromEntries(data.map((p) => [p.handle, (p.categories ?? []).map((c) => c?.handle)]))
      expect(byHandle).toEqual({ "t-shirt": ["shirts"], sweatshirt: ["sweatshirts"] })
    })

    it("AC-72 reuses an existing English category with handle `shirts` without renaming or duplicating it", async () => {
      const { result } = await createProductCategoriesWorkflow(getContainer()).run({
        input: { product_categories: [{ name: "Shirts", handle: "shirts", is_active: true }] },
      })

      await seed()
      await seed()

      const all = await categories()
      expect(all.map((c) => c.handle).sort()).toEqual(["shirts", "sweatshirts"])
      expect(all.find((c) => c.handle === "shirts")).toMatchObject({ id: result[0].id, name: "Shirts" })
      expect(all.some((c) => c.handle.startsWith("shirts-"))).toBe(false)
    })

    it("AC-109 links sample products to an existing empty `featured` collection and keeps its title", async () => {
      // จำลอง seed ที่ล้มกลางทาง: collection `featured` ถูกสร้างแล้วแต่ยังไม่มีสินค้า
      const { result } = await createCollectionsWorkflow(getContainer()).run({
        input: { collections: [{ title: "Featured (เดิม)", handle: "featured" }] },
      })

      await seed()

      const after = await featured()
      expect(after).toHaveLength(1)
      expect(after[0]).toMatchObject({ id: result[0].id, title: "Featured (เดิม)" })
      expect(after[0].products?.length).toBeGreaterThanOrEqual(2)

      await seed()
      const again = await featured()
      expect(again[0].products).toHaveLength(after[0].products!.length)
      const { data: all } = await query().graph({ entity: "product_collection", fields: ["id"] })
      expect(all).toHaveLength(1)
    })
  },
})
