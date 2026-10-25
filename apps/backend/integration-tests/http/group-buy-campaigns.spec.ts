import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, PromotionActions } from "@medusajs/framework/utils"
import { createCartWorkflow, updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { GROUP_BUY_MODULE } from "../../src/modules/group_buy"
import type GroupBuyModuleService from "../../src/modules/group_buy/service"
import {
  createGroupBuyCampaignWorkflow,
  deleteGroupBuyCampaignWorkflow,
  type CreateGroupBuyCampaignInput,
} from "../../src/workflows/group-buy/campaign"

jest.setTimeout(180 * 1000)

const ADMIN_EMAIL = "gb-admin@example.com"
const ADMIN_PASSWORD = "gb-test-password"
const HOUR = 60 * 60 * 1000

// รูปที่ test ใช้ (Query typing ให้ทุก relation เป็น nullable — assert ผ่าน must())
type GraphCampaign = {
  id: string
  status: string
  campaign: { id: string; campaign_identifier: string; ends_at: string | Date | null }
  promotion: {
    id: string
    code: string
    status: string
    is_automatic: boolean
    campaign_id: string
    application_method: {
      type: string
      value: number
      target_rules: { attribute: string; values: { value: string }[] }[]
    }
  }
}

function must<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${label} to be present`)
  }
  return value
}

// GB-2a: link template (ADR-011) + workflow ของแคมเปญ + admin API (spec 04 AC-20a, AC-21a)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let headers: { headers: Record<string, string> }
    let regionId: string
    let productXId: string
    let variantXId: string // t-shirt S (product X — อยู่ใน scope)
    let variantYId: string // sweatshirt M (นอก scope)

    beforeAll(async () => {
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      const container = getContainer()
      await seedThailand({ container, args: [] })

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "handle", "variants.id", "variants.title"],
      })
      const byHandle = Object.fromEntries(products.map((p) => [p.handle, p]))
      const variant = (handle: string, title: string) =>
        must(
          must(byHandle[handle], handle).variants.find((v) => v?.title === title),
          `${handle} ${title}`
        ).id
      productXId = must(byHandle["t-shirt"], "t-shirt").id
      variantXId = variant("t-shirt", "S")
      variantYId = variant("sweatshirt", "M")
    })

    beforeEach(async () => {
      const { data } = await api.post("/auth/user/emailpass", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      })
      headers = { headers: { authorization: `Bearer ${data.token}` } }
    })

    const campaignInput = (data: Partial<CreateGroupBuyCampaignInput> = {}) =>
      ({
        name: "GB 11.11",
        target_type: "orders",
        target_value: 3,
        group_mode: "both",
        team_duration_hours: 2,
        starts_at: new Date(Date.now() - HOUR).toISOString(),
        ends_at: new Date(Date.now() + 10 * HOUR).toISOString(),
        application_method: {
          type: "percentage",
          target_type: "items",
          allocation: "each",
          max_quantity: 10,
          value: 30,
          target_rules: [{ attribute: "items.product.id", operator: "in", values: [productXId] }],
        },
        ...data,
      }) as CreateGroupBuyCampaignInput

    const createViaApi = async (data: Partial<CreateGroupBuyCampaignInput> = {}) => {
      const { data: body } = await api
        .post("/admin/group-buy/campaigns", campaignInput(data), headers)
        .catch((e) => {
          throw new Error(`create campaign: ${JSON.stringify(e.response?.data)}`)
        })
      return body.campaign
    }

    const setStatus = (id: string, status: string) =>
      api
        .post(`/admin/group-buy/campaigns/${id}/status`, { status }, headers)
        .catch((e) => e.response)

    const graphCampaign = async (id: string): Promise<GraphCampaign> => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "group_buy_campaign",
        fields: [
          "id",
          "status",
          "campaign.id",
          "campaign.campaign_identifier",
          "campaign.ends_at",
          "promotion.id",
          "promotion.code",
          "promotion.status",
          "promotion.is_automatic",
          "promotion.campaign_id",
          "promotion.application_method.type",
          "promotion.application_method.value",
          "promotion.application_method.target_rules.attribute",
          "promotion.application_method.target_rules.values.value",
        ],
        filters: { id },
      })
      const row = must(data[0], `group_buy_campaign ${id}`)
      must(row.campaign, "campaign link")
      must(row.promotion, "template link")
      return row as unknown as GraphCampaign
    }

    const cartAdjustments = async (codes: string[]) => {
      const container = getContainer()
      // CORE-6: cart ต้องมี customer ที่มีบัญชี
      const customer = await container.resolve(Modules.CUSTOMER).createCustomers({
        email: `somchai+${Date.now()}@example.com`,
        has_account: true,
      })
      const { result: cart } = await createCartWorkflow(container).run({
        input: {
          region_id: regionId,
          customer_id: customer.id,
          items: [
            { variant_id: variantXId, quantity: 1 },
            { variant_id: variantYId, quantity: 1 },
          ],
        },
      })
      await updateCartPromotionsWorkflow(container).run({
        input: { cart_id: cart.id, promo_codes: codes, action: PromotionActions.ADD },
      })
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "cart",
        fields: ["items.variant_id", "items.adjustments.code"],
        filters: { id: cart.id },
      })
      const items = must(data[0], "cart").items ?? []
      return Object.fromEntries(
        items.map((i) => [i?.variant_id, (i?.adjustments ?? []).map((a) => a?.code)])
      )
    }

    describe("createGroupBuyCampaignWorkflow (AC-20a)", () => {
      it("creates a Medusa campaign + draft GBT- template promotion linked to the campaign", async () => {
        const { result } = await createGroupBuyCampaignWorkflow(getContainer()).run({
          input: campaignInput(),
        })

        expect(result.status).toEqual("draft")
        const campaign = await graphCampaign(result.id)
        expect(campaign.campaign.id).toEqual(expect.any(String))
        expect(campaign.promotion).toEqual(
          expect.objectContaining({
            code: expect.stringMatching(/^GBT-[A-Z0-9]{12}$/),
            status: "draft",
            is_automatic: false,
            campaign_id: campaign.campaign.id,
            application_method: expect.objectContaining({ type: "percentage", value: 30 }),
          })
        )
        // code ต้นแบบต้องไม่โผล่ใน campaign_identifier ของ Medusa campaign
        expect(campaign.campaign.campaign_identifier).not.toContain(campaign.promotion.code)
        expect(campaign.promotion.application_method.target_rules).toEqual([
          expect.objectContaining({
            attribute: "items.product.id",
            values: [expect.objectContaining({ value: productXId })],
          }),
        ])
      })

      it("template code on a cart with X gives no adjustment; once active it would give X only", async () => {
        const { result } = await createGroupBuyCampaignWorkflow(getContainer()).run({
          input: campaignInput(),
        })
        const { promotion } = await graphCampaign(result.id)

        expect(await cartAdjustments([promotion.code])).toEqual({
          [variantXId]: [],
          [variantYId]: [],
        })

        // control: ต้นแบบ map application_method/scope ถูก — ถ้าเป็น active จะลดเฉพาะ X
        await getContainer()
          .resolve(Modules.PROMOTION)
          .updatePromotions([{ id: promotion.id, status: "active" }])
        expect(await cartAdjustments([promotion.code])).toEqual({
          [variantXId]: [promotion.code],
          [variantYId]: [],
        })
      })

      it("rolls back the Medusa campaign and template when the group buy campaign cannot be created", async () => {
        const container = getContainer()
        const promotionModule = container.resolve(Modules.PROMOTION)
        const before = await promotionModule.listPromotions({}, { select: ["id"] })
        const campaignsBefore = await promotionModule.listCampaigns({}, { select: ["id"] })

        await expect(
          createGroupBuyCampaignWorkflow(container).run({
            input: campaignInput({ target_value: 0 }),
          })
        ).rejects.toBeTruthy()

        const groupBuy: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
        expect(await groupBuy.listGroupBuyCampaigns()).toHaveLength(0)
        expect(await promotionModule.listPromotions({}, { select: ["id"] })).toHaveLength(
          before.length
        )
        expect(await promotionModule.listCampaigns({}, { select: ["id"] })).toHaveLength(
          campaignsBefore.length
        )
      })
    })

    describe("deleteGroupBuyCampaignWorkflow rollback", () => {
      it("restores the campaign, template, links and Medusa campaign when a later step fails", async () => {
        const container = getContainer()
        const { result } = await createGroupBuyCampaignWorkflow(container).run({
          input: campaignInput(),
        })
        const before = await graphCampaign(result.id)

        // ขั้นสุดท้าย (deleteCampaignsWorkflow) ล้ม → step ก่อนหน้าทั้งหมดต้อง compensate
        const promotionModule = container.resolve(Modules.PROMOTION)
        const spy = jest
          .spyOn(promotionModule, "softDeleteCampaigns")
          .mockRejectedValueOnce(new Error("boom"))
        try {
          await expect(
            deleteGroupBuyCampaignWorkflow(container).run({ input: { id: result.id } })
          ).rejects.toBeTruthy()
        } finally {
          spy.mockRestore()
        }

        const after = await graphCampaign(result.id)
        expect(after.status).toEqual("draft")
        expect(after.campaign.id).toEqual(before.campaign.id)
        expect(after.promotion.id).toEqual(before.promotion.id)
        expect(after.promotion.code).toEqual(before.promotion.code)
        expect(
          await promotionModule.listCampaigns({ id: [before.campaign.id] }, { select: ["id"] })
        ).toHaveLength(1)
      })
    })

    describe("admin API", () => {
      it("requires an admin user", async () => {
        const response = await api.get("/admin/group-buy/campaigns").catch((e) => e.response)
        expect(response.status).toEqual(401)
      })

      it("creates (returning template_promotion_id), lists, retrieves and updates a draft campaign", async () => {
        const created = await createViaApi()
        expect(created).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^gbcamp_/),
            status: "draft",
            target_value: 3,
            group_mode: "both",
            template_promotion_id: expect.any(String),
          })
        )
        const { promotion } = await graphCampaign(created.id)
        expect(created.template_promotion_id).toEqual(promotion.id)

        const list = await api.get("/admin/group-buy/campaigns", headers)
        expect(list.data.count).toEqual(1)
        expect(list.data.campaigns[0].id).toEqual(created.id)

        const updated = await api.post(
          `/admin/group-buy/campaigns/${created.id}`,
          { target_value: 5, max_people_per_group: 4 },
          headers
        )
        expect(updated.data.campaign).toEqual(
          expect.objectContaining({ target_value: 5, max_people_per_group: 4 })
        )

        const fetched = await api.get(`/admin/group-buy/campaigns/${created.id}`, headers)
        expect(fetched.data.campaign).toEqual(
          expect.objectContaining({
            id: created.id,
            target_value: 5,
            template_promotion_id: promotion.id,
          })
        )
      })

      it("rejects an invalid body with 400", async () => {
        const response = await api
          .post(
            "/admin/group-buy/campaigns",
            { ...campaignInput(), ends_at: undefined },
            headers
          )
          .catch((e) => e.response)
        expect(response.status).toEqual(400)
      })

      it("returns 404 for an unknown campaign", async () => {
        const response = await api
          .get("/admin/group-buy/campaigns/gbcamp_missing", headers)
          .catch((e) => e.response)
        expect(response.status).toEqual(404)
      })

      it("DELETE on a draft campaign removes the campaign, template, Medusa campaign and links (AC-20a)", async () => {
        const created = await createViaApi()
        const { campaign, promotion } = await graphCampaign(created.id)
        const container = getContainer()
        const link = container.resolve(ContainerRegistrationKeys.LINK)
        const self = { group_buy_campaign_id: created.id }
        const links = () =>
          link.list([
            { [GROUP_BUY_MODULE]: self, [Modules.PROMOTION]: { promotion_id: promotion.id } },
            { [GROUP_BUY_MODULE]: self, [Modules.PROMOTION]: { campaign_id: campaign.id } },
          ])
        expect(await links()).toHaveLength(2)

        const response = await api.delete(`/admin/group-buy/campaigns/${created.id}`, headers)
        expect(response.status).toEqual(200)
        expect(response.data).toEqual({
          id: created.id,
          object: "group_buy_campaign",
          deleted: true,
        })

        const groupBuy: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
        const promotionModule = container.resolve(Modules.PROMOTION)
        expect(await groupBuy.listGroupBuyCampaigns({ id: created.id })).toHaveLength(0)
        expect(await promotionModule.listPromotions({ id: promotion.id })).toHaveLength(0)
        expect(await promotionModule.listCampaigns({ id: [campaign.id] })).toHaveLength(0)

        expect(await links()).toHaveLength(0)
      })

      it("DELETE on an active campaign → 400 and nothing is removed (AC-20a)", async () => {
        const created = await createViaApi()
        expect((await setStatus(created.id, "active")).status).toEqual(200)

        const response = await api
          .delete(`/admin/group-buy/campaigns/${created.id}`, headers)
          .catch((e) => e.response)
        expect(response.status).toEqual(400)
        expect(response.data.type).toEqual("not_allowed")

        const campaign = await graphCampaign(created.id)
        expect(campaign.promotion.id).toEqual(created.template_promotion_id)
      })
    })

    describe("status transitions (AC-21a)", () => {
      it("draft → active → ended succeed; active again on active is a no-op 200", async () => {
        const created = await createViaApi()

        const activated = await setStatus(created.id, "active")
        expect(activated.status).toEqual(200)
        expect(activated.data.campaign.status).toEqual("active")

        const again = await setStatus(created.id, "active")
        expect(again.status).toEqual(200)
        expect(again.data.campaign.status).toEqual("active")

        const ended = await setStatus(created.id, "ended")
        expect(ended.status).toEqual(200)
        expect(ended.data.campaign.status).toEqual("ended")

        // ต้นแบบยังเป็น draft ตลอดอายุแคมเปญ (ADR-011 ข้อ 3)
        expect((await graphCampaign(created.id)).promotion.status).toEqual("draft")
      })

      it("rejects active → draft and ended → active with 400", async () => {
        const created = await createViaApi()
        await setStatus(created.id, "active")

        const toDraft = await setStatus(created.id, "draft")
        expect(toDraft.status).toEqual(400)

        await setStatus(created.id, "ended")
        const reopen = await setStatus(created.id, "active")
        expect(reopen.status).toEqual(400)
        expect(reopen.data.type).toEqual("not_allowed")
      })

      it("rejects draft → active when the Medusa campaign ends_at has passed", async () => {
        const created = await createViaApi()
        const { campaign } = await graphCampaign(created.id)
        await getContainer()
          .resolve(Modules.PROMOTION)
          .updateCampaigns({
            id: campaign.id,
            starts_at: new Date(Date.now() - 3 * HOUR),
            ends_at: new Date(Date.now() - HOUR),
          })

        const response = await setStatus(created.id, "active")
        expect(response.status).toEqual(400)
        expect(response.data.type).toEqual("not_allowed")
      })

      it("editing target_value of an active campaign → 400; name and pay_within_hours are still editable", async () => {
        const created = await createViaApi()
        await setStatus(created.id, "active")

        const locked = await api
          .post(`/admin/group-buy/campaigns/${created.id}`, { target_value: 10 }, headers)
          .catch((e) => e.response)
        expect(locked.status).toEqual(400)
        expect(locked.data.type).toEqual("not_allowed")

        const allowed = await api.post(
          `/admin/group-buy/campaigns/${created.id}`,
          { name: "GB 11.11 (extended)", pay_within_hours: 12 },
          headers
        )
        expect(allowed.data.campaign).toEqual(
          expect.objectContaining({
            name: "GB 11.11 (extended)",
            pay_within_hours: 12,
            target_value: 3,
          })
        )
      })
    })
  },
})
