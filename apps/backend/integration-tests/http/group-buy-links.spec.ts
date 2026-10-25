import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { GROUP_BUY_MODULE } from "../../src/modules/group_buy"
import type GroupBuyModuleService from "../../src/modules/group_buy/service"

jest.setTimeout(120 * 1000)

// GB-1: module links ของ group_buy (spec 04 "Links", ADR-009)
// group ↔ promotion, campaign ↔ promotion campaign (link table), membership → order (read-only ผ่าน order_id)
const setup = async (container: MedusaContainer) => {
  const groupBuy: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
  const promotionModule = container.resolve(Modules.PROMOTION)
  const orderModule = container.resolve(Modules.ORDER)

  const promotionCampaign = await promotionModule.createCampaigns({
    name: "GB 11.11",
    campaign_identifier: "gb-1111",
    starts_at: new Date("2026-11-01T00:00:00.000Z"),
    ends_at: new Date("2026-11-11T00:00:00.000Z"),
  })
  const promotion = await promotionModule.createPromotions({
    code: "GB-abc123",
    type: "standard",
    status: "active",
    is_automatic: false,
    campaign_id: promotionCampaign.id,
    application_method: {
      type: "percentage",
      target_type: "order",
      value: 30,
      currency_code: "thb",
    },
  })
  const order = await orderModule.createOrders({
    email: "somchai@example.com",
    currency_code: "thb",
    items: [{ title: "Thai Tea", quantity: 1, unit_price: 250 }],
  })

  const campaign = await groupBuy.createGroupBuyCampaigns({
    name: "GB 11.11",
    target_type: "orders",
    target_value: 3,
    group_mode: "pool",
  })
  const group = await groupBuy.createGroupBuyGroups({
    campaign_id: campaign.id,
    kind: "pool",
    join_token: "abc123",
    starts_at: new Date("2026-11-01T00:00:00.000Z"),
    ends_at: new Date("2026-11-11T00:00:00.000Z"),
  })
  const membership = await groupBuy.createGroupBuyMemberships({
    campaign_id: campaign.id,
    group_id: group.id,
    customer_id: "cus_1",
    order_id: order.id,
    units: 1,
    joined_at: new Date(),
  })

  return { promotionCampaign, promotion, order, campaign, group, membership }
}

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    it("links a group buy campaign to a Medusa promotion campaign", async () => {
      const container = getContainer()
      const { campaign, promotionCampaign } = await setup(container)
      const link = container.resolve(ContainerRegistrationKeys.LINK)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)

      await link.create({
        [GROUP_BUY_MODULE]: { group_buy_campaign_id: campaign.id },
        [Modules.PROMOTION]: { campaign_id: promotionCampaign.id },
      })

      const { data } = await query.graph({
        entity: "group_buy_campaign",
        fields: ["id", "campaign.id", "campaign.campaign_identifier"],
        filters: { id: campaign.id },
      })
      expect(data[0].campaign).toEqual(
        expect.objectContaining({
          id: promotionCampaign.id,
          campaign_identifier: "gb-1111",
        })
      )
    })

    it("links a group to its Medusa promotion (code GB-<token>)", async () => {
      const container = getContainer()
      const { group, promotion } = await setup(container)
      const link = container.resolve(ContainerRegistrationKeys.LINK)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)

      await link.create({
        [GROUP_BUY_MODULE]: { group_buy_group_id: group.id },
        [Modules.PROMOTION]: { promotion_id: promotion.id },
      })

      const { data } = await query.graph({
        entity: "group_buy_group",
        fields: ["id", "promotion.id", "promotion.code"],
        filters: { id: group.id },
      })
      expect(data[0].promotion).toEqual(
        expect.objectContaining({ id: promotion.id, code: "GB-abc123" })
      )
    })

    it("reads the draft order of a membership through the read-only order_id link", async () => {
      const container = getContainer()
      const { membership, order } = await setup(container)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)

      const { data } = await query.graph({
        entity: "group_buy_membership",
        fields: ["id", "order.id", "order.email"],
        filters: { id: membership.id },
      })
      expect(data[0].order).toEqual(
        expect.objectContaining({ id: order.id, email: "somchai@example.com" })
      )
    })
  },
})
