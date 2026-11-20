import { randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows"
import { createAdminUser } from "../helpers/admin"

jest.setTimeout(120 * 1000)

process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

const csvForm = (content: string) => {
  const form = new FormData()
  form.append("file", new Blob([content], { type: "text/csv" }), "codes.csv")
  return form
}

const VARIANTS = 30

// Postgres เรียงแถวที่ key เท่ากันต่างกันเมื่อใช้ top-N heapsort (แถวที่ตรง filter > 2 × (offset + limit))
// 30 code / limit 10 ตาม AC-49 จึงยังได้ครบบน develop ส่วน 100 code / limit 10 ซ้ำ/หาย — ทดสอบทั้งสองกรณี

// EV-19 (spec 02 กฎข้อ 35, AC-49 — EV-M-12): list ของ e-voucher ที่แบ่งหน้าต้องมี `id` เป็น key เรียงรอง
// ไม่งั้นแถวที่ค่า key แรกเท่ากัน (import batch เดียว → created_at เท่ากัน) ถูกส่งซ้ำ/หายข้ามหน้า
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let variantIds: string[]

    const pg = () => getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION)

    const call = async <T>(p: Promise<{ data: T }>): Promise<T> => {
      try {
        return (await p).data
      } catch (e) {
        const r = (e as { response?: { status: number; data: unknown } }).response
        throw new Error(`${r?.status} ${JSON.stringify(r?.data)}`)
      }
    }

    const createPartner = async (name: string) =>
      (await call<{ partner: { id: string } }>(api.post("/admin/evoucher/partners", { name }, { headers })))
        .partner.id

    const createPool = async (partnerId: string, variantId: string, name: string) =>
      (
        await call<{ pool: { id: string } }>(
          api.post(
            "/admin/evoucher/pools",
            { partner_id: partnerId, variant_id: variantId, name, how_to_use: "แสดง code ที่แคชเชียร์" },
            { headers }
          )
        )
      ).pool.id

    // ให้ created_at เท่ากันจริงทั้งชุด แล้ว update ทีละแถวแบบสลับลำดับเพื่อให้ลำดับทางกายภาพใน heap
    // ไม่ตรงกับลำดับการสร้าง (Postgres ไม่รับประกันลำดับของแถวที่ key เรียงเท่ากัน)
    const flattenCreatedAt = async (table: string, ids: string[]) => {
      await pg().raw(`UPDATE ${table} SET created_at = '2026-01-01T00:00:00Z' WHERE id = ANY(?)`, [ids])
      const shuffled = [...ids].sort(() => Math.random() - 0.5)
      for (const id of shuffled) {
        await pg().raw(`UPDATE ${table} SET updated_at = now() WHERE id = ?`, [id])
      }
    }

    const readAllPages = async <T extends { id: string }>(
      path: string,
      key: string,
      total: number,
      limit: number
    ) => {
      const seen: string[] = []
      for (let offset = 0; offset < total; offset += limit) {
        const sep = path.includes("?") ? "&" : "?"
        const body = await call<Record<string, T[]>>(
          api.get(`${path}${sep}limit=${limit}&offset=${offset}`, { headers })
        )
        seen.push(...body[key].map((r) => r.id))
      }
      return seen
    }

    beforeEach(async () => {
      const container = getContainer()
      headers = (await createAdminUser(container)).headers

      const values = Array.from({ length: VARIANTS }, (_, i) => `${i + 1}`)
      const { result: products } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "EV-19 voucher",
              options: [{ title: "Value", values }],
              variants: values.map((v) => ({
                title: `${v} THB`,
                options: { Value: v },
                manage_inventory: true,
              })),
            },
          ],
        },
      })
      variantIds = products[0].variants.map((v) => v.id)

      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: variantIds },
      })
      const { result: locations } = await createStockLocationsWorkflow(container).run({
        input: { locations: [{ name: "Digital" }] },
      })
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: data.map((v) => ({
            inventory_item_id: v.inventory_items![0]!.inventory_item_id,
            location_id: locations[0].id,
            stocked_quantity: 0,
          })),
        },
      })
    })

    const importBatch = async (poolId: string, count: number) => {
      const csv = Array.from({ length: count }, (_, i) => `EV19-${String(i).padStart(4, "0")}`).join("\n")
      await call(api.post(`/admin/evoucher/pools/${poolId}/import`, csvForm(`${csv}\n`), { headers }))
      const { rows } = await pg().raw(`SELECT id FROM evoucher_code WHERE pool_id = ?`, [poolId])
      expect(rows).toHaveLength(count)
      return rows.map((r: { id: string }) => r.id) as string[]
    }

    it.each([
      [30, 10],
      [100, 10],
    ])(
      "AC-49: pages through %i codes of one import batch (limit=%i) with no duplicate or missing id",
      async (count, limit) => {
        const partnerId = await createPartner("Lotus")
        const poolId = await createPool(partnerId, variantIds[0], "Lotus 500 THB")
        const codeIds = await importBatch(poolId, count)
        await flattenCreatedAt("evoucher_code", codeIds)

        const ids = await readAllPages(`/admin/evoucher/pools/${poolId}/codes`, "codes", count, limit)
        expect(ids).toHaveLength(count)
        expect(new Set(ids).size).toBe(count)
        expect([...ids].sort()).toEqual([...codeIds].sort())
      }
    )

    it.each(["", "?order=created_at", "?order=-created_at"])(
      "pages through pools with equal created_at (%s) with no duplicate or missing id",
      async (qs) => {
        const partnerId = await createPartner("Lotus")
        const poolIds: string[] = []
        for (let i = 0; i < VARIANTS; i++) {
          poolIds.push(await createPool(partnerId, variantIds[i], `Pool ${i}`))
        }
        await flattenCreatedAt("evoucher_pool", poolIds)

        const ids = await readAllPages(`/admin/evoucher/pools${qs}`, "pools", VARIANTS, 5)
        expect(new Set(ids).size).toBe(VARIANTS)
        expect([...ids].sort()).toEqual([...poolIds].sort())
      }
    )

    it.each(["", "?order=name"])(
      "pages through partners sharing a name and created_at (%s) with no duplicate or missing id",
      async (qs) => {
        const partnerIds: string[] = []
        for (let i = 0; i < 50; i++) {
          partnerIds.push(await createPartner("Same name"))
        }
        await flattenCreatedAt("evoucher_partner", partnerIds)

        const ids = await readAllPages(`/admin/evoucher/partners${qs}`, "partners", 50, 5)
        expect(new Set(ids).size).toBe(50)
        expect([...ids].sort()).toEqual([...partnerIds].sort())
      }
    )
  },
})
