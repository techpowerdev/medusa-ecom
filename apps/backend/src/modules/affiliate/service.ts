import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import type { Context } from "@medusajs/framework/types"
import type { SqlEntityManager } from "@medusajs/framework/mikro-orm/knex"
import Affiliate from "./models/affiliate"
import AffiliateAttribution from "./models/affiliate-attribution"
import AffiliateProgram from "./models/affiliate-program"
import CommissionEntry from "./models/commission-entry"
import Payout from "./models/payout"

export type CommissionSummaryFilters = {
  affiliate_id?: string
  from?: Date
  to?: Date
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
  // Ledger totals per affiliate/currency/status aggregated in SQL (spec 05 non-functional); window is [from, to)
  @InjectManager()
  async summarizeCommissionEntries(
    filters: CommissionSummaryFilters = {},
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<CommissionSummaryRow[]> {
    const rows = await sharedContext.manager!.execute<Record<string, string>[]>(
      `SELECT affiliate_id, currency, status, SUM(amount)::text AS amount, COUNT(*)::int AS count
       FROM affiliate_commission_entry
       WHERE deleted_at IS NULL
         AND (?::text IS NULL OR affiliate_id = ?)
         AND (?::timestamptz IS NULL OR created_at >= ?)
         AND (?::timestamptz IS NULL OR created_at < ?)
       GROUP BY affiliate_id, currency, status
       ORDER BY affiliate_id, currency, status`,
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
