import { randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import { EVOUCHER_MODULE } from "../../src/modules/evoucher"
import EvoucherModuleService from "../../src/modules/evoucher/service"

jest.setTimeout(180 * 1000)

// ต้องตั้งก่อน runner โหลด medusa-config (module evoucher อ่าน key จาก env)
process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

const ADMIN_EMAIL = "ev8-admin@example.com"
const ADMIN_PASSWORD = "ev8-test-password"

const csvForm = (content: string) => {
  const form = new FormData()
  form.append("file", new Blob([content], { type: "text/csv" }), "codes.csv")
  return form
}

// EV-8: กฎข้อ 1 ตอนสร้าง pool (AC-11) + error เดิมไม่ถูกกลบเมื่อ compensation ของ import ล้ม (AC-13)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let service: EvoucherModuleService
    let adminHeaders: { headers: Record<string, string> }
    let publishableKey: string
    let regionId: string
    let salesChannelId: string
    let locationId: string
    let partnerId: string
    let seq = 0

    beforeAll(async () => {
      container = getContainer()
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      await seedThailand({ container, args: [] })
      service = container.resolve(EVOUCHER_MODULE)
      publishableKey = await getPublishableKey(container)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: channels } = await query.graph({
        entity: "sales_channel",
        fields: ["id"],
        filters: { name: "Default Sales Channel" },
      })
      salesChannelId = channels[0].id
      const { data: locations } = await query.graph({ entity: "stock_location", fields: ["id"] })
      locationId = locations[0].id
    })

    beforeEach(async () => {
      const { data } = await api.post("/auth/user/emailpass", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      })
      adminHeaders = { headers: { authorization: `Bearer ${data.token}` } }
      const partner = await api.post(
        "/admin/evoucher/partners",
        { name: `Lotus ${++seq}` },
        adminHeaders
      )
      partnerId = partner.data.partner.id
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    const createVariant = async (manage_inventory: boolean) => {
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: `EV-8 voucher ${++seq}`,
              status: "published",
              sales_channels: [{ id: salesChannelId }],
              options: [{ title: "Value", values: ["500"] }],
              variants: [
                {
                  title: "500 THB",
                  options: { Value: "500" },
                  manage_inventory,
                  prices: [{ currency_code: "thb", amount: 500 }],
                },
              ],
            },
          ],
        },
      })
      const variantId = result[0].variants[0].id
      if (!manage_inventory) {
        return { variantId, inventoryItemId: undefined }
      }
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: variantId },
      })
      const inventoryItemId = data[0].inventory_items![0]!.inventory_item_id
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            { inventory_item_id: inventoryItemId, location_id: locationId, stocked_quantity: 5 },
          ],
        },
      })
      return { variantId, inventoryItemId }
    }

    const postPool = (variantId: string) =>
      api.post(
        "/admin/evoucher/pools",
        { partner_id: partnerId, variant_id: variantId, name: "Lotus 500", how_to_use: "แสดง code" },
        adminHeaders
      )

    const requiresShipping = async (inventoryItemId: string) => {
      const item = await container
        .resolve(Modules.INVENTORY)
        .retrieveInventoryItem(inventoryItemId, { select: ["id", "requires_shipping"] })
      return item.requires_shipping
    }

    const poolsOf = (variantId: string) => service.listEvoucherPools({ variant_id: variantId })

    describe("AC-11 pool creation enforces requires_shipping=false (rule 1)", () => {
      it("sets requires_shipping=false on the inventory item and on the cart line item", async () => {
        const { variantId, inventoryItemId } = await createVariant(true)
        expect(await requiresShipping(inventoryItemId!)).toBe(true)

        const res = await postPool(variantId)

        expect(res.status).toBe(200)
        expect(await requiresShipping(inventoryItemId!)).toBe(false)

        const { token } = await registerCustomer(
          api,
          publishableKey,
          `ev8-buyer-${seq}@example.com`,
          "ev8-buyer-password"
        )
        const headers = storeHeadersFor(publishableKey, token)
        const { data: created } = await api.post("/store/carts", { region_id: regionId }, headers)
        const { data } = await api.post(
          `/store/carts/${created.cart.id}/line-items?fields=+items.requires_shipping`,
          { variant_id: variantId, quantity: 1 },
          headers
        )
        expect(data.cart.items).toEqual([
          expect.objectContaining({ variant_id: variantId, requires_shipping: false }),
        ])
      })

      it("rejects a variant with manage_inventory=false with 400 and creates no pool", async () => {
        const { variantId } = await createVariant(false)

        const res = await postPool(variantId).catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toMatch(/manage_inventory/)
        expect(await poolsOf(variantId)).toHaveLength(0)
      })

      it("restores requires_shipping when creating the pool fails afterwards (compensation)", async () => {
        const { variantId, inventoryItemId } = await createVariant(true)
        jest
          .spyOn(service, "createEvoucherPools")
          .mockRejectedValueOnce(new MedusaError(MedusaError.Types.NOT_ALLOWED, "pool insert failed"))

        const res = await postPool(variantId).catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe("pool insert failed")
        expect(await requiresShipping(inventoryItemId!)).toBe(true)
        expect(await poolsOf(variantId)).toHaveLength(0)
      })
    })

    describe("AC-13 the original error survives a failing compensation", () => {
      const importCsv = (poolId: string, content: string) =>
        api
          .post(`/admin/evoucher/pools/${poolId}/import`, csvForm(content), adminHeaders)
          .catch((e) => e.response)

      const loggedErrors = () => {
        const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
        return jest.spyOn(logger, "error").mockImplementation(() => undefined)
      }

      it("returns the inventory error (not the delete error) and logs the compensation error with batch_ref", async () => {
        const { variantId } = await createVariant(true)
        const pool = await postPool(variantId)
        const poolId = pool.data.pool.id
        jest
          .spyOn(container.resolve(Modules.INVENTORY), "adjustInventory")
          .mockRejectedValueOnce(new MedusaError(MedusaError.Types.NOT_ALLOWED, "inventory down"))
        jest
          .spyOn(service, "deleteEvoucherCodes")
          .mockRejectedValueOnce(new Error("delete batch failed"))
        const logged = loggedErrors()

        const res = await importCsv(poolId, "X-1\nX-2\n")

        expect(res.status).toBe(400)
        expect(res.data.message).toBe("inventory down")
        const [row] = await service.listEvoucherCodes({ pool_id: poolId })
        const messages = logged.mock.calls.map((c) => String(c[0]))
        expect(messages).toEqual(
          expect.arrayContaining([
            expect.stringMatching(new RegExp(`${row.batch_ref}.*delete batch failed`)),
          ])
        )
      })

      it("returns the chunk insert error when its inline cleanup also fails", async () => {
        const { variantId } = await createVariant(true)
        const pool = await postPool(variantId)
        const poolId = pool.data.pool.id
        const original = service.createEvoucherCodes.bind(service)
        let calls = 0
        jest.spyOn(service, "createEvoucherCodes").mockImplementation((async (
          ...args: Parameters<typeof original>
        ) => {
          if (++calls === 2) {
            throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "db down on chunk 2")
          }
          return original(...args)
        }) as typeof original)
        jest
          .spyOn(service, "deleteEvoucherCodes")
          .mockRejectedValueOnce(new Error("delete batch failed"))
        const logged = loggedErrors()

        const csv = Array.from({ length: 1500 }, (_, i) => `CH-${10000 + i}`).join("\n")
        const res = await importCsv(poolId, csv)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe("db down on chunk 2")
        const [row] = await service.listEvoucherCodes({ pool_id: poolId })
        const messages = logged.mock.calls.map((c) => String(c[0]))
        expect(messages).toEqual(
          expect.arrayContaining([
            expect.stringMatching(new RegExp(`${row.batch_ref}.*delete batch failed`)),
          ])
        )
      })
    })
  },
})
