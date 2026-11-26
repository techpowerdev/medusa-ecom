import { RadioGroupItem } from "@/components/radio-group"
import { cn } from "@/lib/utils"
import React, { useContext, useEffect, useRef, useState, type JSX } from "react"

import { isManual } from "@lib/constants"
import { intentIsTerminal } from "@lib/util/payment-session"
import OptionDot from "@modules/common/components/option-dot"
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

// SFUI-3d (spec 09 กฎ 4, 9): ตัวเลือก = RadioGroupItem ของ shadcn (ต้องอยู่ใน RadioGroup ของผู้เรียก) — testid อยู่บนปุ่ม role="radio"
// ที่มีชื่อวิธีชำระอยู่ข้างใน; ช่องกรอกบัตร (children) อยู่นอกปุ่ม (iframe ของ Stripe อยู่ใน <button> ไม่ได้) แต่ในกรอบเดียวกัน
const PaymentContainer: React.FC<PaymentContainerProps> = ({
  paymentProviderId,
  selectedPaymentOptionId,
  paymentInfoMap,
  disabled = false,
  children,
}) => {
  const isDevelopment = process.env.NODE_ENV === "development"
  const selected = selectedPaymentOptionId === paymentProviderId

  return (
    <div
      className={cn("flex flex-col text-xs leading-5 font-normal border rounded-rounded mb-2 hover:border-ring", {
        "border-primary": selected,
      })}
    >
      <RadioGroupItem
        value={paymentProviderId}
        disabled={disabled}
        // คง aria-disabled แบบ headless เดิม (Radix ใส่แค่ disabled) — payments-order-pay อ่านค่านี้ระหว่างส่ง
        aria-disabled={disabled || undefined}
        data-testid={`payment-option-${paymentProviderId}`}
        // ปุ่มเต็มกรอบ (คลิกได้ทั้งแถวเหมือนเดิม); indicator ของ shadcn ซ่อน — วาดวงกลมเองในแถว
        className="group flex size-auto aspect-auto w-full flex-col items-stretch gap-y-2 rounded-[inherit] border-0 px-8 py-4 text-left shadow-none cursor-pointer [&>[data-slot=radio-group-indicator]]:hidden"
      >
        {/* เนื้อหาในปุ่มเป็น span (phrasing content ของ <button>) */}
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-x-4">
            <OptionDot />
            <span className="text-sm leading-6 font-normal">
              {paymentInfoMap[paymentProviderId]?.title || paymentProviderId}
            </span>
            {isManual(paymentProviderId) && isDevelopment && (
              <PaymentTest className="hidden small:block" />
            )}
          </span>
          <span className="justify-self-end text-foreground">
            {paymentInfoMap[paymentProviderId]?.icon}
          </span>
        </span>
        {isManual(paymentProviderId) && isDevelopment && (
          <PaymentTest className="small:hidden text-[10px]" />
        )}
      </RadioGroupItem>
      {children ? <div className="-mt-2 px-8 pb-4">{children}</div> : null}
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
