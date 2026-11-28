import type { CreateAccountHolderInput, CreateAccountHolderOutput } from "@medusajs/framework/types"

// PAY-26 (spec 01 กฎข้อ 157, ADR-035): provider id = pp_<identifier>_<id ใน medusa-config> — ลงทะเบียนด้วย id `stripe`
export const STRIPE_PROVIDER_ID_BY_IDENTIFIER: Record<string, string> = {
  stripe: "pp_stripe_stripe",
  "stripe-promptpay": "pp_stripe-promptpay_stripe",
}

type AccountHolderLike = { provider_id?: string; data?: Record<string, unknown> | null } | null | undefined

/** holder ของ Stripe provider **อีกตัว** ที่มี Stripe customer แล้ว (`data.id`) — ไม่มี → undefined */
export function findSharedAccountHolder(holders: AccountHolderLike[] | undefined, identifier: string) {
  const own = STRIPE_PROVIDER_ID_BY_IDENTIFIER[identifier]
  const others = Object.values(STRIPE_PROVIDER_ID_BY_IDENTIFIER).filter((id) => id !== own)
  return (holders ?? []).find(
    (h) => !!h && others.includes(h.provider_id ?? "") && typeof h.data?.id === "string" && h.data.id !== ""
  )
}

/**
 * แทน `createAccountHolder` ของ Stripe provider ของ Medusa 2.22.1 ซึ่งได้ `idempotency_key = customer.id` เดียวกันทุก provider
 * (payment-module.js `createAccountHolder`) → Stripe ปฏิเสธเมื่อข้อมูลลูกค้าเปลี่ยนภายใน 24 ชม. (medusajs/medusa#12526)
 */
export async function createSharedAccountHolder(
  input: CreateAccountHolderInput,
  identifier: string,
  create: (input: CreateAccountHolderInput) => Promise<CreateAccountHolderOutput>
): Promise<CreateAccountHolderOutput> {
  const { context } = input
  if (context.account_holder) {
    return create(input)
  }
  const holders = (context.customer as { account_holders?: AccountHolderLike[] } | undefined)?.account_holders
  const shared = findSharedAccountHolder(holders, identifier)
  if (shared?.data) {
    return { id: shared.data.id as string, data: shared.data }
  }
  return create({ ...input, context: { ...context, idempotency_key: `${context.customer?.id}:${identifier}` } })
}
