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
    is_tax_inclusive: boolean
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
    let productYId: string // sweatshirt (สินค้าที่ 2 — กฎข้อ 30)
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
      productYId = must(byHandle["sweatshirt"], "sweatshirt").id
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
      const res = await api
        .post("/admin/group-buy/campaigns", campaignInput(data), headers)
        .catch((e) => {
          throw new Error(`create campaign: ${e.response?.status} ${JSON.stringify(e.response?.data)}`)
        })
      expect(res.status).toBe(200)
      return res.data.campaign
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
          "promotion.is_tax_inclusive",
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

      // GB-2c (กฎข้อ 12, AC-20c): ต้นแบบ is_tax_inclusive ค่าเริ่มต้น true; admin ส่ง false ได้; ไม่ใช่ boolean → 400
      it("template is_tax_inclusive defaults to true, keeps false, and rejects a non-boolean (AC-20c)", async () => {
        const byDefault = await createViaApi()
        expect((await graphCampaign(byDefault.id)).promotion.is_tax_inclusive).toBe(true)

        const exclusive = await createViaApi({ is_tax_inclusive: false })
        expect((await graphCampaign(exclusive.id)).promotion.is_tax_inclusive).toBe(false)

        const invalid = await api
          .post("/admin/group-buy/campaigns", { ...campaignInput(), is_tax_inclusive: "yes" }, headers)
          .catch((e) => e.response)
        expect(invalid.status).toEqual(400)

        // workflow ใช้ค่าเริ่มต้นเดียวกันเมื่อถูกเรียกตรง (ไม่ผ่าน validator)
        const { result } = await createGroupBuyCampaignWorkflow(getContainer()).run({
          input: campaignInput(),
        })
        expect((await graphCampaign(result.id)).promotion.is_tax_inclusive).toBe(true)
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

    // GB-13 (spec 04 กฎข้อ 33, AC-52): idempotency_key กันสร้างแคมเปญซ้ำเมื่อยิงซ้ำ/พร้อมกัน
    describe("idempotency_key (AC-52)", () => {
      const KEY = "gb13-key-0001"
      const counts = async () => {
        const promotionModule = getContainer().resolve(Modules.PROMOTION)
        const promotions = await promotionModule.listPromotions({}, { select: ["id", "code"] })
        return {
          groupBuyCampaigns: (
            await getContainer().resolve<GroupBuyModuleService>(GROUP_BUY_MODULE).listGroupBuyCampaigns({})
          ).length,
          campaigns: (await promotionModule.listCampaigns({}, { select: ["id"] })).length,
          templates: promotions.filter((p) => p.code?.startsWith("GBT-")).length,
        }
      }
      const post = (body: Record<string, unknown>) =>
        api.post("/admin/group-buy/campaigns", body, headers).catch((e) => {
          // ห่อ error ของ axios (circular) เป็น response ธรรมดา
          if (!e.response) {
            throw new Error(`create campaign: ${e.message}`)
          }
          return { status: e.response.status as number, data: e.response.data }
        })
      const plus = (base: Awaited<ReturnType<typeof counts>>, n: number) => ({
        groupBuyCampaigns: base.groupBuyCampaigns + n,
        campaigns: base.campaigns + n,
        templates: base.templates + n,
      })

      it("two concurrent POSTs with key K → both 200 with the same campaign; one of each is created", async () => {
        const before = await counts()
        const [a, b] = await Promise.all([
          post({ ...campaignInput(), idempotency_key: KEY }),
          post({ ...campaignInput(), idempotency_key: KEY }),
        ])

        expect([a.status, b.status]).toEqual([200, 200])
        expect(a.data.campaign.id).toEqual(b.data.campaign.id)
        expect(a.data.campaign.template_promotion_id).toEqual(b.data.campaign.template_promotion_id)
        expect(await counts()).toEqual(plus(before, 1))
        expect((await graphCampaign(a.data.campaign.id)).campaign.campaign_identifier).toEqual(`group-buy-${KEY}`)
      })

      it("POST K again later (different body) → 200 same id, nothing new; key K2 → a new campaign", async () => {
        const first = await post({ ...campaignInput(), idempotency_key: KEY })
        expect(first.status).toEqual(200)
        const afterFirst = await counts()

        const again = await post({ ...campaignInput({ name: "GB other body" }), idempotency_key: KEY })
        expect(again.status).toEqual(200)
        expect(again.data.campaign).toEqual(first.data.campaign)
        expect(await counts()).toEqual(afterFirst)

        const other = await post({ ...campaignInput(), idempotency_key: "gb13-key-0002" })
        expect(other.status).toEqual(200)
        expect(other.data.campaign.id).not.toEqual(first.data.campaign.id)
        expect(await counts()).toEqual(plus(afterFirst, 1))
      })

      it("no key twice → two campaigns (previous behaviour)", async () => {
        const before = await counts()
        const a = await createViaApi()
        const b = await createViaApi()
        expect(a.id).not.toEqual(b.id)
        expect(await counts()).toEqual(plus(before, 2))
        expect((await graphCampaign(a.id)).campaign.campaign_identifier).toMatch(/^group-buy-[0-9a-f-]{36}$/)
      })

      it.each([
        ["with a space", "a b"],
        ["129 characters", "k".repeat(129)],
        ["7 characters", "k".repeat(7)],
      ])("key %s → 400 invalid_data; nothing is created", async (_, key) => {
        const before = await counts()
        const response = await post({ ...campaignInput(), idempotency_key: key })
        expect(response.status).toEqual(400)
        expect(response.data.type).toEqual("invalid_data")
        expect(await counts()).toEqual(before)
      })

      it("accepts a 128-character key", async () => {
        const response = await post({ ...campaignInput(), idempotency_key: "K".repeat(128) })
        expect(response.status).toEqual(200)
      })

      it("createGroupBuyCampaignWorkflow called directly and concurrently with the same key → one campaign", async () => {
        const before = await counts()
        const run = () =>
          createGroupBuyCampaignWorkflow(getContainer()).run({
            input: { ...campaignInput(), idempotency_key: "gb13-direct-01" },
          })
        const [a, b] = await Promise.all([run(), run()])
        expect(a.result.id).toEqual(b.result.id)
        expect(a.result.template_promotion_id).toEqual(b.result.template_promotion_id)
        expect(await counts()).toEqual(plus(before, 1))
      })
    })

    // GB-6e (spec 04 กฎข้อ 30a–b, AC-49): 1 แคมเปญ = 1 สินค้า
    describe("single product scope (AC-49)", () => {
      const CODE = "GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED"
      const promotionModule = () => getContainer().resolve(Modules.PROMOTION)
      const counts = async () => ({
        campaigns: (await promotionModule().listCampaigns({}, { select: ["id"] })).length,
        promotions: (await promotionModule().listPromotions({}, { select: ["id"] })).length,
        groupBuyCampaigns: (
          await getContainer().resolve<GroupBuyModuleService>(GROUP_BUY_MODULE).listGroupBuyCampaigns({})
        ).length,
      })
      const scope = (target_rules: unknown[]) =>
        ({
          type: "percentage",
          target_type: "items",
          allocation: "each",
          max_quantity: 10,
          value: 30,
          target_rules,
        }) as CreateGroupBuyCampaignInput["application_method"]

      // route นี้ตอบ 200 ตั้งแต่ GB-2a (AC-49 เขียน 201 — คงพฤติกรรมเดิม ดูหมายเหตุใน PR)
      it("POST with one product → 200", async () => {
        const response = await api
          .post("/admin/group-buy/campaigns", campaignInput(), headers)
          .catch((e) => e.response)
        expect(response.status).toEqual(200)
      })

      it.each([
        ["two products", () => [{ attribute: "items.product.id", operator: "in", values: [productXId, productYId] }]],
        ["values: []", () => [{ attribute: "items.product.id", operator: "in", values: [] }]],
        ["no items.product.id rule", () => []],
        ["a variant-level scope", () => [{ attribute: "items.variant_id", operator: "in", values: [variantXId] }]],
      ])("POST with %s → 400 invalid_data with the code; no Medusa campaign/promotion is created", async (_, rules) => {
        const before = await counts()
        const response = await api
          .post("/admin/group-buy/campaigns", campaignInput({ application_method: scope(rules()) }), headers)
          .catch((e) => e.response)

        expect(response.status).toEqual(400)
        expect(response.data.type).toEqual("invalid_data")
        expect(response.data.message).toContain(CODE)
        expect(await counts()).toEqual(before)
      })

      it("createGroupBuyCampaignWorkflow called directly with two products → same code; nothing is created", async () => {
        const before = await counts()
        const { errors } = await createGroupBuyCampaignWorkflow(getContainer()).run({
          input: campaignInput({
            application_method: scope([
              { attribute: "items.product.id", operator: "in", values: [productXId, productYId] },
            ]),
          }),
          throwOnError: false,
        })

        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0].action).toEqual("validate-group-buy-single-product-scope")
        expect(errors[0].error).toEqual(expect.objectContaining({ type: "invalid_data", code: CODE }))
        expect(await counts()).toEqual(before)
      })

      it("draft whose template was edited to two products via the Promotion module → activate 400, still draft", async () => {
        const created = await createViaApi()
        const [template] = await promotionModule().listPromotions(
          { id: created.template_promotion_id },
          { relations: ["application_method.target_rules"] }
        )
        const rule = must(template.application_method?.target_rules?.[0], "template target rule")
        await promotionModule().updatePromotionRules([{ id: rule.id, values: [productXId, productYId] }])

        const response = await setStatus(created.id, "active")
        expect(response.status).toEqual(400)
        expect(response.data.type).toEqual("not_allowed")
        expect(response.data.message).toContain(CODE)
        expect((await graphCampaign(created.id)).status).toEqual("draft")
      })
    })
  },
})
