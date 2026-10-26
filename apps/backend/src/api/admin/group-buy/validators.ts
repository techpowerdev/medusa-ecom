import { z } from "@medusajs/framework/zod"
import { createFindParams, createSelectParams } from "@medusajs/medusa/api/utils/validators"
import {
  AdminCreateApplicationMethod,
  AdminCreatePromotionRule,
} from "@medusajs/medusa/api/admin/promotions/validators"

const positiveInt = z.number().int().positive()

const configFields = {
  name: z.string().trim().min(1),
  target_type: z.enum(["orders", "units", "people"]),
  target_value: positiveInt,
  max_total_orders: positiveInt.nullish(),
  max_units_per_person: positiveInt.nullish(),
  max_people_per_group: positiveInt.nullish(),
  group_mode: z.enum(["pool", "team", "both"]),
  team_duration_hours: positiveInt.nullish(),
  pay_within_hours: positiveInt.optional(),
}

// ส่วนลด/scope ใช้ validator ของ Medusa promotion (ADR-011) — จำกัดเป็นส่วนลดระดับสินค้า (target_type items)
export const AdminCreateGroupBuyCampaign = z
  .object({
    ...configFields,
    starts_at: z.coerce.date().nullish(),
    ends_at: z.coerce.date(),
    application_method: AdminCreateApplicationMethod.refine((m) => m.target_type === "items", {
      message: "application_method.target_type must be items",
      path: ["target_type"],
    }),
    rules: z.array(AdminCreatePromotionRule).optional(),
    // spec 04 กฎข้อ 12 (ADR-011 หมายเหตุ): ราคา THB รวม VAT — ต้นแบบลดยอดที่ลูกค้าจ่ายตามตัวเลขที่ admin กรอก
    is_tax_inclusive: z.boolean().default(true),
  })
  .strict()
  .refine((c) => !c.starts_at || c.starts_at < c.ends_at, {
    message: "ends_at must be after starts_at",
    path: ["ends_at"],
  })
export type AdminCreateGroupBuyCampaign = z.infer<typeof AdminCreateGroupBuyCampaign>

// สถานะเปลี่ยนผ่าน .../status เท่านั้น; ส่วนลด/scope/ช่วงเวลาแก้ที่ Medusa promotion/campaign
export const AdminUpdateGroupBuyCampaign = z.object(configFields).partial().strict()
export type AdminUpdateGroupBuyCampaign = z.infer<typeof AdminUpdateGroupBuyCampaign>

export const AdminSetGroupBuyCampaignStatus = z
  .object({ status: z.enum(["active", "ended"]) })
  .strict()
export type AdminSetGroupBuyCampaignStatus = z.infer<typeof AdminSetGroupBuyCampaignStatus>

export const AdminListGroupBuyCampaigns = createFindParams({
  limit: 50,
  order: "-created_at",
}).extend({
  status: z.enum(["draft", "active", "ended"]).optional(),
})

export const AdminGetGroupBuyCampaignParams = createSelectParams()

// ไม่รับ kind จาก body — admin route สร้าง pool เสมอ (spec 04: "pool สร้างได้จาก admin เท่านั้น" บังคับที่ route)
export const AdminCreateGroupBuyGroup = z
  .object({ name: z.string().trim().min(1).nullish() })
  .strict()
export type AdminCreateGroupBuyGroup = z.infer<typeof AdminCreateGroupBuyGroup>

export const AdminListGroupBuyGroups = createFindParams({
  limit: 50,
  order: "-created_at",
}).extend({
  status: z.enum(["open", "succeeded", "failed"]).optional(),
  kind: z.enum(["pool", "team"]).optional(),
})

export const AdminGetGroupBuyGroupParams = createSelectParams()

// GB-6c (spec 04 API): อ่านอย่างเดียว ไม่รับ fields/order — limit 1..100 ค่าเริ่มต้น 50, offset ≥ 0
export const AdminListGroupBuyMemberships = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
