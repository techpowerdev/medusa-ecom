import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EVOUCHER_MODULE } from "../../../../../modules/evoucher"
import type EvoucherModuleService from "../../../../../modules/evoucher/service"

type Row = {
  id: string
  code: string
  pin: string | null
  expires_at: Date | null
  delivered_at: Date | null
  order_id: string | null
  pool: {
    name: string
    face_value: unknown
    validity_note: string | null
    how_to_use: string
    partner: { name: string; logo_url: string | null; terms_url: string | null; support_contact: string | null }
  }
}

const FIELDS = [
  "id",
  "code",
  "pin",
  "expires_at",
  "delivered_at",
  "order_id",
  "pool.name",
  "pool.face_value",
  "pool.validity_note",
  "pool.how_to_use",
  "pool.partner.name",
  "pool.partner.logo_url",
  "pool.partner.terms_url",
  "pool.partner.support_contact",
]

// EV-7a (spec 02 API, กฎข้อ 22): code ที่ผูกกับลูกค้าผู้เรียกเท่านั้น (delivered/allocated) — filter ใน query ไม่กรองในแอป;
// ถอดรหัสตอนสร้าง response เท่านั้น ห้าม log ค่า plaintext; ไม่มี route รายตัว
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const evoucher: EvoucherModuleService = req.scope.resolve(EVOUCHER_MODULE)

  const { data, metadata } = await query.graph({
    entity: "evoucher_code",
    fields: FIELDS,
    filters: {
      customer_id: req.auth_context.actor_id,
      status: ["delivered", "allocated"],
    },
    pagination: {
      ...req.queryConfig.pagination,
      order: { delivered_at: "DESC", id: "DESC" },
    },
  })

  const evouchers = await Promise.all(
    (data as Row[]).map(async ({ pool, ...c }) => ({
      id: c.id,
      code: await evoucher.decryptSecret(c.code),
      pin: c.pin ? await evoucher.decryptSecret(c.pin) : null,
      expires_at: c.expires_at,
      delivered_at: c.delivered_at,
      order_id: c.order_id,
      pool: {
        name: pool.name,
        face_value: pool.face_value,
        validity_note: pool.validity_note,
        how_to_use: pool.how_to_use,
      },
      partner: {
        name: pool.partner.name,
        logo_url: pool.partner.logo_url,
        terms_url: pool.partner.terms_url,
        support_contact: pool.partner.support_contact,
      },
    }))
  )

  res.set("Cache-Control", "private, no-store")
  res.json({ evouchers, count: metadata?.count ?? evouchers.length })
}
