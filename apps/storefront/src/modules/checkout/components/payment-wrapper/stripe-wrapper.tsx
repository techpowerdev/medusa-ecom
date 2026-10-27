"use client"

import { Stripe, StripeElementsOptions } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import { HttpTypes } from "@medusajs/types"
import { createContext } from "react"

type StripeWrapperProps = {
  paymentSession: HttpTypes.StorePaymentSession
  stripeKey?: string
  stripePromise: Promise<Stripe | null> | null
  children: React.ReactNode
}

export const StripeContext = createContext(false)

const StripeWrapper: React.FC<StripeWrapperProps> = ({
  paymentSession,
  stripeKey,
  stripePromise,
  children,
}) => {
  const options: StripeElementsOptions = {
    clientSecret: paymentSession!.data?.client_secret as string | undefined,
  }

  // CORE-4d: ข้อความถึงผู้ใช้เป็นไทย (ADR-014) — สาเหตุ: ไม่ได้ตั้ง NEXT_PUBLIC_STRIPE_KEY
  if (!stripeKey) {
    throw new Error("ระบบชำระเงินยังไม่พร้อม (ไม่พบคีย์ของระบบชำระเงิน)")
  }

  if (!stripePromise) {
    throw new Error("ระบบชำระเงินยังไม่พร้อม (โหลดระบบชำระเงินไม่สำเร็จ)")
  }

  if (!paymentSession?.data?.client_secret) {
    throw new Error("ระบบชำระเงินยังไม่พร้อม (ไม่พบข้อมูลการชำระเงิน)")
  }

  return (
    <StripeContext.Provider value={true}>
      <Elements options={options} stripe={stripePromise}>
        {children}
      </Elements>
    </StripeContext.Provider>
  )
}

export default StripeWrapper
