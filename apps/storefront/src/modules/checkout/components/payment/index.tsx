"use client"
import { RadioGroup } from "@headlessui/react"
import { isStripeLike, paymentInfoMap } from "@lib/constants"
import { initiatePaymentSession, placeOrder } from "@lib/data/cart"
import { actionErrorMessage, settleAction } from "@lib/util/action-result"
import {
  PAYMENT_ALREADY_COMPLETED,
  type SessionResetNotice,
  isPromptPay,
  sessionResetShown,
} from "@lib/util/payment-session"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import ErrorMessage from "@modules/checkout/components/error-message"
import { PlaceOrderNotice, usePlaceOrder } from "@modules/checkout/components/payment-button"
import PaymentContainer, {
  StripePaymentContainer,
} from "@modules/checkout/components/payment-container"
import Divider from "@modules/common/components/divider"
import {
  Button,
  Container,
  Heading,
  Text,
  clx,
} from "@modules/common/components/ui"
import { HttpTypes } from "@medusajs/types"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

const SESSION_FAILED = "ตั้งค่าการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
const SESSION_RESET = "กรุณาเลือกวิธีชำระเงินอีกครั้ง"

/** CORE-4i-b (กฎข้อ 72): สร้าง session แล้วคืนข้อความไทยเมื่อล้ม (`unauthorized` → SIGN_IN_AGAIN_MESSAGE), สำเร็จ → null */
export const paymentSessionError = async (
  cart: HttpTypes.StoreCart,
  providerId: string
): Promise<string | null> => {
  const result = await settleAction(initiatePaymentSession(cart, { provider_id: providerId }))
  return "error" in result ? actionErrorMessage(result.error, SESSION_FAILED) : null
}

const Payment = ({
  cart,
  availablePaymentMethods,
  deliveryDone,
}: {
  cart: HttpTypes.StoreCart
  availablePaymentMethods: { id: string }[]
  /** CORE-35 (กฎข้อ 93): จาก checkout-form — deliveryStepDone กับรายการ option ที่กรองแล้ว */
  deliveryDone: boolean
}) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession) => paymentSession.status === "pending"
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? ""
  )
  // CORE-19b (AC-64): server action สร้าง session คืนผลก่อน router นำ cart ใหม่มาใส่ props — ช่วงนั้นปุ่ม
  // Continue จะเห็น cart เก่า (ยังไม่มี session) แล้วสร้างซ้ำ (PI แรกถูก cancel) และค้างที่ขั้น payment
  // จึงล็อกปุ่มต่อจนกว่า cart ใน props มี session ของ provider ที่เพิ่งสร้าง
  const [awaitingSessionFor, setAwaitingSessionFor] = useState<string | null>(
    null
  )
  const sessionNotInCartYet =
    awaitingSessionFor !== null &&
    activeSession?.provider_id !== awaitingSessionFor
  // CORE-19e (กฎข้อ 71): RSC refresh อาจไม่มาถึง → ปุ่มต้องไม่ล็อกค้างถาวร
  const [sessionPendingError, setSessionPendingError] = useState(false)
  // CORE-19f (กฎข้อ 75 b): Continue ที่ต้องสร้าง session → ไปขั้น review หลัง cart ใน props มี session นั้นแล้ว
  const continueWhenSessionArrives = useRef(false)

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "payment"

  // PAY-14 (spec 06 กฎข้อ 16): session ที่เลือกอยู่ชี้ PI ที่จบแล้ว (เช่น session ชั่วคราวระหว่าง compensation) → สร้าง session ใหม่
  // อัตโนมัติ 1 ครั้ง ให้ backend ตัดสินตามลำดับ middleware ของ ADR-025 (คืนครบ → reset แล้ว retry ใน initiatePaymentSession;
  // จ่ายแล้วยังไม่คืน → PAYMENT_ALREADY_COMPLETED → complete cart แบบรอ order ของ ADR-015 ไม่สร้าง PI ใหม่)
  // PAY-16 (กฎข้อ 18 a): notice ผูกกับวิธีและ client secret ตอนขึ้น — เปลี่ยนวิธีหรือ session ใหม่มาแล้วจึงหายเอง
  const [sessionReset, setSessionReset] = useState<SessionResetNotice | null>(null)
  const autoRenewed = useRef(false)
  const renewing = useRef(false)
  // session ที่จบแล้วตอนสร้างใหม่สำเร็จ — cart ใน props ยังชี้ secret นี้ = RSC refresh ยังไม่มา (ไม่ค้าง skeleton ถาวร)
  const [renewedFrom, setRenewedFrom] = useState<SessionResetNotice | null>(null)
  const activeSecret = (activeSession?.data?.client_secret as string | undefined) ?? null
  const renewNotInCartYet = renewedFrom !== null && activeSecret === renewedFrom.secret
  const resetShown = sessionResetShown(sessionReset, selectedPaymentMethod, activeSecret)
  // PAY-16 (กฎข้อ 18 d): ระหว่างรอ order ของ PAYMENT_ALREADY_COMPLETED (ADR-015) ห้ามเปลี่ยนวิธีชำระ
  const [awaitingPaidOrder, setAwaitingPaidOrder] = useState(false)
  const { countryCode } = useParams()
  const placePaid = () => placeOrder(cart.id, undefined, countryCode as string)
  const paidOrder = usePlaceOrder(true, placePaid)

  const renewSession = async (method: string) => {
    if (renewing.current) return
    renewing.current = true
    const stale = { method, secret: activeSecret }
    setSessionReset(null)
    setError(null)
    setIsLoading(true)
    const result = await settleAction(initiatePaymentSession(cart, { provider_id: method }))
    setIsLoading(false)
    renewing.current = false
    if ("ok" in result) {
      setRenewedFrom(stale)
      router.refresh()
    } else if (result.error === PAYMENT_ALREADY_COMPLETED) {
      setAwaitingPaidOrder(true)
      await paidOrder.start()
      setAwaitingPaidOrder(false)
    } else if (result.error === "unauthorized") {
      setError(actionErrorMessage(result.error, SESSION_FAILED))
    } else {
      setSessionReset(stale)
    }
  }

  // แบบกฎข้อ 71 (CORE-19e): 5 วินาที refresh อีกครั้ง, 10 วินาทีให้ลูกค้าลองใหม่ด้วย notice เดิม (PAY-16 c: ซ่อน skeleton ด้วย)
  useEffect(() => {
    if (!renewNotInCartYet) return
    const refreshTimer = setTimeout(() => router.refresh(), 5_000)
    const giveUpTimer = setTimeout(() => {
      setRenewedFrom(null)
      setSessionReset(renewedFrom)
    }, 10_000)
    return () => {
      clearTimeout(refreshTimer)
      clearTimeout(giveUpTimer)
    }
  }, [renewNotInCartYet, renewedFrom, router])

  const onStaleSession = () => {
    // PAY-16 (กฎข้อ 18 b): ช่องบัตร mount ใหม่ระหว่าง renew แล้วเจอ PI เดิม — ให้ผลของ renew ที่กำลังรอตัดสิน
    if (renewing.current) return
    if (autoRenewed.current) {
      setSessionReset({ method: selectedPaymentMethod, secret: activeSecret })
      return
    }
    autoRenewed.current = true
    renewSession(selectedPaymentMethod)
  }

  const setPaymentMethod = async (method: string) => {
    setError(null)
    setSessionReset(null)
    setSelectedPaymentMethod(method)
    setAwaitingSessionFor(null)
    setSessionPendingError(false)
    continueWhenSessionArrives.current = false
    // PAY-2: PromptPay สร้าง session ทันทีที่เลือกเหมือนบัตร (QR พร้อมในขั้น review)
    if (isStripeLike(method) || isPromptPay(method)) {
      // ล็อกปุ่ม Continue จนสร้าง session เสร็จ — ไม่งั้น handleSubmit สร้างซ้ำ แล้ว PaymentIntent
      // ตัวแรก (ที่หน้าอาจถืออยู่) ถูก cancel → Stripe ตอบ "A processing error occurred"
      setIsLoading(true)
      const failure = await paymentSessionError(cart, method)
      if (failure) {
        setError(failure)
      } else {
        setAwaitingSessionFor(method)
      }
      setIsLoading(false)
    }
  }

  const paidByGiftcard = !!(
    (cart as unknown as Record<string, unknown>)?.gift_cards && ((cart as unknown as Record<string, unknown>)?.gift_cards as unknown[])?.length > 0 && cart?.total === 0
  )

  const paymentReady =
    (activeSession && deliveryDone) || paidByGiftcard

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      params.set(name, value)

      return params.toString()
    },
    [searchParams]
  )

  const handleEdit = () => {
    router.push(pathname + "?" + createQueryString("step", "payment"), {
      scroll: false,
    })
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setSessionPendingError(false)
    try {
      const shouldInputPaymentDetails =
        isStripeLike(selectedPaymentMethod) && !activeSession

      const checkActiveSession =
        activeSession?.provider_id === selectedPaymentMethod

      if (!checkActiveSession) {
        const failure = await paymentSessionError(cart, selectedPaymentMethod)
        if (failure) {
          return setError(failure)
        }
        // CORE-19f (กฎข้อ 75 b): cart ใน props ยังไม่มี session นี้ → ไปขั้น review ตอนนี้ส่วนการชำระเงินจะว่าง
        // จึงล็อกรอ session อีกรอบ (refresh/timeout ของกฎข้อ 71) แล้วไปขั้น review เมื่อ cart มี session
        continueWhenSessionArrives.current = true
        return setAwaitingSessionFor(selectedPaymentMethod)
      }

      if (!shouldInputPaymentDetails) {
        return router.push(
          pathname + "?" + createQueryString("step", "review"),
          {
            scroll: false,
          }
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  // CORE-19e (กฎข้อ 71): ล็อกเกิน 5 วินาที → refresh 1 ครั้ง; 10 วินาที → ปลดล็อก + error
  // cart ได้ session เมื่อใด sessionNotInCartYet เป็น false แล้ว cleanup ยกเลิก timer ทั้งคู่
  useEffect(() => {
    if (!sessionNotInCartYet) {
      return
    }
    const refreshTimer = setTimeout(() => router.refresh(), 5_000)
    const unlockTimer = setTimeout(() => {
      setAwaitingSessionFor(null)
      setSessionPendingError(true)
    }, 10_000)
    return () => {
      clearTimeout(refreshTimer)
      clearTimeout(unlockTimer)
    }
  }, [sessionNotInCartYet, router])

  useEffect(() => {
    // ลูกค้ากด "แก้ไข" ขั้นอื่นระหว่างรอ → ไม่ดึงกลับไปขั้น review (review #310)
    if (!isOpen) {
      continueWhenSessionArrives.current = false
      return
    }
    if (
      continueWhenSessionArrives.current &&
      awaitingSessionFor &&
      !sessionNotInCartYet
    ) {
      continueWhenSessionArrives.current = false
      router.push(pathname + "?" + createQueryString("step", "review"), {
        scroll: false,
      })
    }
  }, [
    isOpen,
    awaitingSessionFor,
    sessionNotInCartYet,
    router,
    pathname,
    createQueryString,
  ])

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none":
                !isOpen && !paymentReady,
            }
          )}
          data-testid="payment-heading"
        >
          การชำระเงิน
          {!isOpen && paymentReady && <CheckCircleSolid />}
        </Heading>
        {!isOpen && paymentReady && (
          <Text>
            <button
              onClick={handleEdit}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="edit-payment-button"
            >
              แก้ไข
            </button>
          </Text>
        )}
      </div>
      <div>
        <div className={isOpen ? "block" : "hidden"}>
          {!paidByGiftcard && availablePaymentMethods?.length && (
            <>
              <RadioGroup
                value={selectedPaymentMethod}
                onChange={(value: string) => setPaymentMethod(value)}
                disabled={awaitingPaidOrder || paidOrder.busy}
              >
                {availablePaymentMethods.map((paymentMethod) => (
                  <div
                    key={paymentMethod.id}
                    // PAY-14: คลิกตัวเลือกที่เลือกอยู่ไม่เรียก onChange ของ RadioGroup → สร้าง session ใหม่จากที่นี่
                    onClick={
                      resetShown && paymentMethod.id === selectedPaymentMethod
                        ? () => renewSession(paymentMethod.id)
                        : undefined
                    }
                  >
                    {isStripeLike(paymentMethod.id) ? (
                      <StripePaymentContainer
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                        paymentInfoMap={paymentInfoMap}
                        setError={setError}
                        setPaymentComplete={setPaymentComplete}
                        clientSecret={
                          activeSession?.provider_id === paymentMethod.id
                            ? (activeSession.data?.client_secret as string | undefined)
                            : undefined
                        }
                        onStaleSession={onStaleSession}
                        // PAY-16 (กฎข้อ 18 c): notice ขึ้นแล้วไม่แสดง skeleton ค้างคู่กัน (session นี้ใช้ไม่ได้ — รอลูกค้าลองใหม่)
                        fieldsHidden={resetShown}
                      />
                    ) : (
                      <PaymentContainer
                        paymentInfoMap={paymentInfoMap}
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                      />
                    )}
                  </div>
                ))}
              </RadioGroup>
            </>
          )}

          {paidByGiftcard && (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                วิธีชำระเงิน
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                บัตรของขวัญ
              </Text>
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="payment-method-error-message"
          />
          <ErrorMessage
            error={
              sessionPendingError
                ? "ระบบยังเตรียมการชำระเงินไม่เสร็จ กรุณาลองอีกครั้ง"
                : null
            }
            data-testid="payment-session-pending-error"
          />
          {resetShown && (
            <div role="alert" className="pt-2 flex items-center gap-x-3 text-small-regular" data-testid="payment-session-reset-notice">
              <Text>{SESSION_RESET}</Text>
              <button
                onClick={() => renewSession(selectedPaymentMethod)}
                disabled={isLoading}
                className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
                data-testid="payment-session-retry"
              >
                ลองอีกครั้ง
              </button>
            </div>
          )}
          <PlaceOrderNotice shown={paidOrder.shown} errorTestId="payment-session-order-error" />

          <Button
            size="large"
            className="mt-6"
            onClick={handleSubmit}
            isLoading={isLoading || sessionNotInCartYet}
            disabled={
              (isStripeLike(selectedPaymentMethod) && !paymentComplete) ||
              (!selectedPaymentMethod && !paidByGiftcard)
            }
            data-testid="submit-payment-button"
          >
            {!activeSession && isStripeLike(selectedPaymentMethod)
              ? "กรอกข้อมูลการชำระเงิน"
              : "ไปขั้นตอนตรวจสอบคำสั่งซื้อ"}
          </Button>
        </div>

        <div className={isOpen ? "hidden" : "block"}>
          {cart && paymentReady && activeSession ? (
            // CORE-89 (กฎข้อ 145): < 640px ซ้อนกันเต็มความกว้าง (w-1/3 คู่กันที่ 375px ตัดทีละคำ); ≥ 640px (`sm` ของ Tailwind — `small` ของ starter คือ 1024px) แถวเดียวเหมือนเดิม
            <div className="flex flex-col sm:flex-row items-start gap-y-4 sm:gap-x-1 w-full">
              <div className="flex flex-col w-full sm:w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  วิธีชำระเงิน
                </Text>
                <Text
                  className="txt-medium text-ui-fg-subtle"
                  data-testid="payment-method-summary"
                >
                  {paymentInfoMap[activeSession?.provider_id]?.title ||
                    activeSession?.provider_id}
                </Text>
              </div>
              <div className="flex flex-col w-full sm:w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  รายละเอียดการชำระเงิน
                </Text>
                <div
                  className="flex gap-2 txt-medium text-ui-fg-subtle items-center"
                  data-testid="payment-details-summary"
                >
                  <Container className="flex items-center h-7 w-fit p-2 bg-ui-button-neutral-hover">
                    {paymentInfoMap[selectedPaymentMethod]?.icon || (
                      <CreditCard />
                    )}
                  </Container>
                  <Text>จะมีขั้นตอนเพิ่มเติมปรากฏขึ้น</Text>
                </div>
              </div>
            </div>
          ) : paidByGiftcard ? (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                วิธีชำระเงิน
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                บัตรของขวัญ
              </Text>
            </div>
          ) : null}
        </div>
      </div>
      <Divider className="mt-8" />
    </div>
  )
}

export default Payment
