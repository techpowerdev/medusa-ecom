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
import evoucherDailyJob, { config as jobConfig } from "../../src/jobs/evoucher-daily"

jest.setTimeout(120 * 1000)

// ต้องตั้งก่อน runner โหลด medusa-config (module evoucher อ่าน key จาก env)
process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

const ADMIN_EMAIL = "admin@example.com"
// owner ตัดสิน Q-A: อีเมลแจ้ง admin ส่งหา mailbox เดียวจาก env (ไม่ใช่ admin user ทุกคน)
const OPS_EMAIL = "evoucher-ops@example.com"
const DAY = 24 * 60 * 60 * 1000
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString()

const csvForm = (content: string) => {
  const form = new FormData()
  form.append("file", new Blob([content], { type: "text/csv" }), "codes.csv")
  return form
}

// EV-5: void code (admin) + job รายวัน expiry/low-stock (AC-5, AC-9, AC-10)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let service: EvoucherModuleService
    let partnerId: string

    // product + variant (manage_inventory) + inventory level 0 ที่ stock location เดียว
    const createVoucherVariant = async (title: string) => {
      const container = getContainer()
      const { result: products } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title,
              options: [{ title: "Value", values: ["500"] }],
              variants: [{ title: "500 THB", options: { Value: "500" }, manage_inventory: true }],
            },
          ],
        },
      })
      const variantId = products[0].variants[0].id
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: variantId },
      })
      const inventoryItemId = data[0].inventory_items![0]!.inventory_item_id
      const { result: locations } = await createStockLocationsWorkflow(container).run({
        input: { locations: [{ name: `Digital ${title}` }] },
      })
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            { inventory_item_id: inventoryItemId, location_id: locations[0].id, stocked_quantity: 0 },
          ],
        },
      })
      return { variantId, inventoryItemId }
    }

    const stockedQuantity = async (inventoryItemId: string) => {
      const inventory = getContainer().resolve(Modules.INVENTORY)
      const levels = await inventory.listInventoryLevels({ inventory_item_id: inventoryItemId })
      return levels.reduce((sum, l) => sum + Number(l.stocked_quantity), 0)
    }

    const createPool = async (name: string, extra: Record<string, unknown> = {}) => {
      const { variantId, inventoryItemId } = await createVoucherVariant(name)
      const res = await api.post(
        "/admin/evoucher/pools",
        { partner_id: partnerId, variant_id: variantId, name, how_to_use: "แสดง code ที่แคชเชียร์", ...extra },
        { headers }
      )
      return { poolId: res.data.pool.id as string, inventoryItemId }
    }

    const importCsv = async (poolId: string, content: string) => {
      const res = await api.post(`/admin/evoucher/pools/${poolId}/import`, csvForm(content), { headers })
      return res.data
    }

    const codesOf = (poolId: string) =>
      service.listEvoucherCodes({ pool_id: poolId }, { order: { created_at: "ASC" } })

    const listEmails = (template: string) =>
      getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ template, channel: "email" })

    beforeEach(async () => {
      const container = getContainer()
      service = container.resolve(EVOUCHER_MODULE)

      const userModule = container.resolve(Modules.USER)
      const authModule = container.resolve(Modules.AUTH)
      const user = await userModule.createUsers({ email: ADMIN_EMAIL })
      const identity = await authModule.createAuthIdentities({
        provider_identities: [{ provider: "emailpass", entity_id: ADMIN_EMAIL }],
        app_metadata: { user_id: user.id },
      })
      const { http } = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig
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

      const partner = await api.post("/admin/evoucher/partners", { name: "Lotus" }, { headers })
      partnerId = partner.data.partner.id
    })

    describe("POST /admin/evoucher/codes/:id/void (AC-10)", () => {
      it("requires an authenticated admin", async () => {
        const res = await api
          .post("/admin/evoucher/codes/evcode_x/void", { reason: "x" })
          .catch((e) => e.response)
        expect(res.status).toBe(401)
      })

      it("voids an available code with the reason and decrements variant inventory by 1", async () => {
        const { poolId, inventoryItemId } = await createPool("Lotus 500")
        await importCsv(poolId, "V-0001\nV-0002\n")
        expect(await stockedQuantity(inventoryItemId)).toBe(2)
        const [code] = await codesOf(poolId)

        const res = await api.post(
          `/admin/evoucher/codes/${code.id}/void`,
          { reason: "partner recalled" },
          { headers }
        )

        expect(res.status).toBe(200)
        expect(res.data.code).toMatchObject({
          id: code.id,
          status: "void",
          void_reason: "partner recalled",
        })
        expect(JSON.stringify(res.data)).not.toContain("v1:")
        const row = await service.retrieveEvoucherCode(code.id)
        expect(row).toMatchObject({ status: "void", void_reason: "partner recalled" })
        expect(await stockedQuantity(inventoryItemId)).toBe(1)
      })

      it.each([
        ["missing", {}],
        ["empty", { reason: "" }],
        ["blank", { reason: "   " }],
      ])("rejects a %s reason with 400 and leaves the code untouched", async (_label, body) => {
        const { poolId, inventoryItemId } = await createPool("Lotus 500")
        await importCsv(poolId, "V-0001\n")
        const [code] = await codesOf(poolId)

        const res = await api
          .post(`/admin/evoucher/codes/${code.id}/void`, body, { headers })
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        const row = await service.retrieveEvoucherCode(code.id)
        expect(row).toMatchObject({ status: "available", void_reason: null })
        expect(await stockedQuantity(inventoryItemId)).toBe(1)
      })

      it.each(["allocated", "delivered", "void"] as const)(
        "returns 409 for a %s code and changes nothing",
        async (status) => {
          const { poolId, inventoryItemId } = await createPool("Lotus 500")
          await importCsv(poolId, "V-0001\n")
          const [code] = await codesOf(poolId)
          await service.updateEvoucherCodes({ id: code.id, status })

          const res = await api
            .post(`/admin/evoucher/codes/${code.id}/void`, { reason: "partner recalled" }, { headers })
            .catch((e) => e.response)

          expect(res.status).toBe(409)
          expect(res.data.message).toMatch(/available/)
          const row = await service.retrieveEvoucherCode(code.id)
          expect(row).toMatchObject({ status, void_reason: null })
          expect(await stockedQuantity(inventoryItemId)).toBe(1)
        }
      )

      it("returns 404 for an unknown code", async () => {
        const res = await api
          .post("/admin/evoucher/codes/evcode_missing/void", { reason: "x" }, { headers })
          .catch((e) => e.response)
        expect(res.status).toBe(404)
      })

      it("restores the code to available when the inventory adjustment fails (compensation)", async () => {
        const { poolId, inventoryItemId } = await createPool("Lotus 500")
        await importCsv(poolId, "V-0001\n")
        const [code] = await codesOf(poolId)
        const inventory = getContainer().resolve(Modules.INVENTORY)
        const spy = jest
          .spyOn(inventory, "adjustInventory")
          .mockRejectedValueOnce(new Error("inventory down"))
        try {
          const res = await api
            .post(`/admin/evoucher/codes/${code.id}/void`, { reason: "partner recalled" }, { headers })
            .catch((e) => e.response)
          expect(res.status).toBeGreaterThanOrEqual(400)
        } finally {
          spy.mockRestore()
        }
        const row = await service.retrieveEvoucherCode(code.id)
        expect(row).toMatchObject({ status: "available", void_reason: null })
        expect(await stockedQuantity(inventoryItemId)).toBe(1)
      })
    })

    describe("daily job (AC-5, AC-9, AC-10)", () => {
      beforeEach(() => {
        process.env.EVOUCHER_ADMIN_EMAIL = OPS_EMAIL
      })

      afterEach(() => {
        delete process.env.EVOUCHER_ADMIN_EMAIL
      })

      it("sends admin alerts only to EVOUCHER_ADMIN_EMAIL, not to every admin user", async () => {
        const { poolId } = await createPool("Lotus 500", { low_stock_threshold: 5 })
        await importCsv(poolId, `code,pin,expires_at\nSOON-1,,${inDays(1)}\n`)

        await evoucherDailyJob(getContainer())

        const emails = [
          ...(await listEmails("evoucher-expiry-summary")),
          ...(await listEmails("evoucher-low-stock")),
        ]
        expect(emails).toHaveLength(2)
        expect(emails.map((e) => e.to)).toEqual([OPS_EMAIL, OPS_EMAIL])
      })

      it("logs a warning and skips admin emails when EVOUCHER_ADMIN_EMAIL is not set (job still voids)", async () => {
        delete process.env.EVOUCHER_ADMIN_EMAIL
        const { poolId, inventoryItemId } = await createPool("Lotus 500", { low_stock_threshold: 5 })
        await importCsv(poolId, `code,pin,expires_at\nSOON-1,,${inDays(1)}\n`)
        const logger = getContainer().resolve(ContainerRegistrationKeys.LOGGER)
        const warn = jest.spyOn(logger, "warn")
        try {
          await expect(evoucherDailyJob(getContainer())).resolves.toBeUndefined()
          expect(warn).toHaveBeenCalledWith(expect.stringContaining("EVOUCHER_ADMIN_EMAIL"))
        } finally {
          warn.mockRestore()
        }

        expect((await codesOf(poolId))[0]).toMatchObject({ status: "void", void_reason: "expiring" })
        expect(await stockedQuantity(inventoryItemId)).toBe(0)
        expect(await listEmails("evoucher-expiry-summary")).toHaveLength(0)
        expect(await listEmails("evoucher-low-stock")).toHaveLength(0)
      })

      it("is scheduled once a day", () => {
        expect(jobConfig.name).toBe("evoucher-daily")
        expect(jobConfig.schedule.split(" ")).toHaveLength(5)
        expect(jobConfig.schedule).toMatch(/^\d+ \d+ \* \* \*$/)
      })

      it("AC-5 voids available codes expiring within 7 days with reason 'expiring' and decrements inventory", async () => {
        const { poolId, inventoryItemId } = await createPool("Lotus 500", { low_stock_threshold: 0 })
        await importCsv(
          poolId,
          [
            "code,pin,expires_at",
            `SOON-1,,${inDays(3)}`,
            `SOON-2,,${inDays(6.9)}`,
            `PAST-1,,${inDays(-1)}`,
            `LATER-1,,${inDays(30)}`,
            `NOEXP-1,,`,
          ].join("\n")
        )
        const byCode = async () => {
          const rows = await codesOf(poolId)
          const entries = await Promise.all(
            rows.map(async (r) => [await service.decryptSecret(r.code), [r.status, r.void_reason]] as const)
          )
          return Object.fromEntries(entries)
        }
        // code ที่ไม่ใช่ available ห้ามถูกแตะแม้ใกล้หมดอายุ
        const rowsBefore = await codesOf(poolId)
        const decrypted = await Promise.all(rowsBefore.map((r) => service.decryptSecret(r.code)))
        const allocatedId = rowsBefore[decrypted.indexOf("SOON-1")].id
        await service.updateEvoucherCodes({ id: allocatedId, status: "allocated" })
        expect(await stockedQuantity(inventoryItemId)).toBe(5)

        await evoucherDailyJob(getContainer())

        expect(await byCode()).toEqual({
          "SOON-1": ["allocated", null],
          "SOON-2": ["void", "expiring"],
          "PAST-1": ["void", "expiring"],
          "LATER-1": ["available", null],
          "NOEXP-1": ["available", null],
        })
        expect(await stockedQuantity(inventoryItemId)).toBe(3)

        // รันซ้ำวันเดียวกัน → ไม่ void/ลด inventory ซ้ำ
        await evoucherDailyJob(getContainer())
        expect(await stockedQuantity(inventoryItemId)).toBe(3)

        const summaries = await listEmails("evoucher-expiry-summary")
        expect(summaries).toHaveLength(1)
        expect(summaries[0]).toMatchObject({
          to: OPS_EMAIL,
          status: "success",
          data: expect.objectContaining({
            total_voided: 2,
            pools: [expect.objectContaining({ id: poolId, name: "Lotus 500", voided: 2 })],
          }),
        })
      })

      it("sends no expiry summary when nothing was voided", async () => {
        const { poolId } = await createPool("Lotus 500", { low_stock_threshold: 0 })
        await importCsv(poolId, `code,pin,expires_at\nLATER-1,,${inDays(30)}\n`)

        await evoucherDailyJob(getContainer())

        expect(await listEmails("evoucher-expiry-summary")).toHaveLength(0)
      })

      it("keeps other pools going when one pool fails", async () => {
        const broken = await createPool("Broken pool", { low_stock_threshold: 0 })
        const healthy = await createPool("Healthy pool", { low_stock_threshold: 0 })
        await importCsv(broken.poolId, `code,pin,expires_at\nB-1,,${inDays(1)}\n`)
        await importCsv(healthy.poolId, `code,pin,expires_at\nH-1,,${inDays(1)}\n`)
        const inventory = getContainer().resolve(Modules.INVENTORY)
        const original = inventory.adjustInventory.bind(inventory)
        const spy = jest
          .spyOn(inventory, "adjustInventory")
          .mockImplementation((async (...args: Parameters<typeof original>) => {
            const [first] = args as unknown as [unknown]
            if (JSON.stringify(first).includes(broken.inventoryItemId)) {
              throw new Error("inventory down")
            }
            return original(...args)
          }) as typeof original)
        try {
          await evoucherDailyJob(getContainer())
        } finally {
          spy.mockRestore()
        }

        expect((await codesOf(broken.poolId))[0]).toMatchObject({ status: "available", void_reason: null })
        expect(await stockedQuantity(broken.inventoryItemId)).toBe(1)
        expect((await codesOf(healthy.poolId))[0]).toMatchObject({ status: "void", void_reason: "expiring" })
        expect(await stockedQuantity(healthy.inventoryItemId)).toBe(0)
      })

      it("AC-9 sends one low-stock email per pool per day when available < threshold", async () => {
        const low = await createPool("Low pool", { low_stock_threshold: 5 })
        const ok = await createPool("OK pool", { low_stock_threshold: 2 })
        await importCsv(low.poolId, "L-1\nL-2\nL-3\nL-4\nL-5\n") // 5 → ไม่ต่ำกว่า 5
        await importCsv(ok.poolId, "K-1\nK-2\n")
        // void 1 → available 4 < 5
        const [first] = await codesOf(low.poolId)
        await api.post(`/admin/evoucher/codes/${first.id}/void`, { reason: "partner recalled" }, { headers })

        await evoucherDailyJob(getContainer())
        await evoucherDailyJob(getContainer())

        const alerts = await listEmails("evoucher-low-stock")
        expect(alerts).toHaveLength(1)
        expect(alerts[0]).toMatchObject({
          to: OPS_EMAIL,
          status: "success",
          resource_id: low.poolId,
          resource_type: "evoucher_pool",
          data: expect.objectContaining({
            pool: expect.objectContaining({
              id: low.poolId,
              name: "Low pool",
              available: 4,
              low_stock_threshold: 5,
            }),
          }),
        })
      })
    })
  },
})
