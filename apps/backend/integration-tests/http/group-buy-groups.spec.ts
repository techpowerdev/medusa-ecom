import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules, PromotionActions } from "@medusajs/framework/utils"
import {
  createCartWorkflow,
  createProductsWorkflow,
  updateCartPromotionsWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer, storeHeadersFor } from "../helpers/customer"
import { GROUP_BUY_MODULE } from "../../src/modules/group_buy"
import type GroupBuyModuleService from "../../src/modules/group_buy/service"
import {
  createGroupBuyCampaignWorkflow,
  type CreateGroupBuyCampaignInput,
} from "../../src/workflows/group-buy/campaign"
import { setGroupBuyCampaignStatusWorkflow } from "../../src/workflows/group-buy/campaign-status"
import { createGroupWorkflow, type CreateGroupInput } from "../../src/workflows/group-buy/create-group"

jest.setTimeout(180 * 1000)

const ADMIN_EMAIL = "gb-groups-admin@example.com"
const ADMIN_PASSWORD = "gb-test-password"
const HOUR = 60 * 60 * 1000
const SHIPPING_ADDRESS = {
  first_name: "Somchai",
  last_name: "Jaidee",
  address_1: "1 Sukhumvit Rd",
  city: "Bangkok",
  postal_code: "10110",
  country_code: "th",
}

type GraphRule = { attribute: string; operator: string; values: { value: string }[] }
type GraphPromotion = {
  id: string
  code: string
  status: string
  is_automatic: boolean
  is_tax_inclusive: boolean
  campaign_id: string
  application_method: {
    type: string
    target_type: string
    allocation: string
    value: number
    max_quantity: number | null
    target_rules: GraphRule[]
  }
  rules: GraphRule[]
}

const PROMOTION_FIELDS = [
  "id",
  "code",
  "status",
  "is_automatic",
  "is_tax_inclusive",
  "campaign_id",
  "application_method.type",
  "application_method.target_type",
  "application_method.allocation",
  "application_method.value",
  "application_method.max_quantity",
  "application_method.target_rules.attribute",
  "application_method.target_rules.operator",
  "application_method.target_rules.values.value",
  "rules.attribute",
  "rules.operator",
  "rules.values.value",
]

function must<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${label} to be present`)
  }
  return value
}

// เทียบ rule แบบไม่สนลำดับ values
const normalizeRules = (rules: GraphRule[]) =>
  rules.map((r) => ({
    attribute: r.attribute,
    operator: r.operator,
    values: r.values.map((v) => v.value).sort(),
  }))

// GB-2b: createGroupWorkflow + admin POST/GET /admin/group-buy/campaigns/:id/groups (spec 04 AC-19, AC-20b, AC-21b)
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
        rules: [{ attribute: "currency_code", operator: "in", values: ["thb"] }],
        ...data,
      }) as CreateGroupBuyCampaignInput

    const createCampaign = async (
      data: Partial<CreateGroupBuyCampaignInput> = {},
      status: "draft" | "active" | "ended" = "active"
    ) => {
      const container = getContainer()
      const { result } = await createGroupBuyCampaignWorkflow(container).run({
        input: campaignInput(data),
      })
      if (status !== "draft") {
        await setGroupBuyCampaignStatusWorkflow(container).run({
          input: { id: result.id, status: "active" },
        })
      }
      if (status === "ended") {
        await setGroupBuyCampaignStatusWorkflow(container).run({
          input: { id: result.id, status: "ended" },
        })
      }
      return result
    }

    const graphCampaign = async (id: string) => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "group_buy_campaign",
        fields: [
          "id",
          "campaign.id",
          "campaign.ends_at",
          ...PROMOTION_FIELDS.map((f) => `promotion.${f}`),
        ],
        filters: { id },
      })
      const row = must(data[0], `group_buy_campaign ${id}`)
      return {
        campaign: must(row.campaign, "campaign link") as { id: string; ends_at: string | Date },
        template: must(row.promotion, "template link") as unknown as GraphPromotion,
      }
    }

    const graphGroup = async (id: string) => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "group_buy_group",
        fields: [
          "id",
          "campaign_id",
          "kind",
          "status",
          "join_token",
          "created_by_customer_id",
          "starts_at",
          "ends_at",
          "progress_orders",
          "progress_units",
          "progress_people",
          ...PROMOTION_FIELDS.map((f) => `promotion.${f}`),
        ],
        filters: { id },
      })
      const row = must(data[0], `group_buy_group ${id}`)
      return {
        ...row,
        promotion: must(row.promotion, "group promotion link") as unknown as GraphPromotion,
      }
    }

    const promotionsInCampaign = async (campaignId: string) =>
      (
        await getContainer()
          .resolve(Modules.PROMOTION)
          .listPromotions({}, { select: ["id", "code", "campaign_id"] })
      ).filter((p) => p.campaign_id === campaignId)

    const newCustomer = () =>
      getContainer()
        .resolve(Modules.CUSTOMER)
        .createCustomers({ email: `nok+${Date.now()}${Math.random()}@example.com`, has_account: true })

    const runCreateGroup = (input: CreateGroupInput) =>
      createGroupWorkflow(getContainer()).run({ input })

    const postGroup = (campaignId: string, body: Record<string, unknown> = {}) =>
      api
        .post(`/admin/group-buy/campaigns/${campaignId}/groups`, body, headers)
        .catch((e) => e.response)

    describe("createGroupWorkflow — mode (AC-19)", () => {
      it("group_mode=pool + kind=team → forbidden; no GB- promotion is created", async () => {
        const campaign = await createCampaign({ group_mode: "pool" })
        const { campaign: medusaCampaign } = await graphCampaign(campaign.id)
        const customer = await newCustomer()

        await expect(
          runCreateGroup({ campaign_id: campaign.id, kind: "team", customer_id: customer.id })
        ).rejects.toEqual(expect.objectContaining({ type: "forbidden" }))
        expect(await promotionsInCampaign(medusaCampaign.id)).toHaveLength(1) // ต้นแบบเท่านั้น
      })

      it("group_mode=team + kind=pool → forbidden", async () => {
        const campaign = await createCampaign({ group_mode: "team" })
        await expect(runCreateGroup({ campaign_id: campaign.id, kind: "pool" })).rejects.toEqual(
          expect.objectContaining({ type: "forbidden" })
        )
      })

      it("group_mode=both + team (2h, campaign ends in 10h) → open group, unique token, owner, ends_at = created + 2h", async () => {
        const campaign = await createCampaign({ group_mode: "both", team_duration_hours: 2 })
        const customer = await newCustomer()

        const { result: first } = await runCreateGroup({
          campaign_id: campaign.id,
          kind: "team",
          customer_id: customer.id,
          name: "ทีมสมชาย",
        })
        const { result: second } = await runCreateGroup({
          campaign_id: campaign.id,
          kind: "team",
          customer_id: customer.id,
        })

        const group = await graphGroup(first.id)
        expect(group).toEqual(
          expect.objectContaining({
            campaign_id: campaign.id,
            kind: "team",
            status: "open",
            created_by_customer_id: customer.id,
            join_token: expect.stringMatching(/^[A-Z0-9]{12}$/),
            progress_orders: 0,
            progress_units: 0,
            progress_people: 0,
          })
        )
        expect(new Date(group.ends_at).getTime()).toEqual(
          new Date(group.starts_at).getTime() + 2 * HOUR
        )
        expect(Math.abs(new Date(group.starts_at).getTime() - Date.now())).toBeLessThan(60 * 1000)
        expect(second.join_token).not.toEqual(first.join_token)
      })

      it("team when the campaign ends in 1h → ends_at = campaign.ends_at", async () => {
        const campaign = await createCampaign({
          group_mode: "team",
          team_duration_hours: 2,
          ends_at: new Date(Date.now() + HOUR).toISOString(),
        })
        const { campaign: medusaCampaign } = await graphCampaign(campaign.id)
        const customer = await newCustomer()

        const { result } = await runCreateGroup({
          campaign_id: campaign.id,
          kind: "team",
          customer_id: customer.id,
        })
        expect(new Date((await graphGroup(result.id)).ends_at)).toEqual(
          new Date(medusaCampaign.ends_at)
        )
      })
    })

    describe("createGroupWorkflow — promotion clone (AC-20b)", () => {
      it("creates an active GB-<token> promotion that matches the template", async () => {
        const campaign = await createCampaign()
        const { campaign: medusaCampaign, template } = await graphCampaign(campaign.id)

        const { result } = await runCreateGroup({ campaign_id: campaign.id, kind: "pool" })
        const { promotion, join_token } = await graphGroup(result.id)

        expect(promotion).toEqual(
          expect.objectContaining({
            code: `GB-${join_token}`,
            status: "active",
            is_automatic: false,
            is_tax_inclusive: template.is_tax_inclusive,
            campaign_id: medusaCampaign.id,
          })
        )
        expect(promotion.id).not.toEqual(template.id)
        const am = promotion.application_method
        const tam = template.application_method
        expect({
          type: am.type,
          target_type: am.target_type,
          allocation: am.allocation,
          value: Number(am.value),
          max_quantity: am.max_quantity,
        }).toEqual({
          type: tam.type,
          target_type: tam.target_type,
          allocation: tam.allocation,
          value: Number(tam.value),
          max_quantity: tam.max_quantity,
        })
        expect(normalizeRules(am.target_rules)).toEqual(normalizeRules(tam.target_rules))
        expect(normalizeRules(am.target_rules)).toEqual([
          { attribute: "items.product.id", operator: "in", values: [productXId] },
        ])
        expect(normalizeRules(promotion.rules)).toEqual(normalizeRules(template.rules))
        expect(promotion.rules).toHaveLength(1)

        // ต้นแบบยังเป็น draft (ADR-011 ข้อ 3)
        expect((await graphCampaign(campaign.id)).template.status).toEqual("draft")
      })

      it("GB-<token> on a cart with X and Y → −30% adjustment on line X only", async () => {
        const container = getContainer()
        // GB-2c: ค่าเริ่มต้นเปลี่ยนเป็น true — test นี้ตรวจกรณี false (control ของ AC-20c อยู่ด้านล่าง)
        const campaign = await createCampaign({ is_tax_inclusive: false })
        const { result } = await runCreateGroup({ campaign_id: campaign.id, kind: "pool" })
        const code = `GB-${result.join_token}`

        // CORE-6: cart ต้องมี customer ที่มีบัญชี
        const customer = await newCustomer()
        const { result: cart } = await createCartWorkflow(container).run({
          input: {
            region_id: regionId,
            customer_id: customer.id,
            items: [
              { variant_id: variantXId, quantity: 2 },
              { variant_id: variantYId, quantity: 1 },
            ],
          },
        })
        await updateCartPromotionsWorkflow(container).run({
          input: { cart_id: cart.id, promo_codes: [code], action: PromotionActions.ADD },
        })

        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({
          entity: "cart",
          fields: [
            "items.variant_id",
            "items.unit_price",
            "items.quantity",
            "items.is_tax_inclusive",
            "items.tax_lines.rate",
            "items.adjustments.code",
            "items.adjustments.amount",
          ],
          filters: { id: cart.id },
        })
        const items = must(data[0], "cart").items ?? []
        const lineX = must(items.find((i) => i?.variant_id === variantXId), "line X")
        const lineY = must(items.find((i) => i?.variant_id === variantYId), "line Y")

        expect((lineY.adjustments ?? []).map((a) => a?.code)).toEqual([])
        const adjustments = lineX.adjustments ?? []
        expect(adjustments.map((a) => a?.code)).toEqual([code])
        // ราคา THB รวม VAT แต่ต้นแบบ is_tax_inclusive=false → Medusa คิด 30% จากยอดก่อนภาษี
        const taxRate = (lineX.tax_lines ?? []).reduce((sum, t) => sum + Number(t?.rate ?? 0), 0)
        const lineTotal = Number(lineX.unit_price) * Number(lineX.quantity)
        const base = lineX.is_tax_inclusive ? lineTotal / (1 + taxRate / 100) : lineTotal
        expect(Number(must(adjustments[0], "adjustment").amount)).toBeCloseTo(0.3 * base, 2)
      })

      it("rolls back the GB- promotion when the group cannot be created", async () => {
        const container = getContainer()
        const campaign = await createCampaign()
        const { campaign: medusaCampaign } = await graphCampaign(campaign.id)
        const groupBuy: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)

        const spy = jest
          .spyOn(groupBuy, "createGroupBuyGroups")
          .mockRejectedValueOnce(new Error("boom"))
        try {
          await expect(runCreateGroup({ campaign_id: campaign.id, kind: "pool" })).rejects.toBeTruthy()
        } finally {
          spy.mockRestore()
        }

        expect(await promotionsInCampaign(medusaCampaign.id)).toHaveLength(1) // ต้นแบบเท่านั้น
        expect(await groupBuy.listGroupBuyGroups({ campaign_id: campaign.id })).toHaveLength(0)
      })
    })

    // GB-2c (กฎข้อ 12): ส่วนลด fixed ฿100 บนสินค้าราคา ฿1,070 (รวม VAT 7%) ต้องลดยอดจ่ายพอดี ฿100 เมื่อต้นแบบ is_tax_inclusive=true
    describe("tax-inclusive template (AC-20c)", () => {
      let pk: string
      let productX2Id: string
      let variantX2Id: string

      beforeAll(async () => {
        pk = await getPublishableKey(getContainer())
      })

      // runner คืน DB เป็น snapshot ก่อนทุก test — สร้างสินค้า X2 (฿1,070 รวม VAT) ใหม่ในแต่ละ test
      beforeEach(async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id"] })
        const { result } = await createProductsWorkflow(container).run({
          input: {
            products: [
              {
                title: "GB-2c Tee 1070",
                handle: "gb-2c-tee-1070",
                status: "published",
                options: [{ title: "Size", values: ["One"] }],
                variants: [
                  {
                    title: "One",
                    manage_inventory: false,
                    options: { Size: "One" },
                    prices: [{ currency_code: "thb", amount: 1070 }],
                  },
                ],
                sales_channels: channels.map((c) => ({ id: c.id })),
              },
            ],
          },
        })
        productX2Id = result[0].id
        variantX2Id = must(result[0].variants?.[0], "variant X2").id
      })

      const fixed100 = (is_tax_inclusive?: boolean) =>
        createCampaign({
          application_method: {
            type: "fixed",
            target_type: "items",
            allocation: "each",
            max_quantity: 1,
            value: 100,
            currency_code: "thb",
            target_rules: [{ attribute: "items.product.id", operator: "in", values: [productX2Id] }],
          },
          ...(is_tax_inclusive === undefined ? {} : { is_tax_inclusive }),
        })

      // ยอดที่ลดลงของ cart (X2 qty 1) เมื่อใส่ GB-<token> — cart สร้างและแก้ด้วย token ของ customer เจ้าของ cart
      const discountOnCart = (campaignId: string) =>
        cartDiscount(campaignId).catch((e) => {
          // error ของ axios มี req/res วนกัน — jest worker serialize ไม่ได้
          throw new Error(`store call failed: ${e.response?.status} ${JSON.stringify(e.response?.data)}`)
        })
      const cartDiscount = async (campaignId: string) => {
        const { result } = await runCreateGroup({ campaign_id: campaignId, kind: "pool" })
        const code = `GB-${result.join_token}`
        const email = `gb2c+${Date.now()}${Math.random()}@example.com`
        const { token } = await registerCustomer(api, pk, email, "gb2c-password")
        const config = storeHeadersFor(pk, token)

        const { data: created } = await api.post(
          "/store/carts",
          {
            region_id: regionId,
            shipping_address: SHIPPING_ADDRESS,
            items: [{ variant_id: variantX2Id, quantity: 1 }],
          },
          config
        )
        const before = Number(created.cart.total)
        const { data: applied } = await api.post(
          `/store/carts/${created.cart.id}/promotions`,
          { promo_codes: [code] },
          config
        )
        expect(applied.cart.promotions.map((p: { code: string }) => p.code)).toEqual([code])
        return before - Number(applied.cart.total)
      }

      it("default template (is_tax_inclusive=true) → cart.total drops by exactly 100", async () => {
        const campaign = await fixed100()
        expect((await graphCampaign(campaign.id)).template.is_tax_inclusive).toBe(true)

        const discount = await discountOnCart(campaign.id)
        expect(discount).toBeCloseTo(100, 2)
      })

      it("control: template is_tax_inclusive=false → cart.total drops by ≈107, not 100", async () => {
        const campaign = await fixed100(false)
        const { result } = await runCreateGroup({ campaign_id: campaign.id, kind: "pool" })
        expect((await graphGroup(result.id)).promotion.is_tax_inclusive).toBe(false)

        const discount = await discountOnCart(campaign.id)
        expect(discount).not.toBeCloseTo(100, 2)
        expect(discount).toBeCloseTo(107, 2)
      })
    })

    // GB-2c (AC-20d): ขั้นสร้าง link group ↔ promotion ล้ม → compensation ลบทั้ง GB- promotion และกลุ่ม
    describe("createGroupWorkflow — link step failure (AC-20d)", () => {
      it("rolls back the GB- promotion and the group, surfaces the link error, and succeeds on retry", async () => {
        const container = getContainer()
        const campaign = await createCampaign()
        const { campaign: medusaCampaign } = await graphCampaign(campaign.id)
        const groupBuy: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
        const promotionsBefore = (await promotionsInCampaign(medusaCampaign.id)).length
        const groupsBefore = (await groupBuy.listGroupBuyGroups({ campaign_id: campaign.id })).length

        const link = container.resolve(ContainerRegistrationKeys.LINK)
        const spy = jest.spyOn(link, "create").mockRejectedValueOnce(new Error("GB-2c link boom"))
        let errors: { action: string; error: { message: string } }[]
        try {
          ;({ errors } = await createGroupWorkflow(container).run({
            input: { campaign_id: campaign.id, kind: "pool" },
            throwOnError: false,
          }))
        } finally {
          spy.mockRestore()
        }

        expect(errors).toEqual([
          expect.objectContaining({
            action: "create-remote-links",
            error: expect.objectContaining({ message: "GB-2c link boom" }),
          }),
        ])
        expect(await promotionsInCampaign(medusaCampaign.id)).toHaveLength(promotionsBefore)
        expect(await groupBuy.listGroupBuyGroups({ campaign_id: campaign.id })).toHaveLength(
          groupsBefore
        )

        const { result } = await runCreateGroup({ campaign_id: campaign.id, kind: "pool" })
        expect((await graphGroup(result.id)).promotion.code).toEqual(`GB-${result.join_token}`)
      })
    })

    describe("admin API /admin/group-buy/campaigns/:id/groups", () => {
      it("requires an admin user", async () => {
        const response = await api
          .post("/admin/group-buy/campaigns/gbcamp_x/groups", {})
          .catch((e) => e.response)
        expect(response.status).toEqual(401)
      })

      it("POST creates a pool group (201, ends_at = campaign.ends_at) and GET lists it (AC-19)", async () => {
        const campaign = await createCampaign({ group_mode: "pool" })
        const { campaign: medusaCampaign } = await graphCampaign(campaign.id)

        const response = await postGroup(campaign.id, { name: "Pool A" })
        expect(response.status).toEqual(201)
        expect(response.data.group).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^gbgrp_/),
            campaign_id: campaign.id,
            kind: "pool",
            name: "Pool A",
            status: "open",
            created_by_customer_id: null,
            join_token: expect.any(String),
            promotion: expect.objectContaining({
              code: `GB-${response.data.group.join_token}`,
              status: "active",
            }),
          })
        )
        expect(new Date(response.data.group.ends_at)).toEqual(new Date(medusaCampaign.ends_at))

        // กลุ่มของแคมเปญอื่นต้องไม่ปน
        const other = await createCampaign({ group_mode: "pool" })
        expect((await postGroup(other.id)).status).toEqual(201)

        const list = await api.get(`/admin/group-buy/campaigns/${campaign.id}/groups`, headers)
        expect(list.status).toEqual(200)
        expect(list.data.count).toEqual(1)
        expect(list.data.groups.map((g: { id: string }) => g.id)).toEqual([response.data.group.id])
        expect(list.data.groups[0].promotion.code).toEqual(`GB-${response.data.group.join_token}`)
      })

      it("POST on a team-only campaign → 403 forbidden", async () => {
        const campaign = await createCampaign({ group_mode: "team" })
        const response = await postGroup(campaign.id)
        expect(response.status).toEqual(403)
      })

      it("does not accept kind from the body (pool only) → 400", async () => {
        const campaign = await createCampaign()
        const response = await postGroup(campaign.id, { kind: "team" })
        expect(response.status).toEqual(400)
      })

      it("POST on an unknown campaign → 404", async () => {
        const response = await postGroup("gbcamp_missing")
        expect(response.status).toEqual(404)
      })
    })

    describe("campaign status/time window (AC-21b)", () => {
      it.each(["draft", "ended"] as const)(
        "creating a group on a %s campaign → 400 not_allowed",
        async (status) => {
          const campaign = await createCampaign({}, status)
          const { campaign: medusaCampaign } = await graphCampaign(campaign.id)

          const response = await postGroup(campaign.id)
          expect(response.status).toEqual(400)
          expect(response.data.type).toEqual("not_allowed")
          expect(await promotionsInCampaign(medusaCampaign.id)).toHaveLength(1)
        }
      )

      it("active campaign whose Medusa campaign starts_at is in the future → 400 not_allowed, no GB- promotion", async () => {
        const campaign = await createCampaign()
        const { campaign: medusaCampaign } = await graphCampaign(campaign.id)
        await getContainer()
          .resolve(Modules.PROMOTION)
          .updateCampaigns({ id: medusaCampaign.id, starts_at: new Date(Date.now() + HOUR) })

        const response = await postGroup(campaign.id)
        expect(response.status).toEqual(400)
        expect(response.data.type).toEqual("not_allowed")

        const codes = (await promotionsInCampaign(medusaCampaign.id)).map((p) => p.code)
        expect(codes.filter((c) => c?.startsWith("GB-"))).toEqual([])
        const groupBuy: GroupBuyModuleService = getContainer().resolve(GROUP_BUY_MODULE)
        expect(await groupBuy.listGroupBuyGroups({ campaign_id: campaign.id })).toHaveLength(0)
      })
    })
  },
})
