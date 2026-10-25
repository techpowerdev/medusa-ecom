import { MedusaError } from "@medusajs/framework/utils"

// CORE-6 (spec 01 "ไม่มี guest"): cart ต้องผูกกับ customer ที่มีบัญชี
// customer ที่ Medusa สร้างจาก email อย่างเดียว (findOrCreateCustomerStep) มี has_account=false = guest
export const CUSTOMER_REQUIRED_MESSAGE = "A signed-in customer is required to create a cart"

export type CartCustomerLike = { id?: string | null; has_account?: boolean | null } | null | undefined

export function assertCartCustomer(customer: CartCustomerLike): void {
  if (!customer?.id || customer.has_account !== true) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, CUSTOMER_REQUIRED_MESSAGE)
  }
}
