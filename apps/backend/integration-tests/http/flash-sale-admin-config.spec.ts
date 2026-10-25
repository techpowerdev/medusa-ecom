import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  ContainerRegistrationKeys,
  generateJwtToken,
  Modules,
} from "@medusajs/framework/utils"
import { FLASH_SALE_MODULE } from "../../src/modules/flash_sale"
import FlashSaleModuleService from "../../src/modules/flash_sale/service"
import {
  EXCLUSIVITY_CODE_APPLIED_ATTRIBUTE,
  exclusiveAutomaticRule,
} from "../../src/lib/promotion-exclusivity"

jest.setTimeout(120 * 1000)

// FS-5: GET/POST /admin/flash-sales/:campaign_id/config (spec 03 กฎข้อ 7, 12, AC-11 a)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let campaignId: string
    const promo: Record<string, string> = {}

    const applicationMethod = {
      type: "percentage" as const,
      target_type: "order" as const,
      allocation: "across" as const,
      value: 10,
    }

    const exclusivityRuleCount = async (promotionId: string) => {
      const promotionModule = getContainer().resolve(Modules.PROMOTION)
      const promotion = await promotionModule.retrievePromotion(promotionId, {
        relations: ["rules", "rules.values"],
      })
      return (promotion.rules ?? []).filter(
        (r) => r.attribute === EXCLUSIVITY_CODE_APPLIED_ATTRIBUTE
      ).length
    }

    const configUrl = () => `/admin/flash-sales/${campaignId}/config`

    beforeEach(async () => {
      const container = getContainer()
      const userModule = container.resolve(Modules.USER)
      const authModule = container.resolve(Modules.AUTH)
      const user = await userModule.createUsers({ email: "fs5-admin@example.com" })
      const identity = await authModule.createAuthIdentities({
        provider_identities: [{ provider: "emailpass", entity_id: "fs5-admin@example.com" }],
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

      const promotionModule = container.resolve(Modules.PROMOTION)
      const campaign = await promotionModule.createCampaigns({
        name: "Flash 11.11",
        campaign_identifier: "FS5-FLASH-1111",
        starts_at: new Date("2026-11-11T00:00:00Z"),
        ends_at: new Date("2026-11-11T02:00:00Z"),
      })
      campaignId = campaign.id

      const created = await promotionModule.createPromotions([
        // automatic ที่สร้างผ่านฟอร์ม Medusa admin → ยังไม่มี rule (กฎข้อ 7)
        {
          code: "FS5-AUTO-MISSING",
          type: "standard",
          status: "active",
          is_automatic: true,
          campaign_id: campaignId,
          application_method: applicationMethod,
        },
        // automatic ที่มี rule อยู่แล้ว → ต้องไม่ถูกเพิ่มซ้ำ
        {
          code: "FS5-AUTO-OK",
          type: "standard",
          status: "active",
          is_automatic: true,
          campaign_id: campaignId,
          application_method: applicationMethod,
          rules: [exclusiveAutomaticRule()],
        },
        // code ใน campaign เดียวกัน → ไม่ใช่ automatic ไม่ต้องมี rule
        {
          code: "FS5-CODE",
          type: "standard",
          status: "active",
          is_automatic: false,
          campaign_id: campaignId,
          application_method: applicationMethod,
        },
      ])
      for (const p of created) {
        promo[p.code!] = p.id
      }
    })

    it("GET before any config returns null config and warns about automatic promotions without the rule", async () => {
      const { status, data } = await api.get(configUrl(), { headers })

      expect(status).toEqual(200)
      expect(data.flash_sale_config).toBeNull()
      expect(data.promotions_missing_exclusivity).toEqual([
        { id: promo["FS5-AUTO-MISSING"], code: "FS5-AUTO-MISSING" },
      ])
    })

    it("POST creates the config and adds the exclusivity rule to every automatic promotion of the campaign", async () => {
      const { status, data } = await api.post(
        configUrl(),
        { per_customer_limit: 2, total_cap: 100, show_countdown: true, banner_text: "11.11 only" },
        { headers }
      )

      expect(status).toEqual(200)
      expect(data.flash_sale_config).toEqual(
        expect.objectContaining({
          campaign_id: campaignId,
          per_customer_limit: 2,
          total_cap: 100,
          units_sold: 0,
          show_countdown: true,
          show_remaining: false,
          banner_text: "11.11 only",
        })
      )
      expect(data.promotions_missing_exclusivity).toEqual([])
      expect(await exclusivityRuleCount(promo["FS5-AUTO-MISSING"])).toEqual(1)
      expect(await exclusivityRuleCount(promo["FS5-AUTO-OK"])).toEqual(1)
      expect(await exclusivityRuleCount(promo["FS5-CODE"])).toEqual(0)

      const promotionModule = getContainer().resolve(Modules.PROMOTION)
      const [added] = await promotionModule.listPromotions(
        { id: promo["FS5-AUTO-MISSING"] },
        { relations: ["rules", "rules.values"] }
      )
      expect(added.rules).toEqual([
        expect.objectContaining({
          attribute: EXCLUSIVITY_CODE_APPLIED_ATTRIBUTE,
          operator: "ne",
          values: [expect.objectContaining({ value: "true" })],
        }),
      ])
    })

    it("POST is idempotent: saving again updates the same config and never duplicates the rule", async () => {
      await api.post(configUrl(), { per_customer_limit: 2 }, { headers })
      const { status, data } = await api.post(
        configUrl(),
        { per_customer_limit: 3, banner_text: null },
        { headers }
      )

      expect(status).toEqual(200)
      expect(data.flash_sale_config).toEqual(
        expect.objectContaining({ per_customer_limit: 3, banner_text: null })
      )
      expect(await exclusivityRuleCount(promo["FS5-AUTO-MISSING"])).toEqual(1)
      expect(await exclusivityRuleCount(promo["FS5-AUTO-OK"])).toEqual(1)

      const service: FlashSaleModuleService = getContainer().resolve(FLASH_SALE_MODULE)
      expect(await service.listFlashSaleConfigs({ campaign_id: campaignId })).toHaveLength(1)
    })

    it("concurrent POSTs on a new config (double-click Save) all return 200 with one config and one rule per promotion", async () => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          api
            .post(configUrl(), { per_customer_limit: i + 1 }, { headers })
            .catch((e) => e.response)
        )
      )

      expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200])
      expect(await exclusivityRuleCount(promo["FS5-AUTO-MISSING"])).toEqual(1)
      expect(await exclusivityRuleCount(promo["FS5-AUTO-OK"])).toEqual(1)

      const service: FlashSaleModuleService = getContainer().resolve(FLASH_SALE_MODULE)
      expect(await service.listFlashSaleConfigs({ campaign_id: campaignId })).toHaveLength(1)
    })

    it("AC-11 (a): POST total_cap=5 while units_sold=10 → 200 and units_sold stays 10", async () => {
      const service: FlashSaleModuleService = getContainer().resolve(FLASH_SALE_MODULE)
      await service.createFlashSaleConfigs({
        campaign_id: campaignId,
        total_cap: 20,
        units_sold: 10,
      })

      const { status, data } = await api.post(configUrl(), { total_cap: 5 }, { headers })

      expect(status).toEqual(200)
      expect(data.flash_sale_config).toEqual(
        expect.objectContaining({ total_cap: 5, units_sold: 10 })
      )
      const [config] = await service.listFlashSaleConfigs({ campaign_id: campaignId })
      expect(config).toEqual(expect.objectContaining({ total_cap: 5, units_sold: 10 }))
    })

    it("rejects units_sold and invalid limits in the body (400)", async () => {
      const soldErr = await api
        .post(configUrl(), { units_sold: 0 }, { headers })
        .catch((e) => e.response)
      expect(soldErr.status).toEqual(400)

      const capErr = await api
        .post(configUrl(), { total_cap: 0 }, { headers })
        .catch((e) => e.response)
      expect(capErr.status).toEqual(400)
      expect(capErr.data.message).toEqual(
        "Invalid request: Value for field 'total_cap' too small, expected at least: '1'"
      )

      const limitErr = await api
        .post(configUrl(), { per_customer_limit: 1.5 }, { headers })
        .catch((e) => e.response)
      expect(limitErr.status).toEqual(400)
    })

    it("returns 404 for an unknown campaign and does not create a config", async () => {
      const err = await api
        .post("/admin/flash-sales/procamp_missing/config", { per_customer_limit: 2 }, { headers })
        .catch((e) => e.response)
      expect(err.status).toEqual(404)

      const getErr = await api
        .get("/admin/flash-sales/procamp_missing/config", { headers })
        .catch((e) => e.response)
      expect(getErr.status).toEqual(404)

      const service: FlashSaleModuleService = getContainer().resolve(FLASH_SALE_MODULE)
      expect(await service.listFlashSaleConfigs({})).toHaveLength(0)
    })

    it("requires an authenticated admin user (401)", async () => {
      const err = await api.post(configUrl(), { per_customer_limit: 2 }).catch((e) => e.response)
      expect(err.status).toEqual(401)
      expect(await exclusivityRuleCount(promo["FS5-AUTO-MISSING"])).toEqual(0)
    })
  },
})
