import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import middlewares from "../../../middlewares"
import {
  GROUP_BUY_CAMPAIGN_LOCKED_MESSAGE,
  GROUP_BUY_CAMPAIGN_PROMOTIONS_MESSAGE,
  GROUP_BUY_TEMPLATE_ACTIVATE_MESSAGE,
  GROUP_BUY_TEMPLATE_CAMPAIGN_MESSAGE,
  GROUP_BUY_TEMPLATE_DELETE_MESSAGE,
  GROUP_PROMOTION_LOCKED_MESSAGE,
  guardCampaignGroupPromotions,
  guardGroupBuyCampaign,
  guardGroupPromotion,
  guardPromotionCampaign,
  guardTemplateDelete,
  guardTemplateStatus,
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

// GB-30 (spec 04 กฎข้อ 55–56, AC-73, ADR-026 ภาคผนวก 2026-11-23): ต้นแบบ GBT-* ลบไม่ได้ และเปิดใช้ (status active) ไม่ได้
describe("guardTemplateDelete / guardTemplateStatus", () => {
  function setupTemplate(rows: Record<string, unknown>[], body?: unknown) {
    const graph = jest.fn(async () => ({ data: rows }))
    const services: Record<string, unknown> = { [ContainerRegistrationKeys.QUERY]: { graph } }
    const req = { params: { id: "p_tpl" }, body, scope: { resolve: (key: string) => services[key] } } as any
    return { req, next: jest.fn(), graph }
  }
  const template = (status: string) => ({
    id: "p_tpl",
    campaign_id: "camp_gb",
    group_buy_campaign: { id: "gbc_1", status },
  })
  const normal = { id: "p_tpl", campaign_id: null, group_buy_campaign: null }

  it.each(["draft", "active", "ended"])("DELETE ต้นแบบของแคมเปญ %s → NOT_ALLOWED ข้อความ cannot be deleted", async (status) => {
    const { req, next } = setupTemplate([template(status)])
    await expect(guardTemplateDelete(req, {} as any, next)).rejects.toMatchObject({
      type: "not_allowed",
      message: GROUP_BUY_TEMPLATE_DELETE_MESSAGE,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it.each([[[normal]], [[]]])("DELETE promotion ที่ไม่ผูก template/ไม่พบ → next()", async (rows) => {
    const { req, next } = setupTemplate(rows)
    await guardTemplateDelete(req, {} as any, next)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it("DELETE GB-* → ข้อความ locked ของกฎข้อ 48 (guardGroupPromotion อยู่ก่อนบน matcher เดียวกัน)", async () => {
    const { req, next } = setupTemplate([{ id: "p_tpl", group_buy_group: { id: "gbgrp_1" }, group_buy_campaign: null }])
    await expect(guardGroupPromotion(req, {} as any, next)).rejects.toMatchObject({ message: GROUP_PROMOTION_LOCKED_MESSAGE })
  })

  it.each([
    ["draft", { status: "active" }],
    ["active", { status: "active", application_method: { value: 50 } }],
    ["ended", { status: "active" }],
  ])("POST ต้นแบบของแคมเปญ %s body %p → NOT_ALLOWED ข้อความ cannot be activated", async (status, body) => {
    const { req, next } = setupTemplate([template(status)], body)
    await expect(guardTemplateStatus(req, {} as any, next)).rejects.toMatchObject({
      type: "not_allowed",
      message: GROUP_BUY_TEMPLATE_ACTIVATE_MESSAGE,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it.each([
    ["ไม่มี key status", { application_method: { value: 50 } }],
    ["body ว่าง", undefined],
    ["status draft", { status: "draft" }],
    ["status inactive", { status: "inactive" }],
  ])("POST ต้นแบบ %s → next() โดยไม่ query", async (_name, body) => {
    const { req, next, graph } = setupTemplate([template("active")], body)
    await guardTemplateStatus(req, {} as any, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(graph).not.toHaveBeenCalled()
  })

  it.each([[[normal]], [[]]])("POST status active ของ promotion ที่ไม่ผูก template/ไม่พบ → next()", async (rows) => {
    const { req, next } = setupTemplate(rows, { status: "active" })
    await guardTemplateStatus(req, {} as any, next)
    expect(next).toHaveBeenCalledTimes(1)
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

  // GB-30: guard ลบอยู่บน DELETE /admin/promotions/:id เท่านั้น; guard status อยู่บน POST /admin/promotions/:id หลัง guard campaign_id
  it.each([
    ["guardTemplateDelete", guardTemplateDelete, "/admin/promotions/:id", ["DELETE"]],
    ["guardTemplateStatus", guardTemplateStatus, "/admin/promotions/:id", ["POST"]],
  ])("%s อยู่บน matcher เดียว", (_name, guard, matcher, methods) => {
    const found = routes.filter((r) => r.middlewares?.includes(guard))
    expect(found.map((r) => [r.matcher, r.methods])).toEqual([[matcher, methods]])
  })

  it("ลำดับบน POST /admin/promotions/:id: campaign_id (กฎข้อ 54) → status (กฎข้อ 56)", () => {
    const route = routes.find((r) => r.matcher === "/admin/promotions/:id" && r.middlewares?.includes(guardTemplateStatus))
    const list = route?.middlewares ?? []
    expect(list.indexOf(guardPromotionCampaign)).toBeGreaterThanOrEqual(0)
    expect(list.indexOf(guardPromotionCampaign)).toBeLessThan(list.indexOf(guardTemplateStatus))
  })

  // GB-31 (spec 04 กฎข้อ 57b, AC-74b): entry ของ guardGroupPromotion อยู่ก่อน guardTemplateDelete บน DELETE /admin/promotions/:id
  // → DELETE GB-* ได้ข้อความ locked (กฎข้อ 48) ก่อนข้อความ template (กฎข้อ 55)
  it("ลำดับบน DELETE /admin/promotions/:id: GB-* locked (กฎข้อ 48) → ต้นแบบ (กฎข้อ 55)", () => {
    const onDelete = routes.filter((r) => r.matcher === "/admin/promotions/:id" && r.methods?.includes("DELETE"))
    const at = (guard: unknown) => onDelete.findIndex((r) => r.middlewares?.includes(guard))
    expect(at(guardGroupPromotion)).toBeGreaterThanOrEqual(0)
    expect(at(guardGroupPromotion)).toBeLessThan(at(guardTemplateDelete))
  })

  // GB-31 (กฎข้อ 57b, AC-74b): guard ทุกตัวบน matcher เดียวกันอ่าน link ครั้งเดียวต่อ request ต่อ entity (เดิม promotion :id ถูก query 2–3 ครั้ง)
  describe("request เดียวผ่าน guard ทุกตัวตามลำดับที่ลงทะเบียน → query.graph 1 ครั้งต่อ entity", () => {
    const guards = new Set<unknown>([
      guardGroupPromotion,
      guardCampaignGroupPromotions,
      guardGroupBuyCampaign,
      guardPromotionCampaign,
      guardTemplateDelete,
      guardTemplateStatus,
    ])

    // รัน guard ของเราตามลำดับใน middlewares.ts เหมือน router: หยุดเมื่อ guard ไม่เรียก next() หรือ throw
    async function runChain(method: string, matcher: string, req: unknown) {
      const chain = routes
        .filter((r) => r.matcher === matcher && r.methods?.includes(method))
        .flatMap((r) => (r.middlewares ?? []).filter((m) => guards.has(m))) as ((...args: unknown[]) => Promise<void>)[]
      for (const guard of chain) {
        let passed = false
        await guard(req, {}, () => {
          passed = true
        })
        if (!passed) {
          return
        }
      }
    }

    function setupChain(rows: Record<string, Record<string, unknown>[]>, id: string, body?: unknown) {
      const graph = jest.fn(async ({ entity }: { entity: string }) => ({ data: rows[entity] ?? [] }))
      const services: Record<string, unknown> = { [ContainerRegistrationKeys.QUERY]: { graph } }
      const req = { params: { id }, body, scope: { resolve: (key: string) => services[key] } } as any
      const entities = () => graph.mock.calls.map(([arg]: any) => arg.entity)
      return { req, graph, entities }
    }
    const template = { id: "p_tpl", campaign_id: "camp_gb", group_buy_group: null, group_buy_campaign: { id: "gbc_1" } }
    const normal = { id: "p_norm", campaign_id: null, group_buy_group: null, group_buy_campaign: null }
    const group = { id: "p_gb", campaign_id: "camp_gb", group_buy_group: { id: "gbgrp_1" }, group_buy_campaign: null }

    it("POST ต้นแบบ { campaign_id เดิม, status: draft } → promotion 1 ครั้ง และผ่าน", async () => {
      const { req, entities } = setupChain({ promotion: [template] }, "p_tpl", { campaign_id: "camp_gb", status: "draft" })
      await runChain("POST", "/admin/promotions/:id", req)
      expect(entities()).toEqual(["promotion"])
    })

    it("POST ต้นแบบ { campaign_id เดิม, status: active } → promotion 1 ครั้ง และ cannot be activated", async () => {
      const { req, entities } = setupChain({ promotion: [template] }, "p_tpl", { campaign_id: "camp_gb", status: "active" })
      await expect(runChain("POST", "/admin/promotions/:id", req)).rejects.toMatchObject({
        message: GROUP_BUY_TEMPLATE_ACTIVATE_MESSAGE,
      })
      expect(entities()).toEqual(["promotion"])
    })

    it("POST promotion อื่น { campaign_id ใหม่, status: active } → promotion 1 + campaign 1 ครั้ง", async () => {
      const { req, entities } = setupChain(
        { promotion: [normal], campaign: [{ id: "camp_other", group_buy_campaign: null }] },
        "p_norm",
        { campaign_id: "camp_other", status: "active" }
      )
      await runChain("POST", "/admin/promotions/:id", req)
      expect(entities().sort()).toEqual(["campaign", "promotion"])
    })

    it("POST GB-* { campaign_id } → ข้อความ locked และ promotion 1 ครั้ง", async () => {
      const { req, entities } = setupChain({ promotion: [group] }, "p_gb", { campaign_id: null })
      await expect(runChain("POST", "/admin/promotions/:id", req)).rejects.toMatchObject({
        message: GROUP_PROMOTION_LOCKED_MESSAGE,
      })
      expect(entities()).toEqual(["promotion"])
    })

    it.each([
      ["ต้นแบบ", template, GROUP_BUY_TEMPLATE_DELETE_MESSAGE],
      ["GB-*", group, GROUP_PROMOTION_LOCKED_MESSAGE],
    ])("DELETE %s → promotion 1 ครั้ง", async (_name, row, message) => {
      const { req, entities } = setupChain({ promotion: [row] }, row.id)
      await expect(runChain("DELETE", "/admin/promotions/:id", req)).rejects.toMatchObject({ message })
      expect(entities()).toEqual(["promotion"])
    })

    it("DELETE promotion อื่น → promotion 1 ครั้ง และผ่าน", async () => {
      const { req, entities } = setupChain({ promotion: [normal] }, "p_norm")
      await runChain("DELETE", "/admin/promotions/:id", req)
      expect(entities()).toEqual(["promotion"])
    })
  })
})
