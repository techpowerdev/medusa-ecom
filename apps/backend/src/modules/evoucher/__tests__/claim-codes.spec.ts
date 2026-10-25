import { randomBytes } from "node:crypto"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { EVOUCHER_MODULE } from ".."
import EvoucherPartner from "../models/evoucher-partner"
import EvoucherPool from "../models/evoucher-pool"
import EvoucherCode from "../models/evoucher-code"
import EvoucherCodeReveal from "../models/evoucher-code-reveal"
import EvoucherModuleService from "../service"

jest.setTimeout(60 * 1000)

const DAY = 24 * 60 * 60 * 1000
const inDays = (days: number) => new Date(Date.now() + days * DAY)

// EV-4: claim code แบบ atomic (FOR UPDATE SKIP LOCKED) — AC-4 (พร้อมกัน), AC-7 (ซ้ำ), กฎข้อ 2 (expiry)
moduleIntegrationTestRunner<EvoucherModuleService>({
  moduleName: EVOUCHER_MODULE,
  moduleModels: [EvoucherPartner, EvoucherPool, EvoucherCode, EvoucherCodeReveal],
  moduleOptions: { encryptionKey: randomBytes(32).toString("hex") },
  resolve: "./src/modules/evoucher",
  testSuite: ({ service }) => {
    let poolId: string
    let seq = 0

    beforeEach(async () => {
      const partner = await service.createEvoucherPartners({ name: "Lotus" })
      const pool = await service.createEvoucherPools({
        partner_id: partner.id,
        variant_id: `variant_${++seq}`,
        name: "Lotus 500",
        how_to_use: "แสดง code",
      })
      poolId = pool.id
    })

    const addCodes = async (rows: { code: string; expires_at?: Date | null; status?: "void" }[]) =>
      service.createEvoucherCodes(
        await Promise.all(
          rows.map(async (r) => ({
            pool_id: poolId,
            code: await service.encryptCode(r.code),
            expires_at: r.expires_at ?? null,
            status: r.status ?? ("available" as const),
            batch_ref: "batch_1",
          }))
        )
      )

    const claim = (order_id: string, quantity: number, line_item_id = `${order_id}_line`) =>
      service.claimCodesForOrder({
        order_id,
        customer_id: "cus_1",
        items: [{ line_item_id, pool_id: poolId, quantity }],
        expires_after: inDays(7),
      })

    const plain = async (ids: string[]) => {
      const rows = await service.listEvoucherCodes({ id: ids })
      return (await Promise.all(rows.map((r) => service.decryptSecret(r.code)))).sort()
    }

    it("claims the earliest-expiring usable codes and records order, line item and customer", async () => {
      await addCodes([
        { code: "SOON", expires_at: inDays(3) },
        { code: "NOEXP", expires_at: null },
        { code: "LATE", expires_at: inDays(60) },
        { code: "EARLY", expires_at: inDays(10) },
        { code: "VOID", expires_at: inDays(8), status: "void" },
      ])

      const result = await claim("order_1", 2)

      expect(result.backordered).toEqual([])
      expect(result.skipped).toEqual([])
      expect(result.allocated).toEqual([
        { line_item_id: "order_1_line", code_ids: expect.any(Array) },
      ])
      const ids = result.allocated[0].code_ids
      expect(await plain(ids)).toEqual(["EARLY", "LATE"])
      const rows = await service.listEvoucherCodes({ id: ids })
      for (const row of rows) {
        expect(row).toMatchObject({
          status: "allocated",
          order_id: "order_1",
          order_line_item_id: "order_1_line",
          customer_id: "cus_1",
          allocated_at: expect.any(Date),
        })
      }
    })

    it("backorders the whole line item without touching codes when there are not enough", async () => {
      await addCodes([{ code: "ONLY" }, { code: "SOON", expires_at: inDays(2) }])

      const result = await claim("order_1", 2)

      expect(result).toEqual({ allocated: [], backordered: ["order_1_line"], skipped: [] })
      const rows = await service.listEvoucherCodes({ pool_id: poolId })
      expect(rows.map((r) => r.status)).toEqual(["available", "available"])
    })

    it("skips line items that already have codes (AC-7 idempotent)", async () => {
      await addCodes([{ code: "A" }, { code: "B" }, { code: "C" }])
      await claim("order_1", 1)

      const again = await claim("order_1", 1)

      expect(again).toEqual({ allocated: [], backordered: [], skipped: ["order_1_line"] })
      expect(await service.listEvoucherCodes({ order_id: "order_1" })).toHaveLength(1)
    })

    it("AC-4 gives each code to exactly one order when many orders claim concurrently", async () => {
      await addCodes([{ code: "C-1" }, { code: "C-2" }, { code: "C-3" }])
      const orders = Array.from({ length: 10 }, (_, i) => `order_${i}`)

      const results = await Promise.all(orders.map((o) => claim(o, 1)))

      const allocated = results.flatMap((r) => r.allocated)
      expect(allocated).toHaveLength(3)
      expect(results.flatMap((r) => r.backordered)).toHaveLength(7)
      const rows = await service.listEvoucherCodes({ pool_id: poolId })
      expect(rows.map((r) => r.status)).toEqual(["allocated", "allocated", "allocated"])
      expect(new Set(rows.map((r) => r.order_line_item_id))).toEqual(
        new Set(allocated.map((a) => a.line_item_id))
      )
      expect(allocated.flatMap((a) => a.code_ids).sort()).toEqual(rows.map((r) => r.id).sort())
    })

    it("does not allocate the same line item twice when the same order is claimed concurrently", async () => {
      await addCodes([{ code: "A" }, { code: "B" }])

      const results = await Promise.all([claim("order_1", 1), claim("order_1", 1)])

      expect(results.flatMap((r) => r.allocated)).toHaveLength(1)
      expect(results.flatMap((r) => r.skipped)).toEqual(["order_1_line"])
      expect(await service.listEvoucherCodes({ order_id: "order_1" })).toHaveLength(1)
    })

    it("never lets a concurrent void (EV-5) and an allocation both take the same code", async () => {
      await addCodes([{ code: "LAST" }])

      const [claimed, voided] = await Promise.all([
        claim("order_1", 1),
        service.voidAvailableCodes({ pool_id: poolId }, "partner recalled"),
      ])

      expect(claimed.allocated.length + voided.length).toBe(1)
      const [row] = await service.listEvoucherCodes({ pool_id: poolId })
      expect(row.status).toBe(claimed.allocated.length ? "allocated" : "void")
      expect(row.void_reason).toBe(claimed.allocated.length ? null : "partner recalled")
    })
  },
})
