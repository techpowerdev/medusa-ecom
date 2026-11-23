import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getCartFlashChecks } from "@lib/data/flash-sales"
import { cartErrorNotice } from "@lib/util/cart-error"
import CartTemplate from "@modules/cart/templates"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "ตะกร้าสินค้า",
  description: "ดูสินค้าในตะกร้าของคุณ",
}

export default async function Cart(props: { searchParams: Promise<{ error?: string | string[] }> }) {
  // PAY-12 (spec 06 กฎข้อ 14): ?error= จาก /api/payment-return → ข้อความไทยตาม allow-list (ค่าอื่นไม่แสดง)
  const errorNotice = cartErrorNotice((await props.searchParams).error)
  // CORE-52 (กฎข้อ 110a): fresh — ปลายทางของ checkout ที่พบตะกร้าว่าง ต้องไม่แสดง item เดิมจาก data cache
  const cart = await retrieveCart(undefined, undefined, { fresh: true }).catch((error) => {
    console.error(error)
    return notFound()
  })

  const [customer, flash] = await Promise.all([
    retrieveCustomer(),
    cart ? getCartFlashChecks(cart) : null,
  ])

  return (
    <CartTemplate
      cart={cart}
      customer={customer}
      flashExceeded={flash?.remaining}
      flashCustomerLimit={flash?.customerLimit}
      errorNotice={errorNotice}
    />
  )
}
