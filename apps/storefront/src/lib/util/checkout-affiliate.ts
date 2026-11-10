import { syncCartAffiliate } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"

/**
 * AF-3b (spec 05 กฎ 23): sync cookie `aff` ลง cart ก่อนเรียก Stripe ขั้นที่ทำให้ webhook complete cart ได้
 * (Stripe card: confirmPayment; PromptPay: ก่อน retrievePaymentIntent เพื่อครอบทั้ง QR เดิมที่รอสแกนและการ confirm ใหม่)
 */
export async function syncAffiliateBefore<T>(
  cart: Pick<HttpTypes.StoreCart, "id" | "metadata">,
  step: () => Promise<T>
): Promise<T> {
  await syncCartAffiliate(cart.id, cart.metadata ?? null)
  return step()
}
