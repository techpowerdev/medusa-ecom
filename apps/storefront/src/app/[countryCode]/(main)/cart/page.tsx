import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getCartFlashExceeded } from "@lib/data/flash-sales"
import CartTemplate from "@modules/cart/templates"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "ตะกร้าสินค้า",
  description: "ดูสินค้าในตะกร้าของคุณ",
}

export default async function Cart() {
  // CORE-52 (กฎข้อ 110a): fresh — ปลายทางของ checkout ที่พบตะกร้าว่าง ต้องไม่แสดง item เดิมจาก data cache
  const cart = await retrieveCart(undefined, undefined, { fresh: true }).catch((error) => {
    console.error(error)
    return notFound()
  })

  const [customer, flashExceeded] = await Promise.all([
    retrieveCustomer(),
    cart ? getCartFlashExceeded(cart) : {},
  ])

  return (
    <CartTemplate cart={cart} customer={customer} flashExceeded={flashExceeded} />
  )
}
