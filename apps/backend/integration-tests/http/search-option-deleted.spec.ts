import { setTimeout as delay } from "node:timers/promises"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { logger } from "@medusajs/framework/logger"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"

jest.setTimeout(120 * 1000)

const ADMIN_EMAIL = "core9b-admin@example.com"
const ADMIN_PASSWORD = "core9b-test-password"
const TITLE_P = "เสื้อทดสอบลบตัวเลือก"

type Headers = { headers: Record<string, string> }

// CORE-9c (กฎข้อ 82): รอผลของ ingestion ด้วยการ poll พร้อม timeout แทนการรอเวลาคงที่
const POLL_TIMEOUT_MS = 30 * 1000
const POLL_INTERVAL_MS = 200

async function pollUntil(label: string, check: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (!(await check())) {
    if (Date.now() > deadline) {
      throw new Error(`timeout ${POLL_TIMEOUT_MS}ms: ${label}`)
    }
    await delay(POLL_INTERVAL_MS)
  }
}

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

      // ใน medusaIntegrationTestRunner event bus log (รวม error ของ subscriber) ผ่าน singleton `logger` ของ framework
      // ไม่ใช่ LOGGER ของ container (ถูกตั้งทับด้วย logger ของ medusa-config หลังโหลด module — spec 01 กฎข้อ 82(b))
      // spy ที่ export สาธารณะ ไม่แตะ property private
      const spies = (["info", "warn", "error"] as const).map((level) => jest.spyOn(logger, level))
      try {
        const logged = () =>
          spies
            .flatMap((spy) => spy.mock.calls.flat())
            .map((arg) => String((arg as { message?: unknown })?.message ?? arg))
        const optionDeletedLines = () =>
          logged().filter((line) => line.startsWith("Processing product-option.deleted")).length
        // event product-option.deleted ที่คาด: option กลาง 1 + option ของ Q ที่ cascade 2 (ไซซ์, สี)
        // (เอา option ออกจาก P ส่งแค่ product.updated — ดู docs/evidence/core/CORE-9b-tests.txt)
        const OPTION_DELETED_EVENTS = 3

        // 1) เอา option "สี" ออกจาก P (option exclusive ที่ไม่มีสินค้าผูกจะถูก soft delete)
        const color = p.options.find((option) => option.title === "สี")!
        await call(() =>
          api.post(`/admin/products/${p.id}/options/batch`, { remove: [color.id] }, adminHeaders)
        )
        // 2) ลบ option กลาง → product-option.deleted ที่ไม่มี relation กับสินค้าใด
        await call(() => api.delete(`/admin/product-options/${standalone.id}`, adminHeaders))
        // 3) ลบสินค้า Q → Medusa cascade ส่ง product-option.deleted ของ option ของ Q ที่ถูกตัด link แล้ว
        await call(() => api.delete(`/admin/products/${q.id}`, adminHeaders))

        const search = (text: string) =>
          call<{ results: { hits: { id: string }[] }[] }>(() =>
            api.post(
              "/store/search",
              { queries: [{ entity: "product", filters: { q: text }, pagination: { take: 20, skip: 0 } }] },
              storeHeaders
            )
          ).then((data) => data.results[0].hits.map((hit) => hit.id))

        // ingestion รันแบบ async ผ่าน event bus — poll จน event ลบ option ถูกประมวลผลครบ, P ยังค้นเจอ และ Q หายจาก index
        await pollUntil("ingestion ของ event ลบ option/สินค้า", async () => {
          return (
            optionDeletedLines() >= OPTION_DELETED_EVENTS &&
            (await search(TITLE_P)).includes(p.id) &&
            !(await search("สินค้าที่จะถูกลบ")).includes(q.id)
          )
        })

        // positive control: spy จับ log ของ event bus ได้จริง ก่อน assert ว่าไม่มีบรรทัด error
        expect(spies.some((spy) => spy.mock.calls.length > 0)).toBe(true)
        expect(optionDeletedLines()).toBe(OPTION_DELETED_EVENTS)
        expect(logged().filter((line) => line.includes("Cannot read properties of undefined"))).toEqual([])
        expect(await search(TITLE_P)).toContain(p.id)
        expect(await search("สินค้าที่จะถูกลบ")).not.toContain(q.id)
      } finally {
        spies.forEach((spy) => spy.mockRestore())
      }
    })
  },
})
