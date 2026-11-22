import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import middlewares from "../../../middlewares"
import {
  GROUP_BUY_CAMPAIGN_LOCKED_MESSAGE,
  GROUP_BUY_CAMPAIGN_PROMOTIONS_MESSAGE,
  GROUP_BUY_TEMPLATE_CAMPAIGN_MESSAGE,
  GROUP_PROMOTION_LOCKED_MESSAGE,
  guardCampaignGroupPromotions,
  guardGroupBuyCampaign,
  guardGroupPromotion,
  guardPromotionCampaign,
} from "../group-buy-lock"

// GB-25 (spec 04 กฎข้อ 48, AC-67, ADR-026): guard ด้วย mock query — พฤติกรรมจริงพิสูจน์ใน group-buy-promotion-lock.spec.ts
function setup(rows: Record<string, unknown>[], body?: unknown) {
  const graph = jest.fn(async () => ({ data: rows }))
  const services: Record<string, unknown> = { [ContainerRegistrationKeys.QUERY]: { graph } }
  const req = { params: { id: "x_1" }, body, scope: { resolve: (key: string) => services[key] } } as any
  const next = jest.fn()
  return { req, next, graph }
}

describe("guardGroupPromotion", () => {
  it("promotion ที่ผูก group_buy_group → NOT_ALLOWED ข้อความ locked", async () => {
    const { req, next } = setup([{ id: "x_1", group_buy_group: { id: "gbgrp_1" } }])
    await expect(guardGroupPromotion(req, {} as any, next)).rejects.toMatchObject({
      type: "not_allowed",
      message: GROUP_PROMOTION_LOCKED_MESSAGE,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it.each([[[{ id: "x_1", group_buy_group: null }]], [[]]])("promotion อื่น/ไม่พบ → next()", async (rows) => {
    const { req, next, graph } = setup(rows)
    await guardGroupPromotion(req, {} as any, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(graph).toHaveBeenCalledTimes(1)
  })
})

describe("guardCampaignGroupPromotions", () => {
  it("รวม id จาก add + remove แล้ว query ครั้งเดียว", async () => {
    const { req, next, graph } = setup([{ id: "p_2", group_buy_group: { id: "gbgrp_1" } }], {
      add: ["p_1"],
      remove: ["p_2", 3],
    })
    await expect(guardCampaignGroupPromotions(req, {} as any, next)).rejects.toMatchObject({ type: "not_allowed" })
    expect(graph).toHaveBeenCalledTimes(1)
    expect(graph.mock.calls[0]).toEqual([expect.objectContaining({ filters: { id: ["p_1", "p_2"] } })])
  })

  it.each([[undefined], [{}], [{ add: "p_1" }]])("ไม่มี id ที่เป็น array (%p) → ไม่ query promotion; campaign ไม่ผูก → next()", async (body) => {
    const { req, next, graph } = setup([], body)
    await guardCampaignGroupPromotions(req, {} as any, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(graph.mock.calls.map(([arg]: any) => arg.entity)).toEqual(["campaign"])
  })

  // GB-26 (spec 04 กฎข้อ 51a, AC-69a, ADR-026 ภาคผนวก): campaign ที่ผูก group_buy_campaign → 400 ทุกกรณี ทุกสถานะ
  function setupByEntity(rows: Record<string, Record<string, unknown>[]>, body?: unknown) {
    const graph = jest.fn(async ({ entity }: { entity: string }) => ({ data: rows[entity] ?? [] }))
    const services: Record<string, unknown> = { [ContainerRegistrationKeys.QUERY]: { graph } }
    const req = { params: { id: "camp_1" }, body, scope: { resolve: (key: string) => services[key] } } as any
    return { req, next: jest.fn(), graph }
  }

  it.each([
    ["draft", { add: ["p_normal"] }],
    ["active", { remove: ["p_template"] }],
    ["ended", { add: ["p_normal"], remove: ["p_template"] }],
  ])("campaign ของแคมเปญ group buy %s (%p) → NOT_ALLOWED ข้อความ managed by Group buying", async (status, body) => {
    const { req, next } = setupByEntity(
      {
        promotion: [{ id: "p_normal", group_buy_group: null }, { id: "p_template", group_buy_group: null }],
        campaign: [{ id: "camp_1", group_buy_campaign: { id: "gbc_1", status } }],
      },
      body
    )
    await expect(guardCampaignGroupPromotions(req, {} as any, next)).rejects.toMatchObject({
      type: "not_allowed",
      message: GROUP_BUY_CAMPAIGN_PROMOTIONS_MESSAGE,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it("campaign ไม่ผูก group buy + promotion ปกติ → next()", async () => {
    const { req, next } = setupByEntity(
      { promotion: [{ id: "p_normal", group_buy_group: null }], campaign: [{ id: "camp_1", group_buy_campaign: null }] },
      { add: ["p_normal"] }
    )
    await guardCampaignGroupPromotions(req, {} as any, next)
    expect(next).toHaveBeenCalledTimes(1)
  })
})

describe("guardGroupBuyCampaign", () => {
  it.each(["active", "ended"])("campaign ของแคมเปญ group buy %s → NOT_ALLOWED", async (status) => {
    const { req, next } = setup([{ id: "x_1", group_buy_campaign: { status } }])
    await expect(guardGroupBuyCampaign(req, {} as any, next)).rejects.toMatchObject({
      type: "not_allowed",
      message: GROUP_BUY_CAMPAIGN_LOCKED_MESSAGE,
    })
  })

  it.each([[[{ id: "x_1", group_buy_campaign: { status: "draft" } }]], [[{ id: "x_1", group_buy_campaign: null }]], [[]]])(
    "draft/ไม่เกี่ยว group buy/ไม่พบ → next()",
    async (rows) => {
      const { req, next } = setup(rows)
      await guardGroupBuyCampaign(req, {} as any, next)
      expect(next).toHaveBeenCalledTimes(1)
    }
  )
})

// GB-29 (spec 04 กฎข้อ 54, AC-72, ADR-026 ภาคผนวกรอบ 41): campaign_id ของ promotion ที่ admin route
describe("guardPromotionCampaign", () => {
  function setupPromotion(rows: Record<string, Record<string, unknown>[]>, body: unknown, id?: string) {
    const graph = jest.fn(async ({ entity }: { entity: string }) => ({ data: rows[entity] ?? [] }))
    const services: Record<string, unknown> = { [ContainerRegistrationKeys.QUERY]: { graph } }
    const req = { params: id ? { id } : {}, body, scope: { resolve: (key: string) => services[key] } } as any
    return { req, next: jest.fn(), graph }
  }
  const template = { id: "p_tpl", campaign_id: "camp_gb", group_buy_campaign: { id: "gbc_1" } }
  const normal = { id: "p_norm", campaign_id: null, group_buy_campaign: null }
  const gbCampaign = { id: "camp_gb", group_buy_campaign: { id: "gbc_1" } }
  const otherCampaign = { id: "camp_other", group_buy_campaign: null }

  it.each([["camp_other"], [null]])("(1) ย้าย GBT-* ไป campaign_id=%p → NOT_ALLOWED ข้อความ template", async (campaignId) => {
    const { req, next } = setupPromotion(
      { promotion: [template], campaign: [otherCampaign] },
      { campaign_id: campaignId },
      "p_tpl"
    )
    await expect(guardPromotionCampaign(req, {} as any, next)).rejects.toMatchObject({
      type: "not_allowed",
      message: GROUP_BUY_TEMPLATE_CAMPAIGN_MESSAGE,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it("(2) แก้ promotion อื่นให้ campaign_id เป็น campaign group buy → NOT_ALLOWED ข้อความ managed", async () => {
    const { req, next } = setupPromotion({ promotion: [normal], campaign: [gbCampaign] }, { campaign_id: "camp_gb" }, "p_norm")
    await expect(guardPromotionCampaign(req, {} as any, next)).rejects.toMatchObject({
      type: "not_allowed",
      message: GROUP_BUY_CAMPAIGN_PROMOTIONS_MESSAGE,
    })
  })

  it("(2) สร้าง promotion (ไม่มี :id) ด้วย campaign_id ของ campaign group buy → NOT_ALLOWED", async () => {
    const { req, next, graph } = setupPromotion({ campaign: [gbCampaign] }, { code: "X", campaign_id: "camp_gb" })
    await expect(guardPromotionCampaign(req, {} as any, next)).rejects.toMatchObject({
      type: "not_allowed",
      message: GROUP_BUY_CAMPAIGN_PROMOTIONS_MESSAGE,
    })
    expect(graph.mock.calls.map(([arg]: any) => arg.entity)).toEqual(["campaign"])
  })

  it.each([
    ["ไม่แตะ campaign_id (แก้ส่วนลดต้นแบบ — Q5)", { application_method: { value: 50 } }, "p_tpl", []],
    ["body ว่าง", undefined, "p_tpl", []],
    ["ส่ง campaign_id เดิมของต้นแบบ (ไม่เปลี่ยน)", { campaign_id: "camp_gb" }, "p_tpl", ["promotion"]],
    ["promotion อื่นย้ายไป campaign ที่ไม่เกี่ยว", { campaign_id: "camp_other" }, "p_norm", ["promotion", "campaign"]],
    ["promotion อื่นถอดออกจาก campaign", { campaign_id: null }, "p_norm", ["promotion"]],
    ["สร้างด้วย campaign ที่ไม่เกี่ยว", { campaign_id: "camp_other" }, undefined, ["campaign"]],
    ["สร้างโดยไม่มี campaign_id", { code: "X" }, undefined, []],
    ["promotion ไม่พบ", { campaign_id: "camp_gb" }, "p_missing", ["promotion"]],
  ])("%s → next()", async (_name, body, id, entities) => {
    const { req, next, graph } = setupPromotion(
      { promotion: id === "p_missing" ? [] : [template, normal].filter((p) => p.id === id), campaign: [otherCampaign] },
      body,
      id
    )
    await guardPromotionCampaign(req, {} as any, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(graph.mock.calls.map(([arg]: any) => arg.entity)).toEqual(entities)
  })
})

describe("ลงทะเบียนใน src/api/middlewares.ts", () => {
  // defineMiddlewares แปลง `method` เป็น `methods`
  const routes = (middlewares.routes ?? []) as { matcher: unknown; methods?: string[]; middlewares?: unknown[] }[]
  const find = (matcher: string) => routes.find((r) => r.matcher === matcher)

  it.each([
    ["/admin/promotions/:id", ["POST", "DELETE"], guardGroupPromotion],
    ["/admin/promotions/:id/*", ["POST", "DELETE"], guardGroupPromotion],
    ["/admin/campaigns/:id/promotions", ["POST"], guardCampaignGroupPromotions],
    ["/admin/campaigns/:id", ["POST", "DELETE"], guardGroupBuyCampaign],
  ])("%s", (matcher, methods, guard) => {
    const route = find(matcher)
    expect(route?.methods).toEqual(methods)
    expect(route?.middlewares).toContain(guard)
  })

  // GB-29: route สร้าง/แก้ promotion รับ campaign_id — กันทั้งสองทาง
  it.each(["/admin/promotions", "/admin/promotions/:id"])("%s POST → guardPromotionCampaign", (matcher) => {
    const route = routes.find((r) => r.matcher === matcher && r.middlewares?.includes(guardPromotionCampaign))
    expect(route?.methods).toEqual(["POST"])
  })
})
