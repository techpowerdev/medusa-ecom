import { randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  ContainerRegistrationKeys,
  generateJwtToken,
  Modules,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows"
import { EVOUCHER_MODULE } from "../../src/modules/evoucher"
import EvoucherModuleService from "../../src/modules/evoucher/service"

jest.setTimeout(120 * 1000)

process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

const csvForm = (content: string) => {
  const form = new FormData()
  form.append("file", new Blob([content], { type: "text/csv" }), "codes.csv")
  return form
}

// EV-6: ข้อมูลที่ admin UI ต้องใช้ — จำนวน code ตามสถานะ/low-stock ต่อ pool,
// หา pool จาก variant (variant widget) และ code ของ order แบบ masked (order widget)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let variantIds: string[]
    let service: EvoucherModuleService

    const createPool = async (variantId: string, extra: Record<string, unknown> = {}) => {
      const partner = await api.post(
        "/admin/evoucher/partners",
        { name: "Lotus" },
        { headers }
      )
      const pool = await api.post(
        "/admin/evoucher/pools",
        {
          partner_id: partner.data.partner.id,
          variant_id: variantId,
          name: "Lotus 500 THB",
          how_to_use: "แสดง code ที่แคชเชียร์",
          ...extra,
        },
        { headers }
      )
      return pool.data.pool.id as string
    }

    const importCsv = (poolId: string, content: string) =>
      api.post(`/admin/evoucher/pools/${poolId}/import`, csvForm(content), {
        headers,
      })

    beforeEach(async () => {
      const container = getContainer()
      service = container.resolve(EVOUCHER_MODULE)

      const userModule = container.resolve(Modules.USER)
      const authModule = container.resolve(Modules.AUTH)
      const user = await userModule.createUsers({ email: "admin@example.com" })
      const identity = await authModule.createAuthIdentities({
        provider_identities: [
          { provider: "emailpass", entity_id: "admin@example.com" },
        ],
        app_metadata: { user_id: user.id },
      })
      const { http } = container.resolve(
        ContainerRegistrationKeys.CONFIG_MODULE
      ).projectConfig
      const token = generateJwtToken(
        {
          actor_id: user.id,
          actor_type: "user",
          auth_identity_id: identity.id,
          app_metadata: { user_id: user.id },
        },
        { secret: http.jwtSecret, expiresIn: "1d" }
      )
      headers = { authorization: `Bearer ${token}` }

      const { result: products } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "Lotus e-voucher",
              options: [{ title: "Value", values: ["500", "1000"] }],
              variants: [
                { title: "500 THB", options: { Value: "500" }, manage_inventory: true },
                { title: "1000 THB", options: { Value: "1000" }, manage_inventory: true },
              ],
            },
          ],
        },
      })
      variantIds = products[0].variants.map((v) => v.id)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: variantIds },
      })
      const { result: locations } = await createStockLocationsWorkflow(
        container
      ).run({ input: { locations: [{ name: "Digital" }] } })
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

    it("returns code counts per status and a low-stock flag for each pool", async () => {
      const lowPool = await createPool(variantIds[0], { low_stock_threshold: 5 })
      const okPool = await createPool(variantIds[1], { low_stock_threshold: 2 })
      await importCsv(lowPool, "L-0001\nL-0002\nL-0003\nL-0004\n")
      await importCsv(okPool, "O-0001\nO-0002\nO-0003\n")
      const [first, second] = await service.listEvoucherCodes(
        { pool_id: lowPool },
        { order: { created_at: "ASC" } }
      )
      await service.updateEvoucherCodes([
        { id: first.id, status: "delivered", order_id: "order_1" },
        { id: second.id, status: "void" },
      ])

      const list = await api.get("/admin/evoucher/pools", { headers })
      const byId = Object.fromEntries(
        list.data.pools.map((p: { id: string }) => [p.id, p])
      )
      expect(byId[lowPool]).toMatchObject({
        code_counts: { available: 2, allocated: 0, delivered: 1, void: 1 },
        low_stock: true,
      })
      expect(byId[okPool]).toMatchObject({
        code_counts: { available: 3, allocated: 0, delivered: 0, void: 0 },
        low_stock: false,
      })

      const one = await api.get(`/admin/evoucher/pools/${lowPool}`, { headers })
      expect(one.data.pool).toMatchObject({
        code_counts: { available: 2, delivered: 1, void: 1 },
        low_stock: true,
      })
    })

    it("filters pools by variant_id for the variant widget", async () => {
      const poolId = await createPool(variantIds[1])
      await createPool(variantIds[0])

      const res = await api.get(
        `/admin/evoucher/pools?variant_id=${variantIds[1]}`,
        { headers }
      )
      expect(res.data.count).toBe(1)
      expect(res.data.pools).toEqual([
        expect.objectContaining({
          id: poolId,
          variant_id: variantIds[1],
          partner: expect.objectContaining({ name: "Lotus" }),
          code_counts: expect.objectContaining({ available: 0 }),
        }),
      ])
    })

    it("lists an order's codes masked with their pool for the order widget", async () => {
      const poolId = await createPool(variantIds[0])
      await importCsv(poolId, "code,pin\nLOTUS-ORDER-0001,1111\nLOTUS-ORDER-0002,\nLOTUS-OTHER-0003,\n")
      const codes = await service.listEvoucherCodes(
        { pool_id: poolId },
        { order: { created_at: "ASC" } }
      )
      await service.updateEvoucherCodes([
        { id: codes[0].id, status: "delivered", order_id: "order_A", delivered_to_email: "a@example.com" },
        { id: codes[1].id, status: "allocated", order_id: "order_A" },
        { id: codes[2].id, status: "delivered", order_id: "order_B" },
      ])

      const res = await api.get("/admin/evoucher/orders/order_A/codes", { headers })

      expect(res.data.codes).toHaveLength(2)
      expect(res.data.codes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: codes[0].id,
            status: "delivered",
            code: "************0001",
            has_pin: true,
            delivered_to_email: "a@example.com",
            pool: expect.objectContaining({ id: poolId, name: "Lotus 500 THB" }),
          }),
          expect.objectContaining({ id: codes[1].id, status: "allocated", has_pin: false }),
        ])
      )
      const body = JSON.stringify(res.data)
      expect(body).not.toContain("LOTUS-ORDER")
      expect(body).not.toContain("1111")
      expect(body).not.toContain("v1:")

      const empty = await api.get("/admin/evoucher/orders/order_none/codes", { headers })
      expect(empty.data.codes).toEqual([])
    })

    it("requires an authenticated admin for order codes", async () => {
      const res = await api
        .get("/admin/evoucher/orders/order_A/codes")
        .catch((e) => e.response)
      expect(res.status).toBe(401)
    })
  },
})
