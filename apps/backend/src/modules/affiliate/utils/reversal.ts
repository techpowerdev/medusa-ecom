import type { BigNumberInput } from "@medusajs/framework/types"
import { MathBN } from "@medusajs/framework/utils"
import { isOrderFullyRefunded, OrderPaymentsLike } from "../../../lib/flash-sale-release"

export type LedgerEntry = {
  id: string
  affiliate_id: string
  program_id: string
  order_id: string
  line_item_id: string | null
  amount: BigNumberInput
  currency: string
  status: "pending" | "approved" | "reversed" | "paid"
}

export type PlannedReversal = Pick<LedgerEntry, "affiliate_id" | "program_id" | "order_id" | "currency"> & {
  line_item_id: string
  amount: number
}

export type OrderForReversal = OrderPaymentsLike & {
  status?: string | null
  items?: ({ id: string; quantity: BigNumberInput; detail?: { return_received_quantity?: BigNumberInput | null } | null } | null)[] | null
}

/**
 * ส่วนของแต่ละ line ที่ได้รับผลกระทบ (0..1) จากสถานะปัจจุบันของ order (spec 05 subscriber refund/cancel/return):
 * cancel หรือ refund เต็มจำนวน (เกณฑ์เดียวกับ FS-2: refund รวม >= capture รวม) → ทุก line = 1;
 * มิฉะนั้น = จำนวนที่รับคืนแล้ว / จำนวนของ line (Q3 — ยอดที่คืน / base ของ line เมื่อส่วนลดกระจายตามจำนวน)
 */
export const affectedFractions = (order: OrderForReversal): Record<string, number> => {
  const all = order.status === "canceled" || isOrderFullyRefunded(order)
  const fractions: Record<string, number> = {}
  for (const item of order.items ?? []) {
    if (!item) {
      continue
    }
    fractions[item.id] = all
      ? 1
      : MathBN.div(item.detail?.return_received_quantity ?? 0, item.quantity).toNumber()
  }
  return fractions
}

const byLine = (entries: LedgerEntry[]) => {
  const lines = new Map<string, { earned: LedgerEntry[]; reversed: LedgerEntry[] }>()
  for (const e of entries) {
    if (!e.line_item_id) {
      continue
    }
    const line = lines.get(e.line_item_id) ?? { earned: [], reversed: [] }
    ;(e.status === "reversed" ? line.reversed : line.earned).push(e)
    lines.set(e.line_item_id, line)
  }
  return lines
}

const sum = (entries: LedgerEntry[]) => MathBN.sum(0, ...entries.map((e) => e.amount))

/**
 * กฎ 5 + Q3: reversal = −(ยอดที่ได้ของ line × ส่วนที่ได้รับผลกระทบ) ปัด 2 ตำแหน่ง half-up ไม่เกินยอดที่ได้
 * นับ reversal ที่มีอยู่แล้ว → สร้างเฉพาะส่วนต่าง (event ซ้ำ/หลายครั้งไม่ reverse ซ้ำ)
 */
export const planReversals = (entries: LedgerEntry[], fractions: Record<string, number>): PlannedReversal[] => {
  const planned: PlannedReversal[] = []
  for (const [lineId, { earned, reversed }] of byLine(entries)) {
    const fraction = Math.min(1, fractions[lineId] ?? 0)
    if (!earned.length || fraction <= 0) {
      continue
    }
    const target = MathBN.mult(MathBN.convert(MathBN.mult(sum(earned), fraction), 2), -1)
    const delta = MathBN.sub(target, sum(reversed))
    if (MathBN.lt(delta, 0)) {
      const { affiliate_id, program_id, order_id, currency } = earned[0]
      planned.push({ affiliate_id, program_id, order_id, line_item_id: lineId, amount: delta.toNumber(), currency })
    }
  }
  return planned
}

/** Q8: entry `pending` ที่ครบกำหนดจะ approve เมื่อยอดสุทธิของ line (รวม reversal) > 0 */
export const selectMaturedEntryIds = (pending: LedgerEntry[], reversals: LedgerEntry[]): string[] => {
  const key = (e: LedgerEntry) => `${e.order_id}|${e.line_item_id}`
  const reversedByLine = new Map<string, LedgerEntry[]>()
  for (const r of reversals) {
    reversedByLine.set(key(r), [...(reversedByLine.get(key(r)) ?? []), r])
  }
  return pending
    .filter((e) => MathBN.gt(MathBN.add(e.amount, sum(reversedByLine.get(key(e)) ?? [])), 0))
    .map((e) => e.id)
}
