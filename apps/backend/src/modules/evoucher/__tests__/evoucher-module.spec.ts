import { randomBytes } from "node:crypto"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { EVOUCHER_MODULE } from ".."
import EvoucherPartner from "../models/evoucher-partner"
import EvoucherPool from "../models/evoucher-pool"
import EvoucherCode from "../models/evoucher-code"
import EvoucherModuleService from "../service"

jest.setTimeout(60 * 1000)

const ENCRYPTION_KEY = randomBytes(32).toString("hex")

moduleIntegrationTestRunner<EvoucherModuleService>({
  moduleName: EVOUCHER_MODULE,
  moduleModels: [EvoucherPartner, EvoucherPool, EvoucherCode],
  moduleOptions: { encryptionKey: ENCRYPTION_KEY },
  resolve: "./src/modules/evoucher",
  testSuite: ({ service }) => {
    const createPool = async (variant_id: string) => {
      const partner = await service.createEvoucherPartners({ name: "Lotus" })
      return service.createEvoucherPools({
        partner_id: partner.id,
        variant_id,
        name: "Lotus 500 THB",
        how_to_use: "แสดง code ที่แคชเชียร์",
      })
    }

    it("creates partner and pool with spec defaults", async () => {
      const pool = await createPool("variant_1")
      const [found] = await service.listEvoucherPools(
        { id: pool.id },
        { relations: ["partner"] }
      )
      expect(found).toMatchObject({
        variant_id: "variant_1",
        low_stock_threshold: 20,
        face_value: null,
        validity_note: null,
        partner: expect.objectContaining({ name: "Lotus", logo_url: null }),
      })
    })

    it("allows only one pool per variant", async () => {
      await createPool("variant_dup")
      await expect(createPool("variant_dup")).rejects.toThrow()
    })

    it("stores code/pin encrypted and defaults status to available", async () => {
      const pool = await createPool("variant_2")
      const created = await service.createEvoucherCodes({
        pool_id: pool.id,
        code: await service.encryptCode("LOTUS-0001"),
        pin: await service.encryptPin("9876"),
        batch_ref: "batch_1",
      })
      const code = await service.retrieveEvoucherCode(created.id)
      expect(code.status).toBe("available")
      expect(code.code).not.toContain("LOTUS-0001")
      expect(code.pin).not.toContain("9876")
      expect(await service.decryptSecret(code.code)).toBe("LOTUS-0001")
      expect(await service.decryptSecret(code.pin!)).toBe("9876")
    })

    it("rejects the same code twice in a pool but allows it in another pool", async () => {
      const poolA = await createPool("variant_a")
      const poolB = await createPool("variant_b")
      const row = async (pool_id: string) => ({
        pool_id,
        code: await service.encryptCode("SAME-CODE"),
        batch_ref: "batch_1",
      })
      await service.createEvoucherCodes(await row(poolA.id))
      await expect(service.createEvoucherCodes(await row(poolA.id))).rejects.toThrow()
      await expect(service.createEvoucherCodes(await row(poolB.id))).resolves.toBeTruthy()
    })

    it("lists codes by pool and status", async () => {
      const pool = await createPool("variant_3")
      await service.createEvoucherCodes([
        { pool_id: pool.id, code: await service.encryptCode("C1"), batch_ref: "b" },
        {
          pool_id: pool.id,
          code: await service.encryptCode("C2"),
          batch_ref: "b",
          status: "delivered",
          order_id: "order_1",
          delivered_to_email: "a@example.com",
        },
      ])
      const available = await service.listEvoucherCodes({
        pool_id: pool.id,
        status: "available",
      })
      expect(available).toHaveLength(1)
      expect(await service.decryptSecret(available[0].code)).toBe("C1")
    })
  },
})

moduleIntegrationTestRunner<EvoucherModuleService>({
  moduleName: EVOUCHER_MODULE,
  moduleModels: [EvoucherPartner, EvoucherPool, EvoucherCode],
  moduleOptions: {},
  resolve: "./src/modules/evoucher",
  testSuite: ({ service }) => {
    it("throws a clear error when the encryption key is not configured", async () => {
      await expect(service.encryptCode("X")).rejects.toThrow(
        /EVOUCHER_ENCRYPTION_KEY/
      )
    })
  },
})
