import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

// GB-25 (spec 04 กฎข้อ 48, ADR-026): ส่วนลดของกลุ่ม (`GB-<token>`) ล็อกตลอดอายุกลุ่ม — สมาชิกกลุ่มเดียวกันได้ส่วนลดเท่ากัน
// กันที่ admin route ของ Medusa เท่านั้น; เส้นทางภายใน (createGroupWorkflow, ลบแคมเปญ draft) เรียก workflow ตรงจึงไม่ผ่าน
// ต้นแบบ `GBT-*` ไม่ผูก group_buy_group จึงแก้ได้ (Q5)
export const GROUP_PROMOTION_LOCKED_MESSAGE =
  "This promotion belongs to a group-buy group; its discount is locked. Edit the campaign template for new groups."
export const GROUP_BUY_CAMPAIGN_LOCKED_MESSAGE =
  "This campaign belongs to a group-buy campaign that is not a draft; it is locked. Change it under Group buying instead."
export const GROUP_BUY_CAMPAIGN_PROMOTIONS_MESSAGE =
  "This campaign belongs to a group-buy campaign; its promotions are managed by Group buying."
export const GROUP_BUY_TEMPLATE_CAMPAIGN_MESSAGE =
  "This promotion is the template of a group-buy campaign; its campaign is managed by Group buying."

const query = (req: MedusaRequest) => req.scope.resolve<RemoteQueryFunction>(ContainerRegistrationKeys.QUERY)

async function hasGroupPromotion(req: MedusaRequest, ids: string[]) {
  if (!ids.length) {
    return false
  }
  const { data } = await query(req).graph({
    entity: "promotion",
    fields: ["id", "group_buy_group.id"],
    filters: { id: ids },
  })
  return data.some((p) => !!p.group_buy_group?.id)
}

async function linkedGroupBuyCampaign(req: MedusaRequest, id = req.params.id) {
  const { data } = await query(req).graph({
    entity: "campaign",
    fields: ["id", "group_buy_campaign.id", "group_buy_campaign.status"],
    filters: { id },
  })
  return data[0]?.group_buy_campaign
}

const lockedPromotion = () => new MedusaError(MedusaError.Types.NOT_ALLOWED, GROUP_PROMOTION_LOCKED_MESSAGE)

export async function guardGroupPromotion(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  if (await hasGroupPromotion(req, [req.params.id])) {
    throw lockedPromotion()
  }
  next()
}

// POST /admin/campaigns/:id/promotions { add, remove } — ถอด/เพิ่ม promotion ของกลุ่มเปลี่ยน campaign (budget/ช่วงเวลา) ของส่วนลดนั้น
// (เช็กก่อน campaign เพื่อคงข้อความ locked ของ GB-25 เมื่อแตะ GB-*)
export async function guardCampaignGroupPromotions(
  req: MedusaRequest<{ add?: unknown; remove?: unknown }>,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const ids = [req.body?.add, req.body?.remove]
    .flatMap((list) => (Array.isArray(list) ? list : []))
    .filter((id): id is string => typeof id === "string")
  if (await hasGroupPromotion(req, ids)) {
    throw lockedPromotion()
  }
  // GB-26 (กฎข้อ 51a, ADR-026 ภาคผนวก): campaign ของแคมเปญ group buy → ห้ามเพิ่ม/ถอด promotion ใดๆ ทุกสถานะ
  // ต้นแบบ/โค้ดกลุ่มถูกผูกโดย workflow ของเราที่ไม่ผ่าน route นี้
  if (await linkedGroupBuyCampaign(req)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, GROUP_BUY_CAMPAIGN_PROMOTIONS_MESSAGE)
  }
  next()
}

// POST/DELETE /admin/campaigns/:id — campaign ของแคมเปญ group buy ที่ไม่ใช่ draft: เปลี่ยน ends_at ทำให้กลุ่มเดิมผิดกฎข้อ 2/10
export async function guardGroupBuyCampaign(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const status = (await linkedGroupBuyCampaign(req))?.status
  if (status && status !== "draft") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, GROUP_BUY_CAMPAIGN_LOCKED_MESSAGE)
  }
  next()
}

// GB-29 (กฎข้อ 54, ADR-026 ภาคผนวกรอบ 41): ทางอ้อมของกฎข้อ 51a — `campaign_id` ใน body ของ
// POST /admin/promotions (สร้าง) และ POST /admin/promotions/:id (แก้ — ส่วน "Campaign" ของหน้า promotion)
// แก้ส่วนลด/rule ของต้นแบบโดยไม่ส่ง campaign_id หรือส่งค่าเดิม → next() (Q5); workflow ของเราผูก GBT-* โดยไม่ผ่าน route นี้
export async function guardPromotionCampaign(
  req: MedusaRequest<{ campaign_id?: unknown }>,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (!req.body || !("campaign_id" in req.body)) {
    return next()
  }
  const target = req.body.campaign_id ?? null
  if (req.params?.id) {
    const { data } = await query(req).graph({
      entity: "promotion",
      fields: ["id", "campaign_id", "group_buy_campaign.id"],
      filters: { id: req.params.id },
    })
    const promotion = data[0]
    if (!promotion || (promotion.campaign_id ?? null) === target) {
      return next()
    }
    if (promotion.group_buy_campaign?.id) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, GROUP_BUY_TEMPLATE_CAMPAIGN_MESSAGE)
    }
  }
  if (typeof target === "string" && (await linkedGroupBuyCampaign(req, target))) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, GROUP_BUY_CAMPAIGN_PROMOTIONS_MESSAGE)
  }
  next()
}

// /admin/* ถูก Medusa บังคับ auth ของ admin user อยู่แล้ว
// route ของ Medusa ที่เพิ่มในเวอร์ชันถัดไปต้องอยู่ใต้ matcher เหล่านี้ (ADR-026 ผลที่ตามมา)
export const adminPromotionLockMiddlewares: MiddlewareRoute[] = [
  { method: ["POST", "DELETE"], matcher: "/admin/promotions/:id", middlewares: [guardGroupPromotion] },
  { method: ["POST", "DELETE"], matcher: "/admin/promotions/:id/*", middlewares: [guardGroupPromotion] },
  { method: ["POST"], matcher: "/admin/campaigns/:id/promotions", middlewares: [guardCampaignGroupPromotions] },
  { method: ["POST", "DELETE"], matcher: "/admin/campaigns/:id", middlewares: [guardGroupBuyCampaign] },
  { method: ["POST"], matcher: "/admin/promotions", middlewares: [guardPromotionCampaign] },
  { method: ["POST"], matcher: "/admin/promotions/:id", middlewares: [guardPromotionCampaign] },
]
