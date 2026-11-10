import { BigNumberInput } from "@medusajs/framework/types"
import { MathBN, MedusaError } from "@medusajs/framework/utils"

export type PayoutCandidateEntry = {
  id: string
  amount: BigNumberInput
  currency: string
  status: "pending" | "approved" | "reversed" | "paid"
}

export type PayoutDraft = { amount: number; currency: string; entry_ids: string[] }

const PAYABLE = ["approved", "reversed"]

/**
 * Q8: payout = Σ approved + Σ reversed of entries not yet in any payout (caller filters those out).
 * Net ≤ 0 → null: no payout, the entries carry over to the next round.
 */
export const buildPayout = (entries: PayoutCandidateEntry[]): PayoutDraft | null => {
  const payable = entries.filter((e) => PAYABLE.includes(e.status))
  const currencies = new Set(payable.map((e) => e.currency))
  if (currencies.size > 1) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Entries span more than one currency: ${[...currencies].join(", ")}`
    )
  }

  const amount = payable.reduce((sum, e) => MathBN.add(sum, e.amount), MathBN.convert(0))
  if (!payable.length || MathBN.lte(amount, 0)) {
    return null
  }

  return {
    amount: amount.toNumber(),
    currency: payable[0].currency,
    entry_ids: payable.map((e) => e.id),
  }
}
