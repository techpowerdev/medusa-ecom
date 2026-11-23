import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { createAdminUser } from "../helpers/admin"
import {
  createGroupBuyCampaignWorkflow,
  type CreateGroupBuyCampaignInput,
} from "../../src/workflows/group-buy/campaign"
import { setGroupBuyCampaignStatusWorkflow } from "../../src/workflows/group-buy/campaign-status"
import { createGroupWorkflow } from "../../src/workflows/group-buy/create-group"
import {
  GROUP_BUY_CAMPAIGN_PROMOTIONS_MESSAGE,
  GROUP_BUY_TEMPLATE_CAMPAIGN_MESSAGE,
  GROUP_PROMOTION_LOCKED_MESSAGE,
} from "../../src/api/admin/promotions/group-buy-lock"

jest.setTimeout(180 * 1000)

const HOUR = 60 * 60 * 1000

type Res = { status: number; data: any }

// ห่อ error ของ axios เป็น { status, data } — ไม่ปล่อย object ที่มี circular reference ออกจาก test (CLAUDE.md)
const settle = (p: Promise<{ status: number; data: unknown }>): Promise<Res> =>
  p.then(
    (r) => ({ status: r.status, data: r.data }),
    (e) => {
      if (!e?.response) {
        throw new Error(`request failed without response: ${e?.message}`)
      }
      return { status: e.response.status, data: e.response.data }
    }
  )

// GB-25 (spec 04 กฎข้อ 48, AC-67, ADR-026) + GB-26 (กฎข้อ 51, AC-69, ADR-026 ภาคผนวก) + GB-29 (กฎข้อ 54, AC-72) + GB-30 (กฎข้อ 55–56, AC-73): ล็อก promotion `GB-<token>` ของกลุ่มที่ admin route ของ Medusa
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let headers: { headers: Record<string, string> }
    let productId: string

    beforeEach(async () => {
      const container = getContainer()
      const admin = await createAdminUser(container, `gb25-${Date.now()}@example.com`)
      headers = { headers: admin.headers }
      const { result } = await createProductsWorkflow(container).run({
        input: { products: [{ title: "GB-25 shirt", options: [{ title: "Size", values: ["S"] }], variants: [{ title: "S", options: { Size: "S" } }] }] },
      })
      productId = result[0].id
    })

    const campaignInput = (): CreateGroupBuyCampaignInput =>
      ({
        name: "GB-25 lock",
        target_type: "orders",
        target_value: 3,
        group_mode: "pool",
        starts_at: new Date(Date.now() - HOUR).toISOString(),
        ends_at: new Date(Date.now() + 10 * HOUR).toISOString(),
        application_method: {
          type: "percentage",
          target_type: "items",
          allocation: "each",
          max_quantity: 10,
          value: 30,
          target_rules: [{ attribute: "items.product.id", operator: "in", values: [productId] }],
        },
        rules: [{ attribute: "currency_code", operator: "in", values: ["thb"] }],
      }) as CreateGroupBuyCampaignInput

    const createCampaign = async (active = true) => {
      const container = getContainer()
      const { result } = await createGroupBuyCampaignWorkflow(container).run({ input: campaignInput() })
      if (active) {
        await setGroupBuyCampaignStatusWorkflow(container).run({ input: { id: result.id, status: "active" } })
      }
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "group_buy_campaign",
        fields: ["id", "campaign.id", "promotion.id"],
        filters: { id: result.id },
      })
      return { id: result.id, medusaCampaignId: data[0].campaign!.id, templateId: data[0].promotion!.id }
    }

    const createGroup = async (campaignId: string) => {
      const { result } = await createGroupWorkflow(getContainer()).run({
        input: { campaign_id: campaignId, kind: "pool" },
      })
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "group_buy_group", fields: ["id", "promotion.id", "promotion.code"], filters: { id: result.id } })
      return data[0].promotion! as { id: string; code: string }
    }

    const promotionValue = async (id: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "promotion", fields: ["id", "application_method.value"], filters: { id } })
      return Number(data[0]?.application_method?.value)
    }

    const expectLocked = (res: Res) => {
      expect(res.status).toEqual(400)
      expect(res.data.type).toEqual("not_allowed")
      expect(res.data.message).toContain("locked")
    }

    describe("promotion GB-<token> ของกลุ่ม", () => {
      it("(a) POST /admin/promotions/:id → 400 locked และค่าเดิมไม่เปลี่ยน", async () => {
        const campaign = await createCampaign()
        const promo = await createGroup(campaign.id)
        expect(promo.code).toMatch(/^GB-/)

        expectLocked(
          await settle(api.post(`/admin/promotions/${promo.id}`, { application_method: { value: 50 } }, headers))
        )
        expect(await promotionValue(promo.id)).toEqual(30)
      })

      it("(b) rules/batch, target-rules/batch, buy-rules/batch และ DELETE → 400 และ promotion ยังอยู่", async () => {
        const campaign = await createCampaign()
        const promo = await createGroup(campaign.id)
        const rule = { create: [{ attribute: "customer.groups.id", operator: "in", values: ["cg_x"] }] }

        for (const path of ["rules/batch", "target-rules/batch", "buy-rules/batch"]) {
          expectLocked(await settle(api.post(`/admin/promotions/${promo.id}/${path}`, rule, headers)))
        }
        expectLocked(await settle(api.delete(`/admin/promotions/${promo.id}`, headers)))
        expect(await promotionValue(promo.id)).toEqual(30)
      })
    })

    describe("promotion ที่ไม่ใช่ของกลุ่ม", () => {
      it("(c)(d) ต้นแบบ GBT-* แก้ได้ และกลุ่มใหม่ได้ส่วนลดใหม่ กลุ่มเดิมคงเดิม (Q5)", async () => {
        const campaign = await createCampaign()
        const before = await createGroup(campaign.id)

        const res = await settle(
          api.post(`/admin/promotions/${campaign.templateId}`, { application_method: { value: 50 } }, headers)
        )
        expect(res.status).toEqual(200)

        const after = await createGroup(campaign.id)
        expect(await promotionValue(after.id)).toEqual(50)
        expect(await promotionValue(before.id)).toEqual(30)
      })

      it("(c) promotion ปกติแก้และลบได้ (200)", async () => {
        const created = await settle(
          api.post(
            "/admin/promotions",
            {
              code: `GB25-NORMAL-${Date.now()}`,
              type: "standard",
              status: "active",
              application_method: { type: "fixed", target_type: "order", value: 10, currency_code: "thb" },
            },
            headers
          )
        )
        expect(created.status).toEqual(200)
        const id = created.data.promotion.id

        expect((await settle(api.post(`/admin/promotions/${id}`, { application_method: { value: 20 } }, headers))).status).toEqual(200)
        expect((await settle(api.delete(`/admin/promotions/${id}`, headers))).status).toEqual(200)
      })

      it("(e) ลบแคมเปญ draft ยังสำเร็จ (regression)", async () => {
        const campaign = await createCampaign(false)
        const res = await settle(api.delete(`/admin/group-buy/campaigns/${campaign.id}`, headers))
        expect(res.status).toEqual(200)
      })
    })

    describe("campaign ของ Medusa", () => {
      it("(f) ถอด promotion GB-* ออกจาก campaign → 400; แก้/ลบ campaign ของแคมเปญ group buy active → 400", async () => {
        const campaign = await createCampaign()
        const promo = await createGroup(campaign.id)
        const endsAt = new Date(Date.now() + 20 * HOUR).toISOString()

        expectLocked(
          await settle(
            api.post(`/admin/campaigns/${campaign.medusaCampaignId}/promotions`, { remove: [promo.id] }, headers)
          )
        )
        expectLocked(
          await settle(api.post(`/admin/campaigns/${campaign.medusaCampaignId}`, { ends_at: endsAt }, headers))
        )
        expectLocked(await settle(api.delete(`/admin/campaigns/${campaign.medusaCampaignId}`, headers)))

        const { data } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "promotion", fields: ["id", "campaign_id"], filters: { id: promo.id } })
        expect(data[0].campaign_id).toEqual(campaign.medusaCampaignId)
      })

      it("(f) campaign ของแคมเปญ group buy draft และ campaign ที่ไม่เกี่ยว → 200", async () => {
        const draft = await createCampaign(false)
        const endsAt = new Date(Date.now() + 20 * HOUR).toISOString()
        expect(
          (await settle(api.post(`/admin/campaigns/${draft.medusaCampaignId}`, { ends_at: endsAt }, headers))).status
        ).toEqual(200)

        const created = await settle(
          api.post("/admin/campaigns", { name: "GB-25 other", campaign_identifier: `gb25-${Date.now()}` }, headers)
        )
        expect(created.status).toEqual(200)
        const id = created.data.campaign.id
        expect((await settle(api.post(`/admin/campaigns/${id}`, { ends_at: endsAt }, headers))).status).toEqual(200)
        expect((await settle(api.delete(`/admin/campaigns/${id}`, headers))).status).toEqual(200)
      })
    })

    describe("GB-26 campaign ของแคมเปญ group buy (กฎข้อ 51)", () => {
      const createNormalPromotion = async (suffix: string) => {
        const res = await settle(
          api.post(
            "/admin/promotions",
            {
              code: `GB26-${suffix}-${Date.now()}`,
              type: "standard",
              status: "active",
              application_method: { type: "fixed", target_type: "order", value: 10, currency_code: "thb" },
            },
            headers
          )
        )
        expect(res.status).toEqual(200)
        return res.data.promotion.id as string
      }

      const campaignIdOf = async (id: string) => {
        const { data } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "promotion", fields: ["id", "campaign_id"], filters: { id } })
        return data[0]?.campaign_id ?? null
      }

      const expectManaged = (res: Res) => {
        expect(res.status).toEqual(400)
        expect(res.data.type).toEqual("not_allowed")
        expect(res.data.message).toEqual(GROUP_BUY_CAMPAIGN_PROMOTIONS_MESSAGE)
      }

      it.each([
        ["draft", false],
        ["active", true],
      ])("(a) แคมเปญ %s: เพิ่ม promotion ปกติ → 400, ถอด GBT-* → 400 และค่าเดิมไม่เปลี่ยน", async (_status, active) => {
        const campaign = await createCampaign(active)
        const normalId = await createNormalPromotion(String(active))
        const url = `/admin/campaigns/${campaign.medusaCampaignId}/promotions`

        expectManaged(await settle(api.post(url, { add: [normalId] }, headers)))
        expectManaged(await settle(api.post(url, { remove: [campaign.templateId] }, headers)))

        expect(await campaignIdOf(normalId)).toBeNull()
        expect(await campaignIdOf(campaign.templateId)).toEqual(campaign.medusaCampaignId)
      })

      it("(a) campaign อื่น: เพิ่ม/ถอด promotion ปกติ → 200 (regression)", async () => {
        const created = await settle(
          api.post("/admin/campaigns", { name: "GB-26 other", campaign_identifier: `gb26-${Date.now()}` }, headers)
        )
        expect(created.status).toEqual(200)
        const id = created.data.campaign.id
        const normalId = await createNormalPromotion("other")

        expect((await settle(api.post(`/admin/campaigns/${id}/promotions`, { add: [normalId] }, headers))).status).toEqual(200)
        expect(await campaignIdOf(normalId)).toEqual(id)
        expect((await settle(api.post(`/admin/campaigns/${id}/promotions`, { remove: [normalId] }, headers))).status).toEqual(200)
        expect(await campaignIdOf(normalId)).toBeNull()
      })

      it("(b) สร้างกลุ่ม → GB-* อยู่ใน campaign ของ link", async () => {
        const campaign = await createCampaign()
        const promo = await createGroup(campaign.id)
        expect(await campaignIdOf(promo.id)).toEqual(campaign.medusaCampaignId)
      })

      it("(b) ต้นแบบไม่อยู่ใน campaign ของแคมเปญ → สร้างกลุ่ม invalid_data และไม่สร้าง GB-*", async () => {
        const container = getContainer()
        const campaign = await createCampaign()
        const promotionModule = container.resolve(Modules.PROMOTION)
        const [other] = await promotionModule.createCampaigns([
          { name: "GB-26 stray", campaign_identifier: `gb26-stray-${Date.now()}` },
        ])
        // จำลองข้อมูลเพี้ยนจากการแก้ก่อนมีล็อก — ย้ายต้นแบบผ่าน module ตรง (ไม่ผ่าน route ที่ล็อก)
        await promotionModule.updatePromotions([{ id: campaign.templateId, campaign_id: other.id }])

        const err = await createGroupWorkflow(container)
          .run({ input: { campaign_id: campaign.id, kind: "pool" } })
          .then(
            () => null,
            (e: { type?: string; message?: string }) => ({ type: e?.type, message: e?.message })
          )
        expect(err?.type).toEqual("invalid_data")

        // GB-31 (กฎข้อ 57b): ดูเฉพาะ campaign ของ test (ของแคมเปญ + campaign ที่ย้ายต้นแบบไป) และกลุ่มของแคมเปญนี้ ไม่ใช่ทั้ง DB
        const promotions = await promotionModule.listPromotions(
          { campaign: { id: [campaign.medusaCampaignId, other.id] } },
          { select: ["id", "code"] }
        )
        expect(promotions.map((p) => p.code)).toEqual([expect.stringMatching(/^GBT-/)])
        const { data: groups } = await container
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "group_buy_group", fields: ["id", "promotion.code"], filters: { campaign_id: campaign.id } })
        expect(groups).toEqual([])
      })
    })

    describe("GB-29 campaign_id ของ promotion (กฎข้อ 54)", () => {
      const campaignIdOf = async (id: string) => {
        const { data } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "promotion", fields: ["id", "campaign_id"], filters: { id } })
        return data[0]?.campaign_id ?? null
      }

      const expectNotAllowed = (res: Res, message: string) => {
        expect(res.status).toEqual(400)
        expect(res.data.type).toEqual("not_allowed")
        expect(res.data.message).toEqual(message)
      }

      const normalPromotion = (suffix: string, extra: Record<string, unknown> = {}) => ({
        code: `GB29-${suffix}-${Date.now()}`,
        type: "standard",
        status: "active",
        application_method: { type: "fixed", target_type: "order", value: 10, currency_code: "thb" },
        ...extra,
      })

      const createOtherCampaign = async () => {
        const res = await settle(
          api.post("/admin/campaigns", { name: "GB-29 other", campaign_identifier: `gb29-${Date.now()}` }, headers)
        )
        expect(res.status).toEqual(200)
        return res.data.campaign.id as string
      }

      it.each([
        ["draft", false],
        ["active", true],
      ])("(a) แคมเปญ %s: ย้ายต้นแบบ GBT-* ไป campaign อื่นหรือถอดออก → 400 และ campaign เดิมคงอยู่", async (_s, active) => {
        const campaign = await createCampaign(active)
        const otherId = await createOtherCampaign()
        const url = `/admin/promotions/${campaign.templateId}`

        expectNotAllowed(await settle(api.post(url, { campaign_id: otherId }, headers)), GROUP_BUY_TEMPLATE_CAMPAIGN_MESSAGE)
        expectNotAllowed(await settle(api.post(url, { campaign_id: null }, headers)), GROUP_BUY_TEMPLATE_CAMPAIGN_MESSAGE)
        expect(await campaignIdOf(campaign.templateId)).toEqual(campaign.medusaCampaignId)
      })

      it("(b) ย้าย promotion อื่นเข้า campaign group buy → 400; สร้าง promotion ใหม่ใน campaign group buy → 400", async () => {
        const campaign = await createCampaign()
        const created = await settle(api.post("/admin/promotions", normalPromotion("move"), headers))
        expect(created.status).toEqual(200)
        const normalId = created.data.promotion.id as string

        expectNotAllowed(
          await settle(api.post(`/admin/promotions/${normalId}`, { campaign_id: campaign.medusaCampaignId }, headers)),
          GROUP_BUY_CAMPAIGN_PROMOTIONS_MESSAGE
        )
        expect(await campaignIdOf(normalId)).toBeNull()

        const code = `GB29-NEW-${Date.now()}`
        expectNotAllowed(
          await settle(
            api.post("/admin/promotions", { ...normalPromotion("new"), code, campaign_id: campaign.medusaCampaignId }, headers)
          ),
          GROUP_BUY_CAMPAIGN_PROMOTIONS_MESSAGE
        )
        const promotions = await getContainer().resolve(Modules.PROMOTION).listPromotions({ code }, { select: ["id"] })
        expect(promotions).toEqual([])
      })

      it("(c) แก้ส่วนลดต้นแบบโดยไม่แตะ campaign_id และส่ง campaign_id เดิม → 200 (Q5)", async () => {
        const campaign = await createCampaign()
        const url = `/admin/promotions/${campaign.templateId}`

        expect((await settle(api.post(url, { application_method: { value: 40 } }, headers))).status).toEqual(200)
        expect(
          (await settle(api.post(url, { campaign_id: campaign.medusaCampaignId }, headers))).status
        ).toEqual(200)
        expect(await promotionValue(campaign.templateId)).toEqual(40)
        expect(await campaignIdOf(campaign.templateId)).toEqual(campaign.medusaCampaignId)
      })

      it("(d) promotion อื่นกับ campaign ที่ไม่เกี่ยว: สร้าง/ย้าย/ถอด → 200 (regression)", async () => {
        const otherId = await createOtherCampaign()
        const created = await settle(api.post("/admin/promotions", normalPromotion("other", { campaign_id: otherId }), headers))
        expect(created.status).toEqual(200)
        const id = created.data.promotion.id as string
        expect(await campaignIdOf(id)).toEqual(otherId)

        expect((await settle(api.post(`/admin/promotions/${id}`, { campaign_id: null }, headers))).status).toEqual(200)
        expect(await campaignIdOf(id)).toBeNull()
        expect((await settle(api.post(`/admin/promotions/${id}`, { campaign_id: otherId }, headers))).status).toEqual(200)
        expect(await campaignIdOf(id)).toEqual(otherId)
      })

      it("GB-* ส่ง campaign_id → ข้อความ locked ของกฎข้อ 48 ก่อนกฎข้อ 54 (ลำดับ guard)", async () => {
        const campaign = await createCampaign()
        const promo = await createGroup(campaign.id)
        const otherId = await createOtherCampaign()

        expectNotAllowed(
          await settle(api.post(`/admin/promotions/${promo.id}`, { campaign_id: otherId }, headers)),
          GROUP_PROMOTION_LOCKED_MESSAGE
        )
        expect(await campaignIdOf(promo.id)).toEqual(campaign.medusaCampaignId)
      })

      it("(e) route สร้างแคมเปญ group buy ของเรา (createGroupBuyCampaignWorkflow) ยังผูก GBT-* กับ campaign ได้", async () => {
        const res = await settle(api.post("/admin/group-buy/campaigns", campaignInput(), headers))
        expect(res.status).toEqual(200)
        const { data } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({
            entity: "group_buy_campaign",
            fields: ["id", "campaign.id", "promotion.id", "promotion.code"],
            filters: { id: res.data.campaign.id },
          })
        expect(data[0].promotion?.code).toMatch(/^GBT-/)
        expect(await campaignIdOf(data[0].promotion!.id)).toEqual(data[0].campaign!.id)
      })
    })

    describe("GB-30 ต้นแบบ GBT-* ลบ/เปิดใช้ไม่ได้ (กฎข้อ 55–56)", () => {
      const promotionOf = async (id: string) => {
        const { data } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "promotion", fields: ["id", "status", "application_method.value"], filters: { id } })
        return data[0] as { id: string; status: string; application_method?: { value: unknown } } | undefined
      }

      const templateIdOf = async (campaignId: string) => {
        const { data } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "group_buy_campaign", fields: ["id", "promotion.id"], filters: { id: campaignId } })
        return data[0]?.promotion?.id
      }

      const expectNotAllowedContaining = (res: Res, text: string) => {
        expect(res.status).toEqual(400)
        expect(res.data.type).toEqual("not_allowed")
        expect(res.data.message).toContain(text)
      }

      const createNormal = async (suffix: string, extra: Record<string, unknown> = {}) => {
        const res = await settle(
          api.post(
            "/admin/promotions",
            {
              code: `GB30-${suffix}-${Date.now()}`,
              type: "standard",
              status: "draft",
              application_method: { type: "fixed", target_type: "order", value: 10, currency_code: "thb" },
              ...extra,
            },
            headers
          )
        )
        expect(res.status).toEqual(200)
        return res.data.promotion.id as string
      }

      // GB-31 (กฎข้อ 57b, AC-74b): ครบทุกสถานะ รวม ended (เดิม unit ครอบอย่างเดียว)
      const campaignWithStatus = async (status: "draft" | "active" | "ended") => {
        const campaign = await createCampaign(status !== "draft")
        if (status === "ended") {
          await setGroupBuyCampaignStatusWorkflow(getContainer()).run({ input: { id: campaign.id, status: "ended" } })
        }
        return campaign
      }

      it.each(["draft", "active", "ended"] as const)("(a) แคมเปญ %s: DELETE ต้นแบบ → 400 cannot be deleted และต้นแบบยังอยู่", async (status) => {
        const campaign = await campaignWithStatus(status)
        const active = status === "active"

        expectNotAllowedContaining(
          await settle(api.delete(`/admin/promotions/${campaign.templateId}`, headers)),
          "cannot be deleted"
        )
        expect((await settle(api.get(`/admin/promotions/${campaign.templateId}`, headers))).status).toEqual(200)
        expect(await templateIdOf(campaign.id)).toEqual(campaign.templateId)
        if (active) {
          const promo = await createGroup(campaign.id)
          expect(promo.code).toMatch(/^GB-/)
        }
      })

      it("(b) DELETE promotion ปกติ (ใน campaign ที่ไม่เกี่ยว และไม่อยู่ใน campaign) → 200 และ GET → 404", async () => {
        const other = await settle(
          api.post("/admin/campaigns", { name: "GB-30 other", campaign_identifier: `gb30-${Date.now()}` }, headers)
        )
        expect(other.status).toEqual(200)
        const ids = [await createNormal("in", { campaign_id: other.data.campaign.id }), await createNormal("out")]

        for (const id of ids) {
          const res = await settle(api.delete(`/admin/promotions/${id}`, headers))
          expect(res.status).toEqual(200)
          expect(res.data.deleted).toEqual(true)
          expect((await settle(api.get(`/admin/promotions/${id}`, headers))).status).toEqual(404)
        }
      })

      it("(c) DELETE GB-* → ข้อความ locked ของกฎข้อ 48 (ไม่ใช่ข้อความ template)", async () => {
        const campaign = await createCampaign()
        const promo = await createGroup(campaign.id)
        const res = await settle(api.delete(`/admin/promotions/${promo.id}`, headers))
        expect(res.status).toEqual(400)
        expect(res.data.message).toEqual(GROUP_PROMOTION_LOCKED_MESSAGE)
      })

      it("(d) ลบแคมเปญ draft ที่หน้า Group buying → 200 และต้นแบบถูกลบ (regression AC-67 (e))", async () => {
        const campaign = await createCampaign(false)
        expect((await settle(api.delete(`/admin/group-buy/campaigns/${campaign.id}`, headers))).status).toEqual(200)
        expect((await settle(api.get(`/admin/promotions/${campaign.templateId}`, headers))).status).toEqual(404)
      })

      it.each(["draft", "active", "ended"] as const)("(e) แคมเปญ %s: POST ต้นแบบ status active (รวมแบบมี field อื่นปน) → 400 cannot be activated และไม่บันทึกบางส่วน", async (status) => {
        const campaign = await campaignWithStatus(status)
        const url = `/admin/promotions/${campaign.templateId}`

        expectNotAllowedContaining(await settle(api.post(url, { status: "active" }, headers)), "cannot be activated")
        expectNotAllowedContaining(
          await settle(api.post(url, { status: "active", application_method: { value: 45 } }, headers)),
          "cannot be activated"
        )
        const template = await promotionOf(campaign.templateId)
        expect(template?.status).toEqual("draft")
        expect(Number(template?.application_method?.value)).toEqual(30)
      })

      it("(f) แก้ส่วนลดต้นแบบโดยไม่ส่ง status และตั้ง inactive → 200 ไม่เป็น active (Q5); ต้นแบบจาก route สร้างแคมเปญเป็น draft", async () => {
        const created = await settle(api.post("/admin/group-buy/campaigns", campaignInput(), headers))
        expect(created.status).toEqual(200)
        const templateId = (await templateIdOf(created.data.campaign.id))!
        expect((await promotionOf(templateId))?.status).toEqual("draft")

        const url = `/admin/promotions/${templateId}`
        expect((await settle(api.post(url, { application_method: { value: 40 } }, headers))).status).toEqual(200)
        expect(await promotionOf(templateId)).toMatchObject({ status: "draft" })
        expect(Number((await promotionOf(templateId))?.application_method?.value)).toEqual(40)

        expect((await settle(api.post(url, { status: "inactive" }, headers))).status).toEqual(200)
        expect((await promotionOf(templateId))?.status).toEqual("inactive")
      })

      it("(g) POST promotion ปกติ status active → 200 (regression)", async () => {
        const id = await createNormal("activate")
        const res = await settle(api.post(`/admin/promotions/${id}`, { status: "active" }, headers))
        expect(res.status).toEqual(200)
        expect((await promotionOf(id))?.status).toEqual("active")
      })
    })
  },
})
