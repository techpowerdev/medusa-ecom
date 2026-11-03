import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import {
  createGroupBuyCampaignWorkflow,
  type CreateGroupBuyCampaignInput,
} from "../../src/workflows/group-buy/campaign"
import { setGroupBuyCampaignStatusWorkflow } from "../../src/workflows/group-buy/campaign-status"
import { createGroupWorkflow } from "../../src/workflows/group-buy/create-group"
import { GROUP_BUY_MODULE } from "../../src/modules/group_buy"
import type GroupBuyModuleService from "../../src/modules/group_buy/service"

jest.setTimeout(240 * 1000)

const HOUR = 60 * 60 * 1000

// spec 04 "API" รอบ 14 — allow-list ตรงตัว (กฎข้อ 28b)
const CAMPAIGN_KEYS = [
  "id",
  "name",
  "starts_at",
  "ends_at",
  "target_type",
  "target_value",
  "group_mode",
  "max_people_per_group",
  "max_units_per_person",
  "team_duration_hours",
  "pay_within_hours",
  "discount",
  "product_id",
].sort()
const GROUP_KEYS = [
  "id",
  "name",
  "join_token",
  "status",
  "starts_at",
  "ends_at",
  "progress_orders",
  "progress_units",
  "progress_people",
].sort()

type Res = { status: number; data: any }

// error ของ axios มี req/res วนกัน — jest worker serialize ไม่ได้ จึงคืนเฉพาะ status/data
const settle = (request: Promise<{ status: number; data: any }>): Promise<Res> =>
  request.then(
    (r) => ({ status: r.status, data: r.data }),
    (e) => {
      if (!e?.response) {
        throw new Error(`request failed without response: ${e?.message}`)
      }
      return { status: e.response.status, data: e.response.data }
    }
  )

// GB-11 (กฎข้อ 28, AC-45, AC-46): route สาธารณะอ่านอย่างเดียว — ไม่มี PII/promotion code
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let pk: string
    let productX: string
    let productW: string
    let anon: { headers: Record<string, string> }

    beforeAll(async () => {
      const container = getContainer()
      await seedThailand({ container, args: [] })
      pk = await getPublishableKey(container)
      anon = storeHeadersFor(pk)
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: ["X", "W"].map((name) => ({
            title: `GB-11 product ${name}`,
            handle: `gb11-product-${name.toLowerCase()}`,
            status: ProductStatus.PUBLISHED,
            options: [{ title: "Size", values: ["One"] }],
            variants: [
              {
                title: "One",
                options: { Size: "One" },
                manage_inventory: false,
                prices: [{ currency_code: "thb", amount: 1000 }],
              },
            ],
          })),
        },
      })
      productX = result[0].id
      productW = result[1].id
    })

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const groupBuy = (): GroupBuyModuleService => getContainer().resolve(GROUP_BUY_MODULE)
    const promotions = () => getContainer().resolve(Modules.PROMOTION)

    async function createCampaign(name: string, data: Partial<CreateGroupBuyCampaignInput> = {}, activate = true) {
      const { result } = await createGroupBuyCampaignWorkflow(getContainer()).run({
        input: {
          name,
          target_type: "orders",
          target_value: 100,
          group_mode: "both",
          team_duration_hours: 2,
          max_units_per_person: 5,
          starts_at: new Date(Date.now() - HOUR).toISOString(),
          ends_at: new Date(Date.now() + 10 * HOUR).toISOString(),
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 10,
            value: 30,
            target_rules: [
              {
                attribute: "items.product.id",
                operator: "in",
                values: [productX],
              },
            ],
          },
          rules: [{ attribute: "currency_code", operator: "in", values: ["thb"] }],
          ...data,
        } as CreateGroupBuyCampaignInput,
      })
      if (activate) {
        await setGroupBuyCampaignStatusWorkflow(getContainer()).run({
          input: { id: result.id, status: "active" },
        })
      }
      return result
    }

    const linked = async (id: string) => {
      const { data } = await query().graph({
        entity: "group_buy_campaign",
        fields: ["campaign.id", "promotion.id", "promotion.application_method.target_rules.id"],
        filters: { id },
      })
      return data[0] as any
    }

    // ข้ามกฎข้อ 30 ผ่าน Promotion module (ข้อมูลก่อนกฎ / admin แก้ต้นแบบเองที่หน้า Medusa)
    async function setTemplateProducts(campaignId: string, productIds: string[]) {
      const { promotion } = await linked(campaignId)
      await promotions().removePromotionTargetRules(
        promotion.id,
        promotion.application_method.target_rules.map((r: { id: string }) => r.id)
      )
      if (productIds.length) {
        await promotions().addPromotionTargetRules(promotion.id, [
          { attribute: "items.product.id", operator: "in", values: productIds },
        ])
      }
    }

    const createGroup = async (campaignId: string, kind: "pool" | "team", customerId?: string) =>
      (
        await createGroupWorkflow(getContainer()).run({
          input: { campaign_id: campaignId, kind, customer_id: customerId },
        })
      ).result

    const allPromotionIds = async () => (await promotions().listPromotions({}, { select: ["id"] })).map((p) => p.id)

    async function member(groupId: string, campaignId: string, customerId: string, units: number, n: number) {
      await groupBuy().createGroupBuyMemberships({
        campaign_id: campaignId,
        group_id: groupId,
        customer_id: customerId,
        order_id: `order_gb11_${groupId}_${n}`,
        units,
        joined_at: new Date(),
      })
    }

    it("AC-45: campaigns/active without a customer token → only live, single-product campaigns with open, unexpired pools; allow-list keys, no PII/codes", async () => {
      const a = await createCampaign("A")
      const p1 = await createGroup(a.id, "pool")
      const p2 = await createGroup(a.id, "pool")
      const p3 = await createGroup(a.id, "pool")
      await groupBuy().updateGroupBuyGroups([
        { id: p2.id, status: "failed" },
        { id: p3.id, ends_at: new Date(Date.now() - 1000) },
      ])
      const owner = await registerCustomer(api, pk, `gb11-owner+${Date.now()}@example.com`, "gb11-password")
      const t1 = await createGroup(a.id, "team", owner.customerId)
      const buyer = await registerCustomer(api, pk, `gb11-p1+${Date.now()}@example.com`, "gb11-password")
      await member(p1.id, a.id, buyer.customerId, 1, 1)
      await groupBuy().updateGroupBuyGroups({
        id: p1.id,
        progress_orders: 1,
        progress_units: 1,
        progress_people: 1,
      })

      await createCampaign("B (draft)", {}, false)
      const c = await createCampaign("C (starts later)")
      await promotions().updateCampaigns({
        id: (await linked(c.id)).campaign.id,
        starts_at: new Date(Date.now() + HOUR),
      })
      const d = await createCampaign("D (ended)")
      await promotions().updateCampaigns({
        id: (await linked(d.id)).campaign.id,
        ends_at: new Date(Date.now() - 1000),
      })
      const noScope = await createCampaign("A2 no target_rules")
      await setTemplateProducts(noScope.id, [])
      const twoProducts = await createCampaign("A2 two products")
      await setTemplateProducts(twoProducts.id, [productX, productW])

      const res = await settle(api.get("/store/group-buy/campaigns/active", anon))

      expect(res.status).toEqual(200)
      expect(res.data.campaigns.map((x: { id: string }) => x.id)).toEqual([a.id])
      const [campaign] = res.data.campaigns
      const { pool_groups, ...rest } = campaign
      expect(Object.keys(rest).sort()).toEqual(CAMPAIGN_KEYS)
      expect(pool_groups.map((g: { id: string }) => g.id)).toEqual([p1.id])
      expect(Object.keys(pool_groups[0]).sort()).toEqual(GROUP_KEYS)
      expect(pool_groups[0].join_token).toEqual(p1.join_token)
      expect(pool_groups[0].progress_people).toEqual(1)
      expect(campaign.discount).toEqual({
        type: "percentage",
        value: 30,
        currency_code: null,
      })
      expect(campaign.product_id).toEqual(productX)

      const body = JSON.stringify(res.data)
      expect(body).not.toContain(buyer.customerId)
      expect(body).not.toContain(owner.customerId)
      expect(body).not.toContain(t1.join_token)
      expect(body).not.toContain("GBT-")
      for (const token of [p1, p2, p3, t1].map((g) => g.join_token)) {
        expect(body).not.toContain(`GB-${token}`)
      }
      for (const id of await allPromotionIds()) {
        expect(body).not.toContain(id)
      }
    })

    it("AC-46: groups/:token of a team → group + campaign from the group's own promotion; allow-list keys, no PII; same body with a customer token; succeeded; 404; join still 401", async () => {
      const a = await createCampaign("A")
      const [x, y, z] = await Promise.all(
        ["x", "y", "z"].map((n) => registerCustomer(api, pk, `gb11-${n}+${Date.now()}@example.com`, "gb11-password"))
      )
      const emails = await Promise.all(
        [x, y, z].map(
          async (c) => (await getContainer().resolve(Modules.CUSTOMER).retrieveCustomer(c.customerId)).email
        )
      )
      const t1 = await createGroup(a.id, "team", x.customerId)
      await member(t1.id, a.id, x.customerId, 1, 1)
      await member(t1.id, a.id, x.customerId, 2, 2)
      await member(t1.id, a.id, y.customerId, 1, 3)
      await member(t1.id, a.id, z.customerId, 1, 4)
      await groupBuy().updateGroupBuyMemberships({
        id: (
          await groupBuy().listGroupBuyMemberships({
            customer_id: z.customerId,
          })
        )[0].id,
        status: "cancelled",
      })
      await groupBuy().updateGroupBuyGroups({
        id: t1.id,
        progress_orders: 3,
        progress_units: 4,
        progress_people: 2,
      })
      // หลังสร้าง T1 admin แก้ต้นแบบเป็นสินค้า W — กลุ่มเดิมยังเป็น X (Q5)
      await setTemplateProducts(a.id, [productW])

      const res = await settle(api.get(`/store/group-buy/groups/${t1.join_token}`, anon))

      expect(res.status).toEqual(200)
      const { kind, ...group } = res.data.group
      expect(kind).toEqual("team")
      expect(Object.keys(group).sort()).toEqual(GROUP_KEYS)
      expect(Object.keys(res.data.campaign).sort()).toEqual(CAMPAIGN_KEYS)
      const db = (await groupBuy().listGroupBuyGroups({ id: t1.id }))[0]
      expect(group).toEqual(
        expect.objectContaining({
          status: db.status,
          progress_people: db.progress_people,
          progress_orders: db.progress_orders,
          progress_units: db.progress_units,
          ends_at: new Date(db.ends_at).toISOString(),
        })
      )
      expect(res.data.campaign.product_id).toEqual(productX)
      const body = JSON.stringify(res.data)
      for (const leak of [
        x.customerId,
        y.customerId,
        z.customerId,
        ...emails,
        "order_",
        "created_by_customer_id",
        "pay_deadline_at",
      ]) {
        expect(body).not.toContain(leak)
      }

      const withToken = await settle(api.get(`/store/group-buy/groups/${t1.join_token}`, storeHeadersFor(pk, x.token)))
      expect(withToken.status).toEqual(200)
      expect(withToken.data).toEqual(res.data)

      await groupBuy().updateGroupBuyGroups({ id: t1.id, status: "succeeded" })
      const succeeded = await settle(api.get(`/store/group-buy/groups/${t1.join_token}`, anon))
      expect(succeeded.status).toEqual(200)
      expect(succeeded.data.group.status).toEqual("succeeded")

      const missing = await settle(api.get("/store/group-buy/groups/no-such-token", anon))
      expect(missing.status).toEqual(404)
      expect(missing.data.type).toEqual("not_found")

      const join = await settle(api.post(`/store/group-buy/groups/${t1.join_token}/join`, { cart_id: "cart_x" }, anon))
      expect(join.status).toEqual(401)
    })
  },
})
