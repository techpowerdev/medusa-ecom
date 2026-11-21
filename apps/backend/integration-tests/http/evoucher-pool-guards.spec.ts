import { randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  createInventoryItemsWorkflow,
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import backfillEvoucherRequiresShipping from "../../src/migration-scripts/evoucher-requires-shipping"
import { EVOUCHER_MODULE } from "../../src/modules/evoucher"
import EvoucherModuleService from "../../src/modules/evoucher/service"

jest.setTimeout(180 * 1000)

// ต้องตั้งก่อน runner โหลด medusa-config (module evoucher อ่าน key จาก env)
process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

const ADMIN_EMAIL = "ev10-admin@example.com"
const ADMIN_PASSWORD = "ev10-test-password"

const csvForm = (content: string) => {
  const form = new FormData()
  form.append("file", new Blob([content], { type: "text/csv" }), "codes.csv")
  return form
}

type VariantSpec = { inventory_items?: { inventory_item_id: string; required_quantity: number }[] }

// EV-10: กฎข้อ 1 (ไม่มี shipping profile), 12 (void กับ reservation), 13 (วันที่มีจริง), 14 (inventory item เดียว), 15 (ลบ pool + backfill)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let service: EvoucherModuleService
    let adminHeaders: { headers: Record<string, string> }
    let locationId: string
    let profileIds: { digital: string; default: string }
    let partnerId: string
    let seq = 0

    beforeAll(async () => {
      container = getContainer()
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      await seedThailand({ container, args: [] })
      service = container.resolve(EVOUCHER_MODULE)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: locations } = await query.graph({ entity: "stock_location", fields: ["id"] })
      locationId = locations[0].id
      const { data: profiles } = await query.graph({
        entity: "shipping_profile",
        fields: ["id", "type"],
        filters: { type: ["digital", "default"] },
      })
      profileIds = {
        digital: profiles.find((p) => p.type === "digital")!.id,
        default: profiles.find((p) => p.type === "default")!.id,
      }
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

    const inventoryItemsOf = async (variantId: string) => {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: variantId },
      })
      return (data[0].inventory_items ?? []).map((i) => i!.inventory_item_id)
    }

    // shipping_profile_id ไม่ส่ง → product ไม่มี shipping profile (แบบที่ voucher ต้องเป็น — กฎข้อ 1)
    const createProduct = async (variants: VariantSpec[], shipping_profile_id?: string) => {
      const values = variants.map((_, i) => `v${i}`)
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: `EV-10 voucher ${++seq}`,
              ...(shipping_profile_id ? { shipping_profile_id } : {}),
              options: [{ title: "Value", values }],
              variants: variants.map((v, i) => ({
                title: values[i],
                options: { Value: values[i] },
                manage_inventory: true,
                ...v,
              })),
            },
          ],
        },
      })
      return result[0].variants.map((v) => v.id)
    }

    const createVoucherVariant = async (shipping_profile_id?: string) => {
      const [variantId] = await createProduct([{}], shipping_profile_id)
      const [inventoryItemId] = await inventoryItemsOf(variantId)
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            { inventory_item_id: inventoryItemId, location_id: locationId, stocked_quantity: 0 },
          ],
        },
      })
      return { variantId, inventoryItemId }
    }

    const createInventoryItem = async () => {
      const { result } = await createInventoryItemsWorkflow(container).run({
        input: { items: [{ sku: `EV10-ITEM-${++seq}` }] },
      })
      return result[0].id
    }

    const postPool = (variantId: string) =>
      api
        .post(
          "/admin/evoucher/pools",
          { partner_id: partnerId, variant_id: variantId, name: "Lotus 500", how_to_use: "แสดง code" },
          adminHeaders
        )
        .catch((e) => e.response)

    const importCsv = (poolId: string, content: string) =>
      api
        .post(`/admin/evoucher/pools/${poolId}/import`, csvForm(content), adminHeaders)
        .catch((e) => e.response)

    const requiresShipping = async (inventoryItemId: string) => {
      const item = await container
        .resolve(Modules.INVENTORY)
        .retrieveInventoryItem(inventoryItemId, { select: ["id", "requires_shipping"] })
      return item.requires_shipping
    }

    const level = async (inventoryItemId: string) => {
      const [row] = await container
        .resolve(Modules.INVENTORY)
        .listInventoryLevels({ inventory_item_id: inventoryItemId, location_id: locationId })
      return { stocked: Number(row.stocked_quantity), reserved: Number(row.reserved_quantity) }
    }

    const poolsOf = (variantId: string) => service.listEvoucherPools({ variant_id: variantId })

    describe("AC-11 voucher product must not have any shipping profile (rule 1)", () => {
      it.each(["digital", "default"] as const)(
        "rejects a product in the %s shipping profile with 400, no pool and an untouched inventory item",
        async (type) => {
          const { variantId, inventoryItemId } = await createVoucherVariant(profileIds[type])

          const res = await postPool(variantId)

          expect(res.status).toBe(400)
          expect(res.data.message).toMatch(/shipping profile/i)
          expect(await poolsOf(variantId)).toHaveLength(0)
          expect(await requiresShipping(inventoryItemId)).toBe(true)
        }
      )

      it("accepts the product after the admin clears its shipping profile as the error message says", async () => {
        const { variantId, inventoryItemId } = await createVoucherVariant(profileIds.digital)
        const rejected = await postPool(variantId)
        expect(rejected.data.message).toMatch(/shipping_profile_id: null/)
        const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "product_variant",
          fields: ["product_id"],
          filters: { id: variantId },
        })

        const cleared = await api.post(
          `/admin/products/${data[0].product_id}?fields=*shipping_profile`,
          { shipping_profile_id: null },
          adminHeaders
        )
        expect(cleared.data.product.shipping_profile ?? null).toBeNull()
        const res = await postPool(variantId)

        expect(res.status).toBe(200)
        expect(await requiresShipping(inventoryItemId)).toBe(false)
      })

      // ส่วน line item requires_shipping=false ของ product ที่ไม่มี profile: evoucher-hardening.spec.ts (AC-11 EV-8)
      it("creates the pool (200) for a product without a shipping profile", async () => {
        const { variantId, inventoryItemId } = await createVoucherVariant()

        const res = await postPool(variantId)

        expect(res.status).toBe(200)
        expect(await poolsOf(variantId)).toHaveLength(1)
        expect(await requiresShipping(inventoryItemId)).toBe(false)
      })
    })

    describe("AC-23 voucher variant needs exactly one unshared inventory item (rule 14)", () => {
      it("rejects a variant whose inventory item is shared with another variant", async () => {
        const itemId = await createInventoryItem()
        const [v1] = await createProduct([
          { inventory_items: [{ inventory_item_id: itemId, required_quantity: 1 }] },
          { inventory_items: [{ inventory_item_id: itemId, required_quantity: 1 }] },
        ])

        const res = await postPool(v1)

        expect(res.status).toBe(400)
        expect(res.data.message).toMatch(/shared|exactly one/i)
        expect(await poolsOf(v1)).toHaveLength(0)
        expect(await requiresShipping(itemId)).toBe(true)
      })

      it("rejects a variant with two inventory items", async () => {
        const a = await createInventoryItem()
        const b = await createInventoryItem()
        const [v1] = await createProduct([
          {
            inventory_items: [
              { inventory_item_id: a, required_quantity: 1 },
              { inventory_item_id: b, required_quantity: 1 },
            ],
          },
        ])

        const res = await postPool(v1)

        expect(res.status).toBe(400)
        expect(await poolsOf(v1)).toHaveLength(0)
        expect(await requiresShipping(a)).toBe(true)
        expect(await requiresShipping(b)).toBe(true)
      })

      it("rejects a variant whose inventory item has required_quantity > 1", async () => {
        const itemId = await createInventoryItem()
        const [v1] = await createProduct([
          { inventory_items: [{ inventory_item_id: itemId, required_quantity: 2 }] },
        ])

        const res = await postPool(v1)

        expect(res.status).toBe(400)
        expect(await poolsOf(v1)).toHaveLength(0)
        expect(await requiresShipping(itemId)).toBe(true)
      })
    })

    describe("AC-21 admin void respects reservations (rule 12)", () => {
      it("returns 409 EVOUCHER_CODE_RESERVED when all stock is reserved, then voids once a unit is free", async () => {
        const { variantId, inventoryItemId } = await createVoucherVariant()
        const pool = await postPool(variantId)
        const poolId = pool.data.pool.id
        await importCsv(poolId, "RSV-1\nRSV-2\n")
        const inventory = container.resolve(Modules.INVENTORY)
        const [reservation] = await inventory.createReservationItems([
          { inventory_item_id: inventoryItemId, location_id: locationId, quantity: 2 },
        ])
        const [code] = await service.listEvoucherCodes({ pool_id: poolId })
        const voidCode = () =>
          api
            .post(`/admin/evoucher/codes/${code.id}/void`, { reason: "partner recalled" }, adminHeaders)
            .catch((e) => e.response)

        const blocked = await voidCode()

        expect(blocked.status).toBe(409)
        expect(blocked.data).toEqual({
          type: "conflict",
          code: "EVOUCHER_CODE_RESERVED",
          message: expect.any(String),
        })
        expect((await service.retrieveEvoucherCode(code.id)).status).toBe("available")
        expect(await level(inventoryItemId)).toEqual({ stocked: 2, reserved: 2 })

        await inventory.updateReservationItems([{ id: reservation.id, quantity: 1 }])
        const ok = await voidCode()

        expect(ok.status).toBe(200)
        expect((await service.retrieveEvoucherCode(code.id)).status).toBe("void")
        expect(await level(inventoryItemId)).toEqual({ stocked: 1, reserved: 1 })
      })
      it("lets only one of two concurrent voids through when a single unit is free", async () => {
        const { variantId, inventoryItemId } = await createVoucherVariant()
        const pool = await postPool(variantId)
        const poolId = pool.data.pool.id
        await importCsv(poolId, "RACE-1\nRACE-2\n")
        await container
          .resolve(Modules.INVENTORY)
          .createReservationItems([
            { inventory_item_id: inventoryItemId, location_id: locationId, quantity: 1 },
          ])
        const codes = await service.listEvoucherCodes({ pool_id: poolId })

        const results = await Promise.all(
          codes.map((c) =>
            api
              .post(`/admin/evoucher/codes/${c.id}/void`, { reason: "partner recalled" }, adminHeaders)
              .catch((e) => e.response)
          )
        )

        expect(results.map((r) => r.status).sort()).toEqual([200, 409])
        expect(results.find((r) => r.status === 409)!.data.code).toBe("EVOUCHER_CODE_RESERVED")
        expect(await level(inventoryItemId)).toEqual({ stocked: 1, reserved: 1 })
        const statuses = (await service.listEvoucherCodes({ pool_id: poolId })).map((c) => c.status)
        expect(statuses.sort()).toEqual(["available", "void"])
      })
    })

    describe("AC-22 import rejects non-existent calendar dates (rule 13)", () => {
      it("fails the whole file with the line number and inserts nothing", async () => {
        const { variantId } = await createVoucherVariant()
        const pool = await postPool(variantId)
        const poolId = pool.data.pool.id

        const res = await importCsv(poolId, "code,expires_at\nD-1,2027-01-01\nD-2,2026-02-30\n")

        expect(res.status).toBe(400)
        expect(res.data.message).toMatch(/line 3/)
        expect(await service.listEvoucherCodes({ pool_id: poolId })).toHaveLength(0)
      })
    })

    describe("AC-24 deleting a pool restores requires_shipping + backfill script (rule 15)", () => {
      it("sets requires_shipping=true when an empty pool is deleted", async () => {
        const { variantId, inventoryItemId } = await createVoucherVariant()
        const pool = await postPool(variantId)
        expect(await requiresShipping(inventoryItemId)).toBe(false)

        const res = await api.delete(`/admin/evoucher/pools/${pool.data.pool.id}`, adminHeaders)

        expect(res.status).toBe(200)
        expect(await requiresShipping(inventoryItemId)).toBe(true)
      })

      it("backfills pools created before EV-8 to requires_shipping=false, idempotently, leaving other items alone", async () => {
        const legacy = await createVoucherVariant()
        const other = await createVoucherVariant()
        // pool ก่อน EV-8: สร้างตรงใน module (ไม่ผ่าน workflow) → inventory item ยัง requires_shipping=true
        await service.createEvoucherPools({
          partner_id: partnerId,
          variant_id: legacy.variantId,
          name: "Legacy",
          how_to_use: "แสดง code",
        })
        expect(await requiresShipping(legacy.inventoryItemId)).toBe(true)

        await backfillEvoucherRequiresShipping({ container })
        await backfillEvoucherRequiresShipping({ container })

        expect(await requiresShipping(legacy.inventoryItemId)).toBe(false)
        expect(await requiresShipping(other.inventoryItemId)).toBe(true)
      })
    })

    // EV-20 (spec 02 กฎข้อ 36): ลบ pool ได้เมื่อยังไม่มี code ถูกส่ง/จองให้ลูกค้า → code ลบตาม + stock ลด
    describe("AC-50 deleting a pool whose codes were never issued (rule 36)", () => {
      const NOT_ALLOWED = "Pool has codes that were allocated or delivered to customers; it cannot be deleted"
      const RESERVED =
        "Pool has orders awaiting payment or code delivery (reserved stock); it cannot be deleted until they are completed or canceled"

      const deletePool = (poolId: string) =>
        api.delete(`/admin/evoucher/pools/${poolId}`, adminHeaders).catch((e) => e.response)

      const codesOf = (poolId: string) =>
        service.listEvoucherCodes({ pool_id: poolId }, { withDeleted: true, take: null })

      // 5 available + 1 void (void ผ่าน admin route → stock ลดตามกฎข้อ 1) → stocked 5
      const poolWithUnissuedCodes = async () => {
        const voucher = await createVoucherVariant()
        const pool = await postPool(voucher.variantId)
        const poolId: string = pool.data.pool.id
        await importCsv(poolId, "U-1\nU-2\nU-3\nU-4\nU-5\nU-6\n")
        const [code] = await service.listEvoucherCodes({ pool_id: poolId })
        await api.post(`/admin/evoucher/codes/${code.id}/void`, { reason: "partner recalled" }, adminHeaders)
        expect(await level(voucher.inventoryItemId)).toEqual({ stocked: 5, reserved: 0 })
        return { ...voucher, poolId }
      }

      it("(a) soft-deletes every available/void code, lowers stock by the available count and restores requires_shipping", async () => {
        const { poolId, inventoryItemId, variantId } = await poolWithUnissuedCodes()

        const res = await deletePool(poolId)

        expect(res.status).toBe(200)
        expect(res.data).toEqual({ id: poolId, object: "evoucher_pool", deleted: true })
        const codes = await codesOf(poolId)
        expect(codes).toHaveLength(6)
        expect(codes.every((c) => c.deleted_at)).toBe(true)
        expect(await level(inventoryItemId)).toEqual({ stocked: 0, reserved: 0 })
        expect(await requiresShipping(inventoryItemId)).toBe(true)
        expect(await poolsOf(variantId)).toHaveLength(0)
      })

      it.each([
        ["delivered", { status: "delivered" as const, order_id: "order_ev20" }],
        ["void with an order_id", { status: "void" as const, order_id: "order_ev20" }],
      ])("(b) refuses (400) when a code is %s and changes nothing", async (_, update) => {
        const { poolId, inventoryItemId, variantId } = await poolWithUnissuedCodes()
        const [code] = await service.listEvoucherCodes({ pool_id: poolId, status: "available" })
        await service.updateEvoucherCodes({ id: code.id, ...update })

        const res = await deletePool(poolId)

        expect(res.status).toBe(400)
        expect(res.data).toMatchObject({ type: "not_allowed", message: NOT_ALLOWED })
        const codes = await codesOf(poolId)
        expect(codes).toHaveLength(6)
        expect(codes.some((c) => c.deleted_at)).toBe(false)
        expect(await level(inventoryItemId)).toEqual({ stocked: 5, reserved: 0 })
        expect(await requiresShipping(inventoryItemId)).toBe(false)
        expect(await poolsOf(variantId)).toHaveLength(1)
      })

      // session หลักตัดสิน 2026-11-21: reservation ค้าง = order ที่รอชำระ/รอส่งรหัสจาก pool นี้ → ลบไม่ได้ (แบบกฎข้อ 12)
      it("(e) refuses (400) while stock is reserved by orders awaiting payment or code delivery and changes nothing", async () => {
        const { poolId, inventoryItemId, variantId } = await poolWithUnissuedCodes()
        const inventory = container.resolve(Modules.INVENTORY)
        const [reservation] = await inventory.createReservationItems([
          { inventory_item_id: inventoryItemId, location_id: locationId, quantity: 1 },
        ])

        const res = await deletePool(poolId)

        expect(res.status).toBe(400)
        expect(res.data).toMatchObject({ type: "not_allowed", message: RESERVED })
        const codes = await codesOf(poolId)
        expect(codes).toHaveLength(6)
        expect(codes.some((c) => c.deleted_at)).toBe(false)
        expect(await level(inventoryItemId)).toEqual({ stocked: 5, reserved: 1 })
        expect(await requiresShipping(inventoryItemId)).toBe(false)
        expect(await poolsOf(variantId)).toHaveLength(1)

        await inventory.deleteReservationItems([reservation.id])
        expect((await deletePool(poolId)).status).toBe(200)
      })

      it("(c) restores the codes and the pool when the stock adjustment fails", async () => {
        const { poolId, inventoryItemId, variantId } = await poolWithUnissuedCodes()
        const inventory = container.resolve(Modules.INVENTORY)
        const spy = jest.spyOn(inventory, "adjustInventory").mockRejectedValueOnce(new Error("inventory down"))
        let res: { status: number }
        try {
          res = await deletePool(poolId)
          expect(spy.mock.calls[0][0]).toEqual([expect.objectContaining({ inventoryItemId, adjustment: -5 })])
        } finally {
          spy.mockRestore()
        }

        expect(res.status).toBeGreaterThanOrEqual(400)
        const codes = await codesOf(poolId)
        expect(codes).toHaveLength(6)
        expect(codes.some((c) => c.deleted_at)).toBe(false)
        expect(codes.map((c) => c.status).sort()).toEqual([...Array(5).fill("available"), "void"])
        expect(await level(inventoryItemId)).toEqual({ stocked: 5, reserved: 0 })
        expect(await requiresShipping(inventoryItemId)).toBe(false)
        expect(await poolsOf(variantId)).toHaveLength(1)
      })

      it("(d) reports total_codes and low_stock=false for a pool without codes", async () => {
        const empty = await postPool((await createVoucherVariant()).variantId)
        const stocked = await postPool((await createVoucherVariant()).variantId)
        await importCsv(stocked.data.pool.id, "L-1\nL-2\nL-3\nL-4\nL-5\n")

        const one = await api.get(`/admin/evoucher/pools/${empty.data.pool.id}?fields=id`, adminHeaders)
        const list = await api.get("/admin/evoucher/pools?fields=id,name", adminHeaders)

        expect(one.data.pool).toMatchObject({ low_stock: false, total_codes: 0 })
        const byId = Object.fromEntries(list.data.pools.map((p: { id: string }) => [p.id, p]))
        expect(byId[empty.data.pool.id]).toMatchObject({ low_stock: false, total_codes: 0 })
        expect(byId[stocked.data.pool.id]).toMatchObject({ low_stock: true, total_codes: 5 })
      })

      // กันลบพร้อมการขาย: ผลลัพธ์ต้องเป็นอย่างใดอย่างหนึ่ง — ลบสำเร็จและ order backordered หรือ order ได้ code และลบไม่ได้
      it("never deletes a code that a concurrent allocation claimed", async () => {
        const { poolId } = await poolWithUnissuedCodes()
        const claim = () =>
          service.claimCodesForOrder({
            order_id: "order_ev20_race",
            items: [{ line_item_id: "ordli_ev20_race", pool_id: poolId, quantity: 5 }],
            expires_after: new Date(),
          })

        const [res, claimed] = await Promise.all([deletePool(poolId), claim()])

        const codes = await codesOf(poolId)
        if (res.status === 200) {
          expect(claimed.backordered).toEqual(["ordli_ev20_race"])
          expect(codes.every((c) => c.deleted_at)).toBe(true)
        } else {
          expect(res.status).toBe(400)
          expect(claimed.allocated).toHaveLength(1)
          expect(codes.filter((c) => c.status === "allocated" && !c.deleted_at)).toHaveLength(5)
        }
      })
    })
  },
})
