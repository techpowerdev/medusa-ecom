import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"

jest.setTimeout(120 * 1000)

const ADMIN_EMAIL = "locales-admin@example.com"
const ADMIN_PASSWORD = "locales-test-password"
const STORE_LOCALES = ["th-TH", "en-US"]

// CORE-7 (spec 01, ADR-008): Translation module + store locales th-TH, en-US
// → GET /store/locales และ header x-medusa-locale ใช้งานได้ เนื้อหาต้นฉบับเป็นภาษาไทย
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }
    let storeHeaders: { headers: Record<string, string> }

    const storeLocaleCodes = async () => {
      const { data } = await api.get("/store/locales", storeHeaders)
      return data.locales.map((l: { code: string }) => l.code).sort()
    }

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      await seedThailand({ container: getContainer(), args: [] })
      storeHeaders = {
        headers: { "x-publishable-api-key": (await getPublishableKey(getContainer()))! },
      }
    })

    beforeEach(async () => {
      const { data } = await api.post("/auth/user/emailpass", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      })
      adminHeaders = { headers: { authorization: `Bearer ${data.token}` } }
    })

    it("GET /store/locales returns th-TH and en-US on a freshly seeded DB", async () => {
      const { data } = await api.get("/store/locales", storeHeaders)
      expect(data.locales).toEqual(
        expect.arrayContaining([
          { code: "th-TH", name: "Thai (Thailand)" },
          { code: "en-US", name: "English (United States)" },
        ])
      )
      expect(data.locales).toHaveLength(2)
    })

    it("adds missing locales on a DB seeded before CORE-7 (region Thailand exists)", async () => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data: stores } = await query.graph({ entity: "store", fields: ["id"] })
      // จำลอง DB ที่ seed ไปก่อน CORE-7: มี region Thailand แต่ store ไม่มี locale
      await updateStoresWorkflow(getContainer()).run({
        input: { selector: { id: stores[0].id }, update: { supported_locales: [] } },
      })
      expect(await storeLocaleCodes()).toEqual([])

      await seedThailand({ container: getContainer(), args: [] })

      expect(await storeLocaleCodes()).toEqual([...STORE_LOCALES].sort())
    })

    it("keeps locales added by admin and does not duplicate on re-run", async () => {
      const { data } = await api.get("/admin/stores", adminHeaders)
      await api.post(
        `/admin/stores/${data.stores[0].id}`,
        { supported_locales: [{ locale_code: "en-US" }, { locale_code: "ja-JP" }] },
        adminHeaders
      )

      await seedThailand({ container: getContainer(), args: [] })
      await seedThailand({ container: getContainer(), args: [] })

      expect(await storeLocaleCodes()).toEqual(["en-US", "ja-JP", "th-TH"])
    })

    it("serves Thai source content by default and English from the Translation module via x-medusa-locale", async () => {
      const { data: products } = await api.get(
        "/admin/products?handle=t-shirt&fields=id,title",
        adminHeaders
      )
      const product = products.products[0]
      // เนื้อหาต้นฉบับใน admin เป็นภาษาไทย (ADR-008)
      await api.post(`/admin/products/${product.id}`, { title: "เสื้อยืด Medusa" }, adminHeaders)
      await api.post(
        "/admin/translations/batch",
        {
          create: [
            {
              reference: "product",
              reference_id: product.id,
              locale_code: "en-US",
              translations: { title: "Medusa T-Shirt" },
            },
          ],
        },
        adminHeaders
      )

      const title = async (locale?: string) => {
        const { data } = await api.get(`/store/products/${product.id}?fields=title`, {
          headers: {
            ...storeHeaders.headers,
            ...(locale ? { "x-medusa-locale": locale } : {}),
          },
        })
        return data.product.title
      }

      expect(await title()).toEqual("เสื้อยืด Medusa")
      expect(await title("th-TH")).toEqual("เสื้อยืด Medusa")
      expect(await title("en-US")).toEqual("Medusa T-Shirt")
    })
  },
})
