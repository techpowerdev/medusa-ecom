"use client"

import { isManual, isStripeLike } from "@lib/constants"
import { placeOrder } from "@lib/data/cart"
import { syncAffiliateBefore } from "@lib/util/checkout-affiliate"
import { unauthorizedLoginPath } from "@lib/util/login-notice"
import { REVIEW_REFUNDED_NOTICE } from "@lib/util/checkout-error"
import {
  PROMPTPAY_FALLBACK_MAX_REQUESTS,
  PROMPTPAY_POLL_MS,
  isPromptPay,
  refundedWithoutSession,
} from "@lib/util/payment-session"
import {
  CheckoutNotice,
  PROCESSING_NOTICE,
  PlaceOrderOutcome,
  checkoutNotice,
} from "@lib/util/place-order-outcome"
import { stripeErrorMessage } from "@lib/util/stripe-error"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@/components/ui/button"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import { useParams, useRouter } from "next/navigation"
import React, { useEffect, useRef, useState } from "react"
import ErrorMessage from "../error-message"
import PromptPayPaymentButton from "../promptpay-payment"
import PromptPayOrderDelayed from "../promptpay-payment/order-delayed"
import RefundedGoToCart from "../refunded-go-to-cart"

/**
 * CORE-4i-b (กฎข้อ 72) / CORE-76 (กฎข้อ 134 a2): ผลของ placeOrder — สำเร็จ = redirect ของ Next (ไม่มีผล) → null,
 * action ที่ reject เอง (request ของ action ล้ม) → `failed`
 */
export const completeOrder = async (order: ReturnType<typeof placeOrder>): Promise<PlaceOrderOutcome | null> =>
  (await order.catch((): PlaceOrderOutcome => ({ kind: "failed" }))) ?? null

type Shown = CheckoutNotice | { kind: "delayed" }

/**
 * CORE-76: ยืนยันคำสั่งซื้อแล้วแสดงผลจาก kind (ไม่เทียบข้อความ): `unauthorized` → หน้า login `/<cc>/account` (ไม่มี return_to —
 * readReturnTo ไม่รับ path ของ checkout; CORE-95 กฎข้อ 151: `paid` → พร้อม `notice=payment_received`); `processing` → อ่านซ้ำทุก PROMPTPAY_POLL_MS ด้วย placeOrder (cart ที่ complete แล้วได้ order
 * เดิม → หน้า confirmed) รวมไม่เกิน PROMPTPAY_FALLBACK_MAX_REQUESTS ครั้ง (กลไก PAY-6b/6c) แล้ว `paid` → ติดต่อร้าน, ไม่ได้ตัดเงิน → ข้อความ fallback
 * `paid` = ตัดเงินแล้วก่อน complete (บัตรหลัง PaymentIntent succeeded/requires_capture — FS-22);
 * `order(retry)` = เรียก placeOrder ของปุ่ม (retry = รอบอ่านซ้ำของ processing)
 */
export const usePlaceOrder = (paid: boolean, order: (retry: boolean) => ReturnType<typeof placeOrder>) => {
  const router = useRouter()
  const { countryCode } = useParams()
  const [shown, setShown] = useState<Shown | null>(null)
  const attempts = useRef(0)

  const place = async () => {
    attempts.current++
    const outcome = await completeOrder(order(attempts.current > 1))
    if (!outcome) return
    if (outcome.kind === "unauthorized") {
      router.push(unauthorizedLoginPath(countryCode as string, paid))
      return
    }
    const next = checkoutNotice(outcome, paid)
    if (next.kind === "processing" && attempts.current >= PROMPTPAY_FALLBACK_MAX_REQUESTS) {
      setShown(paid ? { kind: "delayed" } : checkoutNotice({ kind: "failed" }, paid))
      return
    }
    setShown(next)
  }

  useEffect(() => {
    if (shown?.kind !== "processing") return
    const timer = setTimeout(() => place(), PROMPTPAY_POLL_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])

  const start = () => {
    attempts.current = 0
    setShown(null)
    return place()
  }

  return { shown, setShown, start, busy: shown?.kind === "processing" || shown?.kind === "delayed" }
}

/** FS-22/CORE-76: notice คืนเงิน, กำลังดำเนินการ และติดต่อร้านเป็น state ของตัวเอง; ข้อความ error ใช้ ErrorMessage เดิม */
export const PlaceOrderNotice = ({ shown, errorTestId }: { shown: Shown | null; errorTestId: string }) => {
  if (shown?.kind === "refunded") {
    return (
      <p role="alert" className="pt-2 text-sm leading-[1.4rem] text-foreground" data-testid="checkout-refunded-notice">
        {shown.text}
      </p>
    )
  }
  if (shown?.kind === "processing") {
    return (
      <p aria-live="polite" className="pt-2 text-sm leading-[1.4rem] text-foreground" data-testid="checkout-processing-notice">
        {PROCESSING_NOTICE}
      </p>
    )
  }
  if (shown?.kind === "delayed") return <PromptPayOrderDelayed />
  return <ErrorMessage error={shown?.kind === "error" ? shown.text : null} data-testid={errorTestId} />
}

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  /** CORE-35 (กฎข้อ 93): จาก checkout-form — deliveryStepDone กับรายการ option ที่กรองแล้ว */
  deliveryDone: boolean
  /** FS-21 (spec 03 กฎข้อ 26b): เกินสิทธิ์ flash ต่อคน → disable เหมือนยังไม่พร้อม */
  blocked?: boolean
  "data-testid": string
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  deliveryDone,
  blocked = false,
  "data-testid": dataTestId,
}) => {
  const notReady =
    blocked ||
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    !deliveryDone

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]

  // PAY-19 (spec 06 กฎข้อ 21 — Q-P13 = ก): Medusa คืนเงินแล้วไม่มี session เหลือ (reload/Back/หลัง router.refresh ของ PAY-11/15)
  // → ข้อความคืนเงิน + ลิงก์ตะกร้าแทนปุ่ม disabled; ขั้น payment ยังเลือกวิธีชำระใหม่ได้ (PAY-9 สร้าง collection ใหม่)
  if (refundedWithoutSession(cart)) {
    return (
      <RefundedGoToCart text={REVIEW_REFUNDED_NOTICE} noticeTestId="review-refunded-notice" linkTestId="review-refunded-go-to-cart" />
    )
  }

  switch (true) {
    case isStripeLike(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isPromptPay(paymentSession?.provider_id):
      return (
        <PromptPayPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton
          cart={cart}
          notReady={notReady}
          data-testid={dataTestId}
        />
      )
    default:
      return <Button disabled>กรุณาเลือกวิธีชำระเงิน</Button>
  }
}

const StripePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  // EV-7d (กฎข้อ 28c): หน้า confirmed ใช้ country ของ URL ปัจจุบัน
  const { countryCode } = useParams()
  const placeAfterPayment = () => placeOrder(cart.id, undefined, countryCode as string)
  // placeOrder ถูกเรียกหลัง PaymentIntent succeeded/requires_capture เท่านั้น → เงินถูกตัดแล้ว (FS-22)
  const { shown, setShown, start, busy } = usePlaceOrder(true, placeAfterPayment)

  const onPaymentCompleted = async () => {
    await start()
    setSubmitting(false)
  }

  const stripe = useStripe()
  const elements = useElements()

  const disabled = !stripe || !elements ? true : false

  const handlePayment = async () => {
    if (!stripe || !elements || !cart) {
      return
    }

    setSubmitting(true)

    // AF-3b (กฎ 23): sync cookie `aff` ก่อนยืนยันการชำระ — webhook อาจ complete cart ก่อน placeOrder
    await syncAffiliateBefore(cart, () =>
      stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/api/payment-return?cart_id=${cart.id}&country_code=${countryCode}`,
          payment_method_data: {
            billing_details: {
              name:
                cart.billing_address?.first_name +
                " " +
                cart.billing_address?.last_name,
              address: {
                city: cart.billing_address?.city ?? undefined,
                country: cart.billing_address?.country_code ?? undefined,
                line1: cart.billing_address?.address_1 ?? undefined,
                line2: cart.billing_address?.address_2 ?? undefined,
                postal_code: cart.billing_address?.postal_code ?? undefined,
                state: cart.billing_address?.province ?? undefined,
              },
              email: cart.email,
              phone: cart.billing_address?.phone ?? undefined,
            },
          },
        },
        // Only leave the site when the selected method actually requires it, so
        // card payments still complete inline.
        redirect: "if_required",
      })
    ).then(({ error, paymentIntent }) => {
      if (error) {
        const pi = error.payment_intent

        if (
          (pi && pi.status === "requires_capture") ||
          (pi && pi.status === "succeeded")
        ) {
          onPaymentCompleted()
          return
        }

        // PAY-17 (spec 06 กฎข้อ 19a): ไม่แสดง error.message ของ Stripe — ข้อความไทยตาม type/code
        setShown({ kind: "error", text: stripeErrorMessage(error) })
        setSubmitting(false)
        return
      }

      if (
        paymentIntent.status === "requires_capture" ||
        paymentIntent.status === "succeeded"
      ) {
        onPaymentCompleted()
        return
      }

      setSubmitting(false)
    })
  }

  return (
    <>
      <Button
        disabled={disabled || notReady || busy}
        onClick={handlePayment}
        size="lg"
        className="h-12"
        isLoading={submitting || shown?.kind === "processing"}
        data-testid={dataTestId}
      >
        ยืนยันคำสั่งซื้อ
      </Button>
      <PlaceOrderNotice shown={shown} errorTestId="stripe-payment-error-message" />
    </>
  )
}

const ManualTestPaymentButton = ({
  cart,
  notReady,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
}) => {
  const [submitting, setSubmitting] = useState(false)
  // EV-7c (กฎข้อ 24c): หน้า confirmed ใช้ country ของ URL ปัจจุบัน
  const { countryCode } = useParams()
  // AF-3b (กฎ 23): ส่ง metadata ของ cart ที่อ่านไว้ → placeOrder sync cookie `aff` ก่อน complete;
  // รอบอ่านซ้ำของ processing ไม่ sync อีก (sync แล้วตอนกดครั้งแรก — cart อาจ complete แล้ว)
  const placeManual = (retry: boolean) => placeOrder(cart.id, retry ? undefined : (cart.metadata ?? null), countryCode as string)
  // manual payment ไม่มีการตัดเงิน → refunded แสดงข้อความของ code / สต็อกไม่พอ (CORE-76 กฎข้อ 134a)
  const { shown, start, busy } = usePlaceOrder(false, placeManual)

  const onPaymentCompleted = async () => {
    await start()
    setSubmitting(false)
  }

  const handlePayment = () => {
    setSubmitting(true)

    onPaymentCompleted()
  }

  return (
    <>
      <Button
        disabled={notReady || busy}
        isLoading={submitting || shown?.kind === "processing"}
        onClick={handlePayment}
        size="lg"
        className="h-12"
        data-testid="submit-order-button"
      >
        ยืนยันคำสั่งซื้อ
      </Button>
      <PlaceOrderNotice shown={shown} errorTestId="manual-payment-error-message" />
    </>
  )
}

export default PaymentButton
