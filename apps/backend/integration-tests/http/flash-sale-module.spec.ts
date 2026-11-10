import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { FLASH_SALE_MODULE } from "../../src/modules/flash_sale"
import FlashSaleModuleService from "../../src/modules/flash_sale/service"

jest.setTimeout(60 * 1000)

// FS-1: module flash_sale ถูก register ในแอป และ link flash_sale_config → promotion campaign ใช้ผ่าน Query ได้
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    it("resolves flash_sale_config together with its Medusa campaign via query.graph", async () => {
      const container = getContainer()
      const promotionModule = container.resolve(Modules.PROMOTION)
      const flashSaleModule: FlashSaleModuleService =
        container.resolve(FLASH_SALE_MODULE)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)

      const campaign = await promotionModule.createCampaigns({
        name: "Flash 11.11",
        campaign_identifier: "FLASH-1111",
        starts_at: new Date("2026-11-11T00:00:00Z"),
        ends_at: new Date("2026-11-11T02:00:00Z"),
      })
      const config = await flashSaleModule.createFlashSaleConfigs({
        campaign_id: campaign.id,
        per_customer_limit: 2,
      })

      const { data } = await query.graph({
        entity: "flash_sale_config",
        fields: ["id", "per_customer_limit", "campaign.id", "campaign.name"],
        filters: { id: config.id },
      })

      expect(data).toEqual([
        expect.objectContaining({
          id: config.id,
          per_customer_limit: 2,
          campaign: expect.objectContaining({
            id: campaign.id,
            name: "Flash 11.11",
          }),
        }),
      ])
    })
  },
})
