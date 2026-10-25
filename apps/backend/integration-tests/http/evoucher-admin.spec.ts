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

// ต้องตั้งก่อน runner โหลด medusa-config (module evoucher อ่าน key จาก env)
process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

const csvForm = (content: string) => {
  const form = new FormData()
  form.append("file", new Blob([content], { type: "text/csv" }), "codes.csv")
  return form
}

// EV-2: admin API partner/pool/import + masking/reveal (AC-1, AC-8)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let adminUserId: string
    let variantId: string
    let inventoryItemId: string
    let service: EvoucherModuleService

    const stockedQuantity = async () => {
      const inventory = getContainer().resolve(Modules.INVENTORY)
      const levels = await inventory.listInventoryLevels({
        inventory_item_id: inventoryItemId,
      })
      return levels.reduce((sum, l) => sum + Number(l.stocked_quantity), 0)
    }

    const createPool = async () => {
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
      adminUserId = user.id
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
              title: "Lotus e-voucher 500 THB",
              options: [{ title: "Value", values: ["500"] }],
              variants: [
                {
                  title: "500 THB",
                  options: { Value: "500" },
                  manage_inventory: true,
                },
              ],
            },
          ],
        },
      })
      variantId = products[0].variants[0].id
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: variantId },
      })
      inventoryItemId = data[0].inventory_items![0]!.inventory_item_id
      const { result: locations } = await createStockLocationsWorkflow(
        container
      ).run({ input: { locations: [{ name: "Digital" }] } })
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            {
              inventory_item_id: inventoryItemId,
              location_id: locations[0].id,
              stocked_quantity: 0,
            },
          ],
        },
      })
    })

    it("requires an authenticated admin", async () => {
      const res = await api
        .get("/admin/evoucher/partners")
        .catch((e) => e.response)
      expect(res.status).toBe(401)
    })

    it("creates, updates, lists and deletes partners", async () => {
      const created = await api.post(
        "/admin/evoucher/partners",
        { name: "Big C", support_contact: "02-000-0000" },
        { headers }
      )
      const id = created.data.partner.id
      await api.post(
        `/admin/evoucher/partners/${id}`,
        { name: "Big C Supercenter" },
        { headers }
      )
      const list = await api.get("/admin/evoucher/partners", { headers })
      expect(list.data.partners).toEqual([
        expect.objectContaining({ id, name: "Big C Supercenter" }),
      ])
      expect(list.data.count).toBe(1)
      const deleted = await api.delete(`/admin/evoucher/partners/${id}`, {
        headers,
      })
      expect(deleted.data).toMatchObject({ id, deleted: true })
    })

    it("creates a pool for an existing variant and rejects unknown variants", async () => {
      const poolId = await createPool()
      const pool = await api.get(`/admin/evoucher/pools/${poolId}`, { headers })
      expect(pool.data.pool).toMatchObject({
        variant_id: variantId,
        low_stock_threshold: 20,
        partner: expect.objectContaining({ name: "Lotus" }),
      })

      const partnerId = pool.data.pool.partner.id
      const bad = await api
        .post(
          "/admin/evoucher/pools",
          {
            partner_id: partnerId,
            variant_id: "variant_missing",
            name: "x",
            how_to_use: "x",
          },
          { headers }
        )
        .catch((e) => e.response)
      expect(bad.status).toBe(404)

      const updated = await api.post(
        `/admin/evoucher/pools/${poolId}`,
        { low_stock_threshold: 5 },
        { headers }
      )
      expect(updated.data.pool.low_stock_threshold).toBe(5)

      const partnerInUse = await api
        .delete(`/admin/evoucher/partners/${partnerId}`, { headers })
        .catch((e) => e.response)
      expect(partnerInUse.status).toBe(400)
    })

    it("AC-1 imports 100 codes with 2 duplicates → 98 available, inventory +98", async () => {
      const poolId = await createPool()
      const codes = Array.from({ length: 98 }, (_, i) => `LOTUS-${1000 + i}`)
      const csv = ["code,pin,expires_at", ...codes.map((c) => `${c},1234,2027-12-31`)]
      csv.push(`${codes[0]},9999,`, ` ${codes[1]} ,,`) // ซ้ำ 2 (รวมกรณีมีช่องว่าง)

      const res = await importCsv(poolId, csv.join("\n"))

      expect(res.status).toBe(200)
      expect(res.data).toMatchObject({ inserted: 98, skipped_duplicates: 2 })
      expect(res.data.batch_ref).toEqual(expect.any(String))
      const available = await service.listEvoucherCodes({
        pool_id: poolId,
        status: "available",
      })
      expect(available).toHaveLength(98)
      expect(await stockedQuantity()).toBe(98)
    })

    it("skips codes that already exist in the pool on re-import", async () => {
      const poolId = await createPool()
      await importCsv(poolId, "A-0001\nA-0002\n")
      const res = await importCsv(poolId, "A-0002\nA-0003\n")
      expect(res.data).toMatchObject({ inserted: 1, skipped_duplicates: 1 })
      expect(await stockedQuantity()).toBe(3)

      const allDupes = await importCsv(poolId, "A-0001\n")
      expect(allDupes.data).toMatchObject({ inserted: 0, skipped_duplicates: 1 })
      expect(await stockedQuantity()).toBe(3)
    })

    it("stores only v1: ciphertext (never plaintext) for code and pin", async () => {
      const poolId = await createPool()
      await importCsv(poolId, "code,pin\nSECRET-CODE-1,4321\n")
      const [row] = await service.listEvoucherCodes({ pool_id: poolId })
      expect(row.code.startsWith("v1:")).toBe(true)
      expect(row.pin!.startsWith("v1:")).toBe(true)
      expect(row.code).not.toContain("SECRET-CODE-1")
      expect(row.pin).not.toContain("4321")
    })

    it("rejects an invalid CSV without inserting anything", async () => {
      const poolId = await createPool()
      const res = await importCsv(poolId, "code,expires_at\nOK-1,\n,2027-01-01\n").catch(
        (e) => e.response
      )
      expect(res.status).toBe(400)
      expect(res.data.message).toMatch(/line 3/)
      expect(await service.listEvoucherCodes({ pool_id: poolId })).toHaveLength(0)
      expect(await stockedQuantity()).toBe(0)
    })

    it("rolls back the inserted batch when the inventory adjustment fails", async () => {
      const poolId = await createPool()
      const inventory = getContainer().resolve(Modules.INVENTORY)
      const spy = jest
        .spyOn(inventory, "adjustInventory")
        .mockRejectedValueOnce(new Error("inventory down"))
      try {
        const res = await importCsv(poolId, "R-1\nR-2\n").catch((e) => e.response)
        expect(res.status).toBeGreaterThanOrEqual(400)
      } finally {
        spy.mockRestore()
      }
      expect(await service.listEvoucherCodes({ pool_id: poolId })).toHaveLength(0)
      expect(await stockedQuantity()).toBe(0)

      const deleted = await api.delete(`/admin/evoucher/pools/${poolId}`, { headers })
      expect(deleted.data).toMatchObject({ id: poolId, deleted: true })
    })

    it("refuses to delete a pool that has codes", async () => {
      const poolId = await createPool()
      await importCsv(poolId, "P-1\n")
      const res = await api
        .delete(`/admin/evoucher/pools/${poolId}`, { headers })
        .catch((e) => e.response)
      expect(res.status).toBe(400)
    })

    it("checks EVOUCHER_ENCRYPTION_KEY before touching data", async () => {
      const poolId = await createPool()
      const options = (service as unknown as { options_: { encryptionKey?: string } })
        .options_
      const key = options.encryptionKey
      options.encryptionKey = undefined
      try {
        const res = await importCsv(poolId, "K-1\n").catch((e) => e.response)
        expect(res.status).toBeGreaterThanOrEqual(400)
        expect(res.data.message).toMatch(/EVOUCHER_ENCRYPTION_KEY/)
      } finally {
        options.encryptionKey = key
      }
      expect(await service.listEvoucherCodes({ pool_id: poolId })).toHaveLength(0)
      expect(await stockedQuantity()).toBe(0)
    })

    it("AC-8 lists codes masked and reveals the real value with an audit row", async () => {
      const poolId = await createPool()
      await importCsv(poolId, "code,pin\nLOTUS-REAL-0001,5555\n")

      const list = await api.get(
        `/admin/evoucher/pools/${poolId}/codes?status=available`,
        { headers }
      )
      expect(list.data.count).toBe(1)
      const listed = list.data.codes[0]
      expect(listed).toMatchObject({
        status: "available",
        code: "***********0001",
        has_pin: true,
      })
      expect(JSON.stringify(list.data)).not.toContain("LOTUS-REAL-0001")
      expect(JSON.stringify(list.data)).not.toContain("5555")
      expect(JSON.stringify(list.data)).not.toContain("v1:")

      const delivered = await api.get(
        `/admin/evoucher/pools/${poolId}/codes?status=delivered`,
        { headers }
      )
      expect(delivered.data.codes).toEqual([])

      const reveal = await api.get(`/admin/evoucher/codes/${listed.id}/reveal`, {
        headers,
      })
      expect(reveal.data.code).toMatchObject({
        id: listed.id,
        code: "LOTUS-REAL-0001",
        pin: "5555",
      })

      const audits = await service.listEvoucherCodeReveals({ code_id: listed.id })
      expect(audits).toEqual([
        expect.objectContaining({
          code_id: listed.id,
          actor_id: adminUserId,
          created_at: expect.any(Date),
        }),
      ])
    })

    it("returns 404 when revealing an unknown code and writes no audit", async () => {
      const res = await api
        .get("/admin/evoucher/codes/evcode_missing/reveal", { headers })
        .catch((e) => e.response)
      expect(res.status).toBe(404)
      expect(await service.listEvoucherCodeReveals({})).toHaveLength(0)
    })
  },
})
