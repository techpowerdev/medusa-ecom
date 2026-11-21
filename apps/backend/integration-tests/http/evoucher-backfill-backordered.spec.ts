import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import backfillScript, { backfillEvoucherBackorderedFlags } from "../../src/scripts/backfill-evoucher-backordered-flags"
import { createAdminUser } from "../helpers/admin"

jest.setTimeout(120 * 1000)

// EV-25 (spec 02 กฎข้อ 41, AC-55): order ก่อน EV-22 มีธง `evoucher_backordered` แค่ใน order_line_item.metadata
// → script `medusa exec ./src/scripts/backfill-evoucher-backordered-flags.ts [--apply]` เขียนธงลง order_item ด้วย helper เดียวกับ EV-22

type AdminItem = { id: string; metadata: Record<string, unknown> | null }

/** จำลองข้อมูลก่อน EV-22: order_item.metadata = {} (เหมือน order จาก cart) และตั้งธงที่ line item เท่านั้น */
async function legacyBackorderedOrder(container: MedusaContainer) {
  const orderModule = container.resolve(Modules.ORDER)
  const [order] = await orderModule.createOrders([
    {
      currency_code: "thb",
      email: "ev25@x.test",
      items: [
        { title: "Voucher A", quantity: 1, unit_price: 100, metadata: {} },
        { title: "Voucher B", quantity: 1, unit_price: 100, metadata: { note: "keep" } },
      ],
    },
  ])
  const { items } = await orderModule.retrieveOrder(order.id, { relations: ["items"] })
  const lineA = items!.find((i) => i.title === "Voucher A")!
  const lineB = items!.find((i) => i.title === "Voucher B")!
  await orderModule.updateOrderLineItems(lineA.id, { metadata: { evoucher_backordered: true } })
  return { orderId: order.id, displayId: order.display_id, lineA: lineA.id, lineB: lineB.id }
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("AC-55 script backfill-evoucher-backordered-flags", () => {
      let container: MedusaContainer
      let adminHeaders: { headers: Record<string, string> }

      const adminItems = async (orderId: string) => {
        try {
          const { data } = await api.get(`/admin/orders/${orderId}?fields=*items`, adminHeaders)
          return new Map<string, AdminItem>((data.order.items as AdminItem[]).map((item) => [item.id, item]))
        } catch (error: any) {
          throw new Error(`${error?.response?.status} ${JSON.stringify(error?.response?.data)}`)
        }
      }

      beforeEach(async () => {
        container = getContainer()
        adminHeaders = { headers: (await createAdminUser(container, "ev25-admin@x.test")).headers }
      })

      afterEach(() => {
        jest.restoreAllMocks()
      })

      it("dry-run lists the legacy line only, apply exposes the flag on the admin API, and a rerun finds 0", async () => {
        const { orderId, displayId, lineA, lineB } = await legacyBackorderedOrder(container)
        const before = await adminItems(orderId)
        expect(before.get(lineA)!.metadata?.evoucher_backordered).toBeFalsy()

        // dry-run (ค่าเริ่มต้น): พิมพ์ 1 แถว ไม่เขียน DB
        const info = jest.spyOn(container.resolve(ContainerRegistrationKeys.LOGGER), "info")
        await backfillScript({ container, args: [] })
        const printed = info.mock.calls.map(([message]) => String(message))
        expect(printed.filter((m) => m.includes(lineA))).toHaveLength(1)
        expect(printed.some((m) => m.includes(lineB))).toBe(false)
        expect(printed.some((m) => m.includes(orderId))).toBe(true)
        expect(printed.some((m) => m.includes(`order #${displayId} (${orderId})`))).toBe(true)
        expect((await adminItems(orderId)).get(lineA)!.metadata?.evoucher_backordered).toBeFalsy()

        // --apply: ธงขึ้นใน GET /admin/orders/:id?fields=*items; line ที่ไม่มีธงไม่ถูกแตะ
        const write = jest.spyOn(container.resolve(Modules.ORDER), "updateOrderItem")
        await backfillScript({ container, args: ["--apply"] })
        const after = await adminItems(orderId)
        expect(after.get(lineA)!.metadata).toMatchObject({ evoucher_backordered: true })
        expect(after.get(lineB)!.metadata).toEqual(before.get(lineB)!.metadata)
        expect(after.get(lineB)!.metadata?.evoucher_backordered).toBeUndefined()
        expect(write).toHaveBeenCalledTimes(1)
        expect(write.mock.calls[0]![0]).toEqual({ item_id: lineA })

        // รันซ้ำ → 0 แถว ไม่เขียนเพิ่ม
        expect(await backfillEvoucherBackorderedFlags(container, { apply: false })).toEqual({ lines: [], applied: 0, remaining: 0 })
        expect(await backfillEvoucherBackorderedFlags(container, { apply: true })).toEqual({ lines: [], applied: 0, remaining: 0 })
        expect(write).toHaveBeenCalledTimes(1)
      })

      it("reports the before/after counts of --apply", async () => {
        const first = await legacyBackorderedOrder(container)
        const second = await legacyBackorderedOrder(container)

        const result = await backfillEvoucherBackorderedFlags(container, { apply: true })

        expect(result.applied).toBe(2)
        expect(result.remaining).toBe(0)
        expect(result.lines.map((l) => l.line_item_id).sort()).toEqual([first.lineA, second.lineA].sort())
        expect(result.lines.map((l) => l.order_id).sort()).toEqual([first.orderId, second.orderId].sort())
      })
    })
  },
})
