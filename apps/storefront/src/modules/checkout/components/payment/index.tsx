"use client"
import { RadioGroup } from "@headlessui/react"
import { isStripeLike, paymentInfoMap } from "@lib/constants"
import { initiatePaymentSession } from "@lib/data/cart"
import { deliveryStepDone } from "@lib/util/digital-checkout"
import { friendlyErrorMessage } from "@lib/util/error-message"
import { isPromptPay } from "@lib/util/payment-session"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import ErrorMessage from "@modules/checkout/components/error-message"
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
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

const Payment = ({
  cart,
  availablePaymentMethods,
}: {
  cart: HttpTypes.StoreCart
  availablePaymentMethods: { id: string }[]
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

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "payment"

  const setPaymentMethod = async (method: string) => {
    setError(null)
    setSelectedPaymentMethod(method)
    setAwaitingSessionFor(null)
    setSessionPendingError(false)
    // PAY-2: PromptPay สร้าง session ทันทีที่เลือกเหมือนบัตร (QR พร้อมในขั้น review)
    if (isStripeLike(method) || isPromptPay(method)) {
      // ล็อกปุ่ม Continue จนสร้าง session เสร็จ — ไม่งั้น handleSubmit สร้างซ้ำ แล้ว PaymentIntent
      // ตัวแรก (ที่หน้าอาจถืออยู่) ถูก cancel → Stripe ตอบ "A processing error occurred"
      setIsLoading(true)
      try {
        await initiatePaymentSession(cart, {
          provider_id: method,
        })
        setAwaitingSessionFor(method)
      } catch (err) {
        setError(friendlyErrorMessage(err, "ตั้งค่าการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"))
      } finally {
        setIsLoading(false)
      }
    }
  }

  const paidByGiftcard = !!(
    (cart as unknown as Record<string, unknown>)?.gift_cards && ((cart as unknown as Record<string, unknown>)?.gift_cards as unknown[])?.length > 0 && cart?.total === 0
  )

  const paymentReady =
    (activeSession && deliveryStepDone(cart)) || paidByGiftcard

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
        await initiatePaymentSession(cart, {
          provider_id: selectedPaymentMethod,
        })
      }

      if (!shouldInputPaymentDetails) {
        return router.push(
          pathname + "?" + createQueryString("step", "review"),
          {
            scroll: false,
          }
        )
      }
    } catch (err) {
      setError(friendlyErrorMessage(err, "ตั้งค่าการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"))
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
              >
                {availablePaymentMethods.map((paymentMethod) => (
                  <div key={paymentMethod.id}>
                    {isStripeLike(paymentMethod.id) ? (
                      <StripePaymentContainer
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                        paymentInfoMap={paymentInfoMap}
                        setError={setError}
                        setPaymentComplete={setPaymentComplete}
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
            <div className="flex items-start gap-x-1 w-full">
              <div className="flex flex-col w-1/3">
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
              <div className="flex flex-col w-1/3">
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
