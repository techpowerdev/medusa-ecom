import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { createAdminUser } from "../helpers/admin"
import {
  createGroupBuyCampaignWorkflow,
  type CreateGroupBuyCampaignInput,
} from "../../src/workflows/group-buy/campaign"
import { setGroupBuyCampaignStatusWorkflow } from "../../src/workflows/group-buy/campaign-status"
import { createGroupWorkflow } from "../../src/workflows/group-buy/create-group"

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

// GB-25 (spec 04 กฎข้อ 48, AC-67, ADR-026): ล็อก promotion `GB-<token>` ของกลุ่มที่ admin route ของ Medusa
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
  },
})
