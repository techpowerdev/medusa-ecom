import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import middlewares from "../../../middlewares"
import {
  GROUP_BUY_CAMPAIGN_LOCKED_MESSAGE,
  GROUP_BUY_CAMPAIGN_PROMOTIONS_MESSAGE,
  GROUP_PROMOTION_LOCKED_MESSAGE,
  guardCampaignGroupPromotions,
  guardGroupBuyCampaign,
  guardGroupPromotion,
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
})
