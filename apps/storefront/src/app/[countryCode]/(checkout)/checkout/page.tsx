import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "ชำระเงิน",
}

export default async function Checkout(props: {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ step?: string | string[] }>
}) {
  const [{ countryCode }, { step }] = await Promise.all([props.params, props.searchParams])
  const cart = await retrieveCart()

  if (!cart) {
    return notFound()
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
