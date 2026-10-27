import { MathBN } from "@medusajs/framework/utils"
import {
  byCommissionPreference,
  calculateCommission,
  CommissionLineItem,
  CommissionProgram,
  isLineItemInScope,
  isProgramActiveAt,
  ProgramWindow,
} from "./commission"
import type { AffiliateTokenPayload } from "./token"

const DAY_MS = 24 * 60 * 60 * 1000
// token อายุเท่า cookie `aff` (AF-2 ตั้ง Max-Age 30 วัน) — "หมดอายุ" ใน spec 05 subscriber order.placed
export const AFFILIATE_TOKEN_MAX_AGE_DAYS = 30

export type AttributionProgram = CommissionProgram &
  ProgramWindow & { id: string; attribution_window_days: number; hold_days: number }

export type PlanAttributionInput = {
  click: AffiliateTokenPayload
  affiliate: { id: string; email: string; status: string }
  order: { email?: string | null; placed_at: Date }
  programs: AttributionProgram[]
  items: (CommissionLineItem & { created_at: Date | string })[]
}

export type PlannedEntry = { program_id: string; line_item_id: string; amount: number; hold_days: number }
export type AttributionPlan = { affiliate_id: string; program_id: string | null; entries: PlannedEntry[] }

export type AttributionRejection = "token_expired" | "affiliate_not_active"

/** เหตุที่ไม่ attribute ก่อนดูโปรแกรม (กฎ 7 + อายุ token 30 วัน) — subscriber log ระดับ info */
export const attributionRejection = (
  click: AffiliateTokenPayload,
  affiliate: PlanAttributionInput["affiliate"],
  placedAt: Date
): AttributionRejection | null => {
  const age = placedAt.getTime() - click.clicked_at.getTime()
  if (age < 0 || age > AFFILIATE_TOKEN_MAX_AGE_DAYS * DAY_MS) {
    return "token_expired"
  }
  return affiliate.status === "active" ? null : "affiliate_not_active"
}

// กฎ 26: ลำดับ line สำหรับแจก cap = created_at จากน้อยไปมาก เสมอกันใช้ id (ไม่พึ่งลำดับที่ query.graph คืน)
const time = (value: Date | string) => new Date(value).getTime()
const byLineOrder = (a: PlanAttributionInput["items"][number], b: PlanAttributionInput["items"][number]) =>
  time(a.created_at) - time(b.created_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

const normalizeEmail = (email?: string | null) => (email ?? "").trim().toLowerCase()

/**
 * spec 05 subscriber `order.placed` (กฎ 1, 7, 10-12, 16; Q2, Q3, Q7)
 * null = ไม่มี attribution; program_id null = attribute แต่ไม่มีโปรแกรม active (AC-2)
 */
export const planAttribution = (input: PlanAttributionInput): AttributionPlan | null => {
  const { click, affiliate, order } = input
  if (attributionRejection(click, affiliate, order.placed_at)) {
    return null
  }
  const age = order.placed_at.getTime() - click.clicked_at.getTime()
  const items = [...input.items].sort(byLineOrder)

  const active = input.programs.filter((p) => isProgramActiveAt(p, order.placed_at))
  const eligible = active.filter((p) => age <= p.attribution_window_days * DAY_MS).sort(byCommissionPreference)
  if (active.length && !eligible.length) {
    // AC-3: click เก่ากว่า attribution window ของทุกโปรแกรมที่ active
    return null
  }
  if (!eligible.length) {
    return { affiliate_id: affiliate.id, program_id: null, entries: [] }
  }

  // ต่อ line เลือกโปรแกรมแรกตาม byCommissionPreference ที่คลุม line นั้น แล้วคำนวณ (รวม cap) ต่อโปรแกรมตามลำดับ line
  const linesByProgram = new Map<string, CommissionLineItem[]>()
  for (const item of items) {
    const program = eligible.find((p) => isLineItemInScope(p.scope, item))
    if (program) {
      linesByProgram.set(program.id, [...(linesByProgram.get(program.id) ?? []), item])
    }
  }

  const amounts = new Map<string, PlannedEntry>()
  const totals = new Map<string, ReturnType<typeof MathBN.convert>>()
  for (const program of eligible) {
    for (const line of calculateCommission(program, linesByProgram.get(program.id) ?? [])) {
      amounts.set(line.line_item_id, { program_id: program.id, ...line, hold_days: program.hold_days })
      totals.set(program.id, MathBN.add(totals.get(program.id) ?? 0, line.amount))
    }
  }

  // attribution เก็บโปรแกรมที่ให้ค่าคอมรวมมากที่สุด (Q7) เสมอกัน/ไม่มีค่าคอม → ตามลำดับ byCommissionPreference
  const top = eligible.reduce((best, p) =>
    MathBN.gt(totals.get(p.id) ?? 0, totals.get(best.id) ?? 0) ? p : best
  )
  const selfPurchase = normalizeEmail(order.email) === normalizeEmail(affiliate.email)
  const entries = selfPurchase
    ? []
    : items.flatMap((item) => (amounts.has(item.id) ? [amounts.get(item.id)!] : []))

  return { affiliate_id: affiliate.id, program_id: top.id, entries }
}
