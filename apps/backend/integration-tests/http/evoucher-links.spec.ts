import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { EVOUCHER_MODULE } from "../../src/modules/evoucher"
import EvoucherModuleService from "../../src/modules/evoucher/service"

jest.setTimeout(120 * 1000)

// EV-1: link evoucher_pool <-> product_variant (read-only ผ่าน evoucher_pool.variant_id)
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
  },
})
