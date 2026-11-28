import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { RadioGroupItem } from "@/components/ui/radio-group"
import React, { useContext, useEffect, useId, useRef, useState, type JSX } from "react"

import { isManual } from "@lib/constants"
import { intentIsTerminal } from "@lib/util/payment-session"
import SkeletonCardDetails from "@modules/skeletons/components/skeleton-card-details"
import { PaymentElement, useStripe } from "@stripe/react-stripe-js"
import PaymentTest from "../payment-test"
import { StripeContext } from "../payment-wrapper/stripe-wrapper"

type PaymentContainerProps = {
  paymentProviderId: string
  selectedPaymentOptionId: string | null
  disabled?: boolean
  paymentInfoMap: Record<string, { title: string; icon: JSX.Element }>
  children?: React.ReactNode
}

// SFUI-21c (spec 09 กฎ 80, ADR-034 D8): ตัวเลือก = "Choice Card" ของ shadcn (`field` + `radio-group`) โครงเดียวกับตัวเลือกจัดส่ง —
// FieldLabel (การ์ด คลิกได้ทั้งใบ) → Field horizontal → FieldContent (ชื่อวิธี + icon) + RadioGroupItem (ต้องอยู่ใน RadioGroup ของผู้เรียก;
// testid/aria-disabled อยู่ที่ปุ่ม role="radio" — กฎ 9); ช่องกรอกบัตร/QR (children) อยู่ถัดจาก label นอก <label> (iframe ของ Stripe อยู่ใน label ไม่ได้)
const PaymentContainer: React.FC<PaymentContainerProps> = ({
  paymentProviderId,
  paymentInfoMap,
  disabled = false,
  children,
}) => {
  const isDevelopment = process.env.NODE_ENV === "development"
  const id = useId()

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id}>
        <Field orientation="horizontal" data-disabled={disabled || undefined}>
          <FieldContent>
            <FieldTitle>
              {paymentInfoMap[paymentProviderId]?.title || paymentProviderId}
              {isManual(paymentProviderId) && isDevelopment && <PaymentTest />}
            </FieldTitle>
            <FieldDescription>{paymentInfoMap[paymentProviderId]?.icon}</FieldDescription>
          </FieldContent>
          <RadioGroupItem
            value={paymentProviderId}
            id={id}
            disabled={disabled}
            // คง aria-disabled แบบ headless เดิม (Radix ใส่แค่ disabled) — payments-order-pay อ่านค่านี้ระหว่างส่ง
            aria-disabled={disabled || undefined}
            data-testid={`payment-option-${paymentProviderId}`}
          />
        </Field>
      </FieldLabel>
      {children}
    </div>
  )
}

export default PaymentContainer

type StripeFieldsProps = {
  /** client secret ของ session ที่เลือกอยู่ (ไม่มี = ไม่ตรวจ ตามเดิม) */
  clientSecret?: string
  /** PAY-14 (spec 06 กฎข้อ 16 a): PI จบแล้ว หรือ Elements โหลดไม่ได้ → ผู้เรียกสร้าง session ใหม่ (ไม่ส่ง = แสดงข้อความไทย) */
  onStaleSession?: () => void
  setError: (error: string | null) => void
  setPaymentComplete: (complete: boolean) => void
}

/** PAY-14: ตรวจ PI ของ session ก่อน mount Payment Element — PI `succeeded`/`canceled` ไม่ mount (Stripe ขึ้น error "terminal state") */
const StripeCardFields = ({ clientSecret, onStaleSession, setError, setPaymentComplete }: StripeFieldsProps) => {
  const stripe = useStripe()
  const [liveSecret, setLiveSecret] = useState<string | null>(null)
  const stale = useRef(onStaleSession)
  useEffect(() => {
    stale.current = onStaleSession
  })

  useEffect(() => {
    if (!stripe || !clientSecret) return
    let active = true
    stripe.retrievePaymentIntent(clientSecret).then(
      ({ paymentIntent }) => {
        if (!active) return
        if (intentIsTerminal(paymentIntent?.status) && stale.current) stale.current()
        else setLiveSecret(clientSecret)
      },
      // อ่านสถานะไม่ได้ (network) → mount ตามเดิม; Elements ที่โหลดไม่ได้เข้าทาง onLoadError
      () => active && setLiveSecret(clientSecret)
    )
    return () => {
      active = false
    }
  }, [stripe, clientSecret])

  if (clientSecret && liveSecret !== clientSecret) return <SkeletonCardDetails />

  return (
    <div className="my-4 transition-all duration-150 ease-in-out">
      <p className="text-sm leading-[1.4rem] font-medium text-foreground mb-1">
        กรอกข้อมูลการชำระเงิน:
      </p>
      <PaymentElement
        options={{ layout: "accordion" }}
        onChange={(e) => {
          setError(null)
          setPaymentComplete(e.complete)
        }}
        // Without a handler Stripe.js reports a failed mount as an unhandled "payment Element loaderror".
        // PAY-14 (กฎข้อ 16 a/b): ไม่แสดงข้อความอังกฤษของ Stripe — สร้าง session ใหม่ (ล้มอีก → ข้อความไทยของผู้เรียก)
        onLoadError={() => {
          setPaymentComplete(false)
          if (stale.current) stale.current()
          else setError("โหลดวิธีชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
        }}
      />
    </div>
  )
}

export const StripePaymentContainer = ({
  paymentProviderId,
  selectedPaymentOptionId,
  paymentInfoMap,
  disabled = false,
  fieldsHidden = false,
  ...fields
}: Omit<PaymentContainerProps, "children"> &
  StripeFieldsProps & {
    /** PAY-16 (spec 06 กฎข้อ 18 c): ไม่ render ช่องบัตร/skeleton (session ที่เลือกใช้ไม่ได้และรอลูกค้าลองใหม่) */
    fieldsHidden?: boolean
  }) => {
  const stripeReady = useContext(StripeContext)

  return (
    <PaymentContainer
      paymentProviderId={paymentProviderId}
      selectedPaymentOptionId={selectedPaymentOptionId}
      paymentInfoMap={paymentInfoMap}
      disabled={disabled}
    >
      {selectedPaymentOptionId === paymentProviderId &&
        !fieldsHidden &&
        (stripeReady ? <StripeCardFields {...fields} /> : <SkeletonCardDetails />)}
    </PaymentContainer>
  )
}
