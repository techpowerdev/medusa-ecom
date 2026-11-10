import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { EVOUCHER_MODULE } from "../../src/modules/evoucher"
import EvoucherModuleService from "../../src/modules/evoucher/service"

jest.setTimeout(120 * 1000)

// EV-1: link evoucher_pool <-> product_variant (read-only ผ่าน evoucher_pool.variant_id)
// EV-9: link evoucher_code <-> order (read-only ผ่าน evoucher_code.order_id, AC-16)
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    let variantId: string
    let poolId: string

    beforeEach(async () => {
      const container = getContainer()
      const productService = container.resolve(Modules.PRODUCT)
      const evoucherService: EvoucherModuleService =
        container.resolve(EVOUCHER_MODULE)

      const product = await productService.createProducts({
        title: "Lotus e-voucher 500 THB",
        options: [{ title: "Value", values: ["500"] }],
        variants: [{ title: "500 THB", options: { Value: "500" } }],
      })
      variantId = product.variants[0].id

      const partner = await evoucherService.createEvoucherPartners({
        name: "Lotus",
      })
      const pool = await evoucherService.createEvoucherPools({
        partner_id: partner.id,
        variant_id: variantId,
        name: "Lotus 500 THB",
        how_to_use: "แสดง code ที่แคชเชียร์",
      })
      poolId = pool.id
    })

    it("queries the variant from a pool", async () => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "evoucher_pool",
        fields: ["id", "product_variant.id", "product_variant.title"],
        filters: { id: poolId },
      })
      expect(data[0].product_variant).toMatchObject({
        id: variantId,
        title: "500 THB",
      })
    })

    it("queries the pool from a variant", async () => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product_variant",
        fields: ["id", "evoucher_pool.id", "evoucher_pool.partner.name"],
        filters: { id: variantId },
      })
      expect(data[0].evoucher_pool).toMatchObject({
        id: poolId,
        partner: { name: "Lotus" },
      })
    })

    it("AC-16: queries an order's allocated codes and the order from a code", async () => {
      const container = getContainer()
      const evoucherService: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
      // สร้างทีละตัว: createOrders/createEvoucherCodes แบบ array ไม่รับประกันลำดับผลตาม input
      const orderModule = container.resolve(Modules.ORDER)
      const orderA = await orderModule.createOrders({ currency_code: "thb", email: "a@example.com" })
      const orderB = await orderModule.createOrders({ currency_code: "thb", email: "b@example.com" })
      const codeA = await evoucherService.createEvoucherCodes({
        pool_id: poolId, code: "enc-a", batch_ref: "b1", status: "allocated", order_id: orderA.id,
      })
      const codeB = await evoucherService.createEvoucherCodes({
        pool_id: poolId, code: "enc-b", batch_ref: "b1", status: "delivered", order_id: orderB.id,
      })

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "order",
        fields: ["id", "evoucher_codes.id"],
        filters: { id: orderA.id },
      })
      expect(data[0].evoucher_codes?.map((c: { id: string } | null) => c?.id)).toEqual([codeA.id])

      const { data: codes } = await query.graph({
        entity: "evoucher_code",
        fields: ["id", "order.id", "order.email"],
        filters: { id: codeB.id },
      })
      expect(codes[0].order).toMatchObject({ id: orderB.id, email: "b@example.com" })
    })
  },
})
