import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"

jest.setTimeout(120 * 1000)

const ADMIN_EMAIL = "core9b-admin@example.com"
const ADMIN_PASSWORD = "core9b-test-password"
const TITLE_P = "เสื้อทดสอบลบตัวเลือก"

type Headers = { headers: Record<string, string> }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// axios error มี circular reference → ห่อเป็น Error ธรรมดา (CLAUDE.md)
async function call<T>(request: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await request()).data
  } catch (e: any) {
    throw new Error(`${e.response?.status} ${JSON.stringify(e.response?.data)}`)
  }
}

// CORE-9b (spec 01 กฎข้อ 79, AC-108): event ลบ option ที่ payload ไม่มี relation (product-option.deleted)
// ต้องไม่ทำให้ search ingestion throw และสินค้า P ยังค้นเจอใน /store/search
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    it("AC-108: ลบ option ผ่าน admin API → ไม่มี log 'Cannot read properties of undefined' และยังค้นเจอ P", async () => {
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      const container = getContainer()
      await seedThailand({ container, args: [] })

      const storeHeaders: Headers = {
        headers: { "x-publishable-api-key": (await getPublishableKey(container))! },
      }
      const { token } = await call<{ token: string }>(() =>
        api.post("/auth/user/emailpass", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      )
      const adminHeaders: Headers = { headers: { authorization: `Bearer ${token}` } }

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id"] })

      const createProduct = (title: string) =>
        call<{ product: { id: string; options: { id: string; title: string }[] } }>(() =>
          api.post(
            "/admin/products",
            {
              title,
              status: "published",
              sales_channels: channels.map((channel) => ({ id: channel.id })),
              // ลบ "สี" แล้ว variant ยังแยกกันด้วยไซซ์ (Medusa ไม่ยอมให้ variant ซ้ำ combination)
              options: [
                { title: "ไซซ์", values: ["S", "M"] },
                { title: "สี", values: ["แดง"] },
              ],
              variants: ["S", "M"].map((size) => ({
                title: size,
                options: { "ไซซ์": size, "สี": "แดง" },
                prices: [{ currency_code: "thb", amount: 100 }],
              })),
            },
            adminHeaders
          )
        ).then((data) => data.product)

      const p = await createProduct(TITLE_P)
      const q = await createProduct("สินค้าที่จะถูกลบ")
      // option กลางที่ไม่ผูกกับสินค้าใด — Medusa ลบผ่าน DELETE /admin/product-options/:id ได้เฉพาะแบบนี้
      const { product_option: standalone } = await call<{ product_option: { id: string } }>(() =>
        api.post(
          "/admin/product-options",
          { title: "วัสดุ", values: ["ฝ้าย"] },
          adminHeaders
        )
      )
      await container.resolve(Modules.SEARCH).reindex({ index: "product" })

      // error ของ subscriber ถูก log ผ่าน logger ของ event bus (ไม่ใช่ instance เดียวกับ logger ของ container)
      const loggers = [
        container.resolve(ContainerRegistrationKeys.LOGGER),
        (container.resolve(Modules.EVENT_BUS) as unknown as { logger_: typeof console }).logger_,
      ]
      const spies = loggers.flatMap((logger) => [
        jest.spyOn(logger, "warn"),
        jest.spyOn(logger, "error"),
      ])

      // 1) เอา option "สี" ออกจาก P (option exclusive ที่ไม่มีสินค้าผูกจะถูก soft delete)
      const color = p.options.find((option) => option.title === "สี")!
      await call(() =>
        api.post(`/admin/products/${p.id}/options/batch`, { remove: [color.id] }, adminHeaders)
      )
      // 2) ลบ option กลาง → product-option.deleted ที่ไม่มี relation กับสินค้าใด
      await call(() => api.delete(`/admin/product-options/${standalone.id}`, adminHeaders))
      // 3) ลบสินค้า Q → Medusa cascade ส่ง product-option.deleted ของ option ของ Q ที่ถูกตัด link แล้ว
      await call(() => api.delete(`/admin/products/${q.id}`, adminHeaders))

      // ingestion รันแบบ async ผ่าน event bus — รอให้ subscriber ประมวลผล event ลบให้เสร็จ
      await sleep(3000)

      const logged = spies
        .flatMap((spy) => spy.mock.calls.flat())
        .map((arg) => String((arg as { message?: unknown })?.message ?? arg))
      expect(logged.filter((line) => line.includes("Cannot read properties of undefined"))).toEqual([])

      const search = (text: string) =>
        call<{ results: { hits: { id: string }[] }[] }>(() =>
          api.post(
            "/store/search",
            { queries: [{ entity: "product", filters: { q: text }, pagination: { take: 20, skip: 0 } }] },
            storeHeaders
          )
        ).then((data) => data.results[0].hits.map((hit) => hit.id))

      expect(await search(TITLE_P)).toContain(p.id)
      expect(await search("สินค้าที่จะถูกลบ")).not.toContain(q.id)
    })
  },
})
