import { retrieveCart } from "@lib/data/cart"
import { getCartId } from "@lib/data/cookies"
import { headers } from "next/headers"
import CartDropdown from "../cart-dropdown"

export default async function CartButton() {
  // CORE-91 (กฎข้อ 147b): หน้า `force-static` ได้ headers/cookies ว่าง (ไม่มี request จริง — ไม่มีแม้ host)
  // → `undefined` ให้ CartDropdown อ่าน cart ใน browser; หน้า dynamic ส่งสิ่งที่รู้แน่ไป ไม่ให้อ่านซ้ำตอน mount
  if (!(await headers()).has("host")) {
    return <CartDropdown />
  }

  const cartId = await getCartId()
  if (!cartId) {
    return <CartDropdown cart={null} />
  }

  // มี cookie แต่อ่านไม่ได้ (ล้ม/ไม่พบ) → ยังไม่รู้ ให้ browser อ่านเอง (ไม่บอกว่าตะกร้าว่าง — กฎข้อ 147a)
  const cart = await retrieveCart(cartId).catch(() => null)
  return <CartDropdown cart={cart ?? undefined} />
}
