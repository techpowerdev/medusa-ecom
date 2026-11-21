import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import type { Context } from "@medusajs/framework/types"
import type { SqlEntityManager } from "@medusajs/framework/mikro-orm/knex"
import Affiliate from "./models/affiliate"
import AffiliateAttribution from "./models/affiliate-attribution"
import AffiliateProgram from "./models/affiliate-program"
import CommissionEntry from "./models/commission-entry"
import Payout from "./models/payout"
import { AffiliateTokenPayload, signAffiliateToken, verifyAffiliateToken } from "./utils/token"

export type AffiliateModuleOptions = {
  /** secret ของ token ใน cookie `aff` จาก env `AFFILIATE_TOKEN_SECRET` (spec 05 "Cart hook") */
  tokenSecret?: string
}

export type CommissionSummaryFilters = {
  affiliate_id?: string
  from?: Date
  to?: Date
  /**
   * กฎ 48b (AF-24, portal): reversal ของ line `(order_id, line_item_id)` ที่ยังมี entry `pending` ถูกหักใน `pending`
   * (ไม่ต่ำกว่า 0 ต่อ line ส่วนเกินคงอยู่ใน `reversed`) — ผลรวมทุกแถวเท่าเดิม; ไม่ตั้ง = GROUP BY status ตรงๆ (admin)
   */
  net_pending_reversals?: boolean
}

export type PayableEntryFilters = {
  affiliate_id: string
  period_to: Date
}

export type PayableEntry = {
  id: string
  amount: string
  currency: string
  status: "approved" | "reversed"
}

export type CommissionSummaryRow = {
  affiliate_id: string
  currency: string
  status: string
  amount: number
  count: number
}

class AffiliateModuleService extends MedusaService({
  Affiliate,
  AffiliateProgram,
  AffiliateAttribution,
  AffiliateCommissionEntry: CommissionEntry,
  AffiliatePayout: Payout,
}) {
  protected readonly options_: AffiliateModuleOptions

  constructor(container: Record<string, unknown>, options: AffiliateModuleOptions = {}) {
    super(...arguments)
    this.options_ = options
  }

  /** false = ไม่ได้ตั้ง AFFILIATE_TOKEN_SECRET → ลิงก์ affiliate redirect ได้แต่ไม่ตั้ง cookie (AF-2) */
  async hasClickTokenSecret(): Promise<boolean> {
    return !!this.options_.tokenSecret
  }

  async signClickToken(affiliateId: string, clickedAt: Date): Promise<string> {
    return signAffiliateToken(affiliateId, clickedAt, this.options_.tokenSecret ?? "")
  }

  // Rule 19: approved/reversed entries created before period_to that are not in any live payout
  // (a cancelled payout is soft-deleted, so its entries count as free again). Not cut by period_from.
  // owner 2026-10-26 (AF-4): a reversed entry is payable only once the source entry of the same order/line is
  // approved or paid — a reversal of a still-pending entry offsets it and never reaches a payout.
  @InjectManager()
  async listPayableCommissionEntries(
    filters: PayableEntryFilters,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<PayableEntry[]> {
    return await sharedContext.manager!.execute<PayableEntry[]>(
      `SELECT e.id, e.raw_amount->>'value' AS amount, e.currency, e.status
       FROM affiliate_commission_entry e
       WHERE e.deleted_at IS NULL
         AND e.affiliate_id = ?
         AND e.status IN ('approved', 'reversed')
         AND e.created_at < ?
         AND (e.status = 'approved' OR EXISTS (
           SELECT 1 FROM affiliate_commission_entry src
           WHERE src.deleted_at IS NULL AND src.status IN ('approved', 'paid')
             AND src.order_id = e.order_id AND src.line_item_id IS NOT DISTINCT FROM e.line_item_id
         ))
         AND NOT EXISTS (
           SELECT 1 FROM affiliate_payout p
           WHERE p.deleted_at IS NULL AND p.affiliate_id = e.affiliate_id AND e.id = ANY (p.entry_ids)
         )
       ORDER BY e.created_at, e.id`,
      [filters.affiliate_id, filters.period_to]
    )
  }

  /** null = ลายเซ็นไม่ถูกต้อง/รูปแบบผิด/ไม่ได้ตั้ง secret (AF-3, AC-11) */
  async verifyClickToken(token: unknown): Promise<AffiliateTokenPayload | null> {
    return verifyAffiliateToken(token, this.options_.tokenSecret ?? "")
  }

  // Ledger totals per affiliate/currency/status aggregated in SQL (spec 05 non-functional); window is [from, to)
  @InjectManager()
  async summarizeCommissionEntries(
    filters: CommissionSummaryFilters = {},
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<CommissionSummaryRow[]> {
    // ช่วงเวลา [from, to) กรองก่อนรวม ทั้ง entry และ reversal (หักกันเฉพาะที่อยู่ในช่วงเดียวกัน)
    const entries = `SELECT affiliate_id, currency, status, order_id, line_item_id, amount
       FROM affiliate_commission_entry
       WHERE deleted_at IS NULL
         AND (?::text IS NULL OR affiliate_id = ?)
         AND (?::timestamptz IS NULL OR created_at >= ?)
         AND (?::timestamptz IS NULL OR created_at < ?)`
    // ต่อ line: absorbed = ส่วนของ reversal (ติดลบ) ที่หักใน pending ได้ไม่เกินยอด pending ของ line
    const netted = `WITH f AS (${entries}),
       lines AS (
         SELECT affiliate_id, currency,
           COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS p,
           COUNT(*) FILTER (WHERE status = 'pending') AS pc,
           COALESCE(SUM(amount) FILTER (WHERE status = 'reversed'), 0) AS r,
           COUNT(*) FILTER (WHERE status = 'reversed') AS rc
         FROM f WHERE status IN ('pending', 'reversed')
         GROUP BY affiliate_id, currency, order_id, line_item_id
       ),
       l AS (SELECT *, CASE WHEN pc > 0 THEN GREATEST(r, -GREATEST(p, 0)) ELSE 0 END AS absorbed FROM lines),
       t AS (
         SELECT affiliate_id, currency, status, amount, 1 AS n FROM f WHERE status NOT IN ('pending', 'reversed')
         UNION ALL SELECT affiliate_id, currency, 'pending', p + absorbed, pc FROM l WHERE pc > 0
         UNION ALL SELECT affiliate_id, currency, 'reversed', r - absorbed, rc FROM l WHERE rc > 0 AND r - absorbed <> 0
       )
       SELECT affiliate_id, currency, status, SUM(amount)::text AS amount, SUM(n)::int AS count
       FROM t GROUP BY affiliate_id, currency, status
       ORDER BY affiliate_id, currency, status`
    const grouped = `SELECT affiliate_id, currency, status, SUM(amount)::text AS amount, COUNT(*)::int AS count
       FROM (${entries}) f
       GROUP BY affiliate_id, currency, status
       ORDER BY affiliate_id, currency, status`
    const rows = await sharedContext.manager!.execute<Record<string, string>[]>(
      filters.net_pending_reversals ? netted : grouped,
      [
        filters.affiliate_id ?? null,
        filters.affiliate_id ?? null,
        filters.from ?? null,
        filters.from ?? null,
        filters.to ?? null,
        filters.to ?? null,
      ]
    )

    return rows.map((r) => ({
      affiliate_id: r.affiliate_id,
      currency: r.currency,
      status: r.status,
      amount: Number(r.amount),
      count: Number(r.count),
    }))
  }
}

export default AffiliateModuleService
