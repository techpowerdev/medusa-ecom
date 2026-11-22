import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { findOrderIdByCart } from "@lib/data/orders"
import { CART_ID_RE } from "@lib/util/login-return"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "ชำระเงิน",
}

export default async function Checkout(props: {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ step?: string | string[]; cart_id?: string | string[] }>
}) {
  const [{ countryCode }, { step, cart_id }] = await Promise.all([props.params, props.searchParams])
  // CORE-52 (กฎข้อ 110a): fresh — cart ที่ล้างจากแท็บ/อุปกรณ์อื่นไม่ revalidate data cache ของ browser นี้
  const cart = await retrieveCart(undefined, undefined, { fresh: true })

  // PAY-12 (spec 06 กฎข้อ 14; qa #481 D-2): กลับจาก /api/payment-return (มี cart_id) แต่ cart ถูก complete แล้ว — cookie ถูกล้าง
  // ตอนไม่มี jwt และ restoreActiveCart ข้าม cart ที่ complete, หรือ cookie ยังชี้ cart ที่ complete → หน้า confirmed ของ order นั้น
  // หา order ไม่พบ → รายการคำสั่งซื้อ (ลูกค้าจ่ายแล้ว — ไม่แสดง 404)
  if (typeof cart_id === "string" && CART_ID_RE.test(cart_id) && (!cart || cart.completed_at)) {
    const orderId = await findOrderIdByCart(cart_id)
    redirect(orderId ? `/${countryCode}/order/${orderId}/confirmed` : `/${countryCode}/account/orders`)
  }

  if (!cart) {
    return notFound()
  }

  // CORE-52 (กฎข้อ 110a): ตะกร้าถูกล้าง (เช่นจากอีกแท็บ) → กลับหน้าตะกร้า ไม่แสดงฟอร์ม checkout ของ cart ว่าง
  if (!cart.items?.length) {
    redirect(`/${countryCode}/cart`)
  }

  const customer = await retrieveCustomer()

  return (
    <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 py-12">
      <PaymentWrapper paymentSessions={cart.payment_collection?.payment_sessions}>
        <CheckoutForm
          cart={cart}
          customer={customer}
          countryCode={countryCode}
          step={typeof step === "string" ? step : undefined}
        />
      </PaymentWrapper>
      <CheckoutSummary cart={cart} />
    </div>
  )
}
