import { BigNumberInput } from "@medusajs/framework/types"
import { MathBN } from "@medusajs/framework/utils"

export type ProgramScope = {
  all?: boolean
  variant_ids?: string[]
  collection_ids?: string[]
  category_ids?: string[]
}

export type CommissionProgram = {
  commission_type: "percentage"
  commission_value: BigNumberInput
  scope: ProgramScope
  cap_per_order?: BigNumberInput | null
}

// Order line item totals as Medusa computes them: `subtotal` excludes tax,
// `discount_subtotal` is the discount excluding tax. Shipping is never a line item.
export type CommissionLineItem = {
  id: string
  variant_id?: string | null
  product_collection_id?: string | null
  product_category_ids?: string[]
  subtotal: BigNumberInput
  discount_subtotal?: BigNumberInput | null
}

export type LineCommission = { line_item_id: string; amount: number }

// THB (and most currencies) have 2 decimals; amounts are major units (spec 05)
const DECIMALS = 2

export const isLineItemInScope = (scope: ProgramScope, item: CommissionLineItem): boolean => {
  if (scope.all) {
    return true
  }
  if (item.variant_id && scope.variant_ids?.includes(item.variant_id)) {
    return true
  }
  if (item.product_collection_id && scope.collection_ids?.includes(item.product_collection_id)) {
    return true
  }
  return (item.product_category_ids ?? []).some((id) => scope.category_ids?.includes(id))
}

/**
 * Commission per eligible line item (spec 05 rules 3-4): percentage of the paid
 * amount after discount excluding tax/shipping, capped per order by allocating
 * the remaining cap to lines in order.
 */
export const calculateCommission = (
  program: CommissionProgram,
  items: CommissionLineItem[]
): LineCommission[] => {
  const hasCap = program.cap_per_order !== null && program.cap_per_order !== undefined
  let remainingCap = hasCap ? MathBN.convert(program.cap_per_order!) : null
  const result: LineCommission[] = []

  for (const item of items) {
    if (!isLineItemInScope(program.scope, item)) {
      continue
    }

    const base = MathBN.sub(item.subtotal, item.discount_subtotal ?? 0)
    let amount = MathBN.convert(
      MathBN.div(MathBN.mult(base, program.commission_value), 100),
      DECIMALS
    )
    if (remainingCap) {
      amount = MathBN.min(amount, remainingCap)
      remainingCap = MathBN.sub(remainingCap, amount)
    }

    if (MathBN.gt(amount, 0)) {
      result.push({ line_item_id: item.id, amount: amount.toNumber() })
    }
  }

  return result
}

export type ProgramWindow = {
  status: "draft" | "published" | "ended"
  starts_at: Date
  ends_at: Date
}

// Window is [starts_at, ends_at); only published programs can be active (rule 9)
export const isProgramActiveAt = (program: ProgramWindow, at: Date): boolean =>
  program.status === "published" &&
  program.starts_at.getTime() <= at.getTime() &&
  at.getTime() < program.ends_at.getTime()
