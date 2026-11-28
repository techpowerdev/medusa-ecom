"use client"

import { STORE_NAME } from "@lib/store-content"
import ErrorMessage from "@modules/checkout/components/error-message"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { cn } from "@/lib/utils"

import PaymentButton from "../payment-button"
import { useSearchParams } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

const Review = ({
  cart,
  deliveryDone,
  flashLimitExceeded = false,
}: {
  cart: HttpTypes.StoreCart
  /** CORE-35 (กฎข้อ 93): จาก checkout-form — deliveryStepDone กับรายการ option ที่กรองแล้ว */
  deliveryDone: boolean
  /** FS-21 (spec 03 กฎข้อ 26b): จำนวน flash เกินสิทธิ์ต่อคนที่เหลือ → ปุ่มสั่งซื้อ disabled จนกว่าจะแก้ในตะกร้า */
  flashLimitExceeded?: boolean
}) => {
  const searchParams = useSearchParams()

  const isOpen = searchParams.get("step") === "review"

  const paidByGiftcard = !!(
    (cart as unknown as Record<string, unknown>)?.gift_cards && ((cart as unknown as Record<string, unknown>)?.gift_cards as unknown[])?.length > 0 && cart?.total === 0
  )

  const previousStepsCompleted =
    cart.shipping_address &&
    deliveryDone &&
    (cart.payment_collection || paidByGiftcard)

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <h2
          className={cn(
            "text-2xl font-semibold flex flex-row gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none": !isOpen,
            }
          )}
          data-testid="review-heading"
        >
          ตรวจสอบคำสั่งซื้อ
        </h2>
      </div>
      {isOpen && previousStepsCompleted && (
        <>
          <div className="flex items-start gap-x-1 w-full mb-6">
            <div className="w-full">
              <p
                className="text-sm leading-[1.4rem] font-medium text-foreground mb-1"
                data-testid="review-terms"
              >
                เมื่อกดปุ่มยืนยันคำสั่งซื้อ คุณยืนยันว่าได้อ่าน เข้าใจ และยอมรับข้อกำหนดการใช้งาน
                เงื่อนไขการขาย และนโยบายการคืนสินค้า รวมถึงรับทราบนโยบายความเป็นส่วนตัวของ{" "}
                {STORE_NAME} แล้ว
              </p>
            </div>
          </div>
          {flashLimitExceeded && (
            // SFUI-21d (spec 09 กฎ 74 (a)): error ของขั้น review = Alert ผ่าน ErrorMessage (ระยะห่างภายนอกที่ wrapper)
            <div className="mb-4">
              <ErrorMessage
                data-testid="review-flash-exceeds-customer-limit"
                error={
                  <span>
                    จำนวนสินค้าแฟลชเซลในตะกร้าเกินสิทธิ์ที่คุณซื้อได้{" "}
                    <LocalizedClientLink href="/cart" className="underline">
                      กรุณาแก้จำนวนในตะกร้า
                    </LocalizedClientLink>{" "}
                    ก่อนสั่งซื้อ
                  </span>
                }
              />
            </div>
          )}
          <PaymentButton
            cart={cart}
            deliveryDone={deliveryDone}
            blocked={flashLimitExceeded}
            data-testid="submit-order-button"
          />
        </>
      )}
    </div>
  )
}

export default Review
