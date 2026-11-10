import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { FLASH_SALE_MODULE } from ".."
import FlashSaleConfig from "../models/flash-sale-config"
import FlashSaleUsage from "../models/flash-sale-usage"
import FlashSaleModuleService from "../service"

jest.setTimeout(60 * 1000)

// FS-1: data layer ของ module flash_sale (spec 03 "Data model", docs/design/data-model.md)
moduleIntegrationTestRunner<FlashSaleModuleService>({
  moduleName: FLASH_SALE_MODULE,
  moduleModels: [FlashSaleConfig, FlashSaleUsage],
  resolve: "./src/modules/flash_sale",
  testSuite: ({ service }) => {
    describe("FlashSaleConfig", () => {
      it("creates a config with defaults (units_sold=0, flags off, nullable limits)", async () => {
        const config = await service.createFlashSaleConfigs({
          campaign_id: "procamp_1",
        })

        expect(config).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^fsconf_/),
            campaign_id: "procamp_1",
            per_customer_limit: null,
            total_cap: null,
            units_sold: 0,
            show_countdown: false,
            show_remaining: false,
            banner_text: null,
          })
        )
      })

      it("stores the flash options set by admin", async () => {
        const config = await service.createFlashSaleConfigs({
          campaign_id: "procamp_2",
          per_customer_limit: 2,
          total_cap: 10,
          show_countdown: true,
          show_remaining: true,
          banner_text: "Flash 11.11",
        })

        const [fetched] = await service.listFlashSaleConfigs({
          campaign_id: "procamp_2",
        })
        expect(fetched).toEqual(
          expect.objectContaining({
            id: config.id,
            per_customer_limit: 2,
            total_cap: 10,
            units_sold: 0,
            show_countdown: true,
            show_remaining: true,
            banner_text: "Flash 11.11",
          })
        )
      })

      it("allows only one config per campaign", async () => {
        await service.createFlashSaleConfigs({ campaign_id: "procamp_dup" })

        await expect(
          service.createFlashSaleConfigs({ campaign_id: "procamp_dup" })
        ).rejects.toThrow()
      })

      it.each([
        ["units_sold", { units_sold: -1 }],
        ["per_customer_limit", { per_customer_limit: 0 }],
        ["total_cap", { total_cap: 0 }],
      ])("rejects invalid %s at the database level", async (_field, data) => {
        await expect(
          service.createFlashSaleConfigs({ campaign_id: "procamp_bad", ...data })
        ).rejects.toThrow()
      })
    })

    describe("FlashSaleUsage", () => {
      it("creates a usage row with units defaulting to 0", async () => {
        const usage = await service.createFlashSaleUsages({
          campaign_id: "procamp_1",
          customer_id: "cus_1",
        })

        expect(usage).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^fsuse_/),
            campaign_id: "procamp_1",
            customer_id: "cus_1",
            units: 0,
          })
        )
      })

      it("allows only one usage row per (campaign_id, customer_id)", async () => {
        await service.createFlashSaleUsages({
          campaign_id: "procamp_1",
          customer_id: "cus_1",
          units: 1,
        })

        await expect(
          service.createFlashSaleUsages({
            campaign_id: "procamp_1",
            customer_id: "cus_1",
            units: 1,
          })
        ).rejects.toThrow()
      })

      it("allows the same customer in other campaigns and other customers in the same campaign", async () => {
        await service.createFlashSaleUsages([
          { campaign_id: "procamp_1", customer_id: "cus_1", units: 1 },
          { campaign_id: "procamp_2", customer_id: "cus_1", units: 2 },
          { campaign_id: "procamp_1", customer_id: "cus_2", units: 3 },
        ])

        const usages = await service.listFlashSaleUsages({
          campaign_id: "procamp_1",
        })
        expect(
          usages.map((u) => [u.customer_id, u.units]).sort()
        ).toEqual([
          ["cus_1", 1],
          ["cus_2", 3],
        ])
      })

      it("rejects negative units at the database level", async () => {
        await expect(
          service.createFlashSaleUsages({
            campaign_id: "procamp_1",
            customer_id: "cus_neg",
            units: -1,
          })
        ).rejects.toThrow()
      })
    })
  },
})
