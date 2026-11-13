"use client"

import { loadStripe } from "@stripe/stripe-js"
import React from "react"
import StripeWrapper from "./stripe-wrapper"
import { HttpTypes } from "@medusajs/types"
import { isStripeLike } from "@lib/constants"
import { isPromptPay, promptPaySession } from "@lib/util/payment-session"

type PaymentWrapperProps = {
  // PAY-3b: รับ session ตรง (ไม่ผูกกับ cart) — ใช้ร่วมกับหน้าชำระเงินของ order (payment collection ของ draft order)
  paymentSessions?: HttpTypes.StorePaymentSession[] | null
  children: React.ReactNode
}

const stripeKey =
  process.env.NEXT_PUBLIC_STRIPE_KEY ||
  process.env.NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY

const medusaAccountId = process.env.NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID
const stripePromise = stripeKey
  ? loadStripe(
      stripeKey,
      medusaAccountId ? { stripeAccount: medusaAccountId } : undefined
    )
  : null

const PaymentWrapper: React.FC<PaymentWrapperProps> = ({ paymentSessions, children }) => {
  // CORE-52 (review #353): พร้อมเพย์ที่ guard/webhook authorize แล้ว (PAY-6b) ยังอยู่ใน Elements เดิม — หน้า checkout อ่าน cart
  // แบบ fresh (กฎข้อ 110a) ถ้าสลับเป็น `<div>` React จะ mount children ใหม่ state คืนเงิน/รอ order ของ promptpay-payment หาย
  const paymentSession =
    paymentSessions?.find((s) => s.status === "pending") ?? promptPaySession(paymentSessions)

  // PAY-2: PromptPay ก็ใช้ Stripe.js (confirmPromptPayPayment) ผ่าน Elements เดียวกัน
  if (
    (isStripeLike(paymentSession?.provider_id) ||
      isPromptPay(paymentSession?.provider_id)) &&
    paymentSession &&
    stripePromise
  ) {
    return (
      <StripeWrapper
        paymentSession={paymentSession}
        stripeKey={stripeKey}
        stripePromise={stripePromise}
      >
        {children}
      </StripeWrapper>
    )
  }

  return <div>{children}</div>
}

export default PaymentWrapper
