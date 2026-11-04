"use client"

import { Badge, Heading, Input, Label, Text } from "@modules/common/components/ui"
import React from "react"

import { applyPromotions } from "@lib/data/cart"
import { actionErrorMessage, settleAction } from "@lib/util/action-result"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import Trash from "@modules/common/icons/trash"
import ErrorMessage from "../error-message"
import { SubmitButton } from "../submit-button"

const PROMOTION_NOT_APPLICABLE =
  "ใช้โค้ดนี้ไม่ได้ โค้ดอาจหมดอายุหรือไม่ตรงเงื่อนไขของตะกร้า"
export const PROMOTION_FAILED = "ใช้โค้ดส่วนลดนี้ไม่ได้ กรุณาตรวจสอบโค้ดอีกครั้ง"
/** CORE-36 (กฎข้อ 94): ลบโค้ดล้มด้วยเหตุที่ไม่ใช่ auth — ข้อความเฉพาะการลบ ไม่ใช้ข้อความของการใส่โค้ด */
export const PROMOTION_REMOVE_FAILED = "ลบโค้ดส่วนลดไม่สำเร็จ กรุณาลองอีกครั้ง"

/**
 * CORE-4i (spec 01 กฎข้อ 72): ตั้งชุดโค้ดของ cart แล้วคืนข้อความ error ที่จะแสดง ("" = สำเร็จ)
 * `wanted` = โค้ดที่ผู้ใช้เพิ่งใส่ — Medusa ตอบ 200 แต่ไม่ใส่โค้ดที่ใช้ไม่ได้ (กฎข้อ 63b); action ที่ reject เอง → fallback
 */
export const submitPromotionCodes = async (
  codes: string[],
  wanted?: string,
  fallback: string = PROMOTION_FAILED
): Promise<string> => {
  const result = await settleAction(applyPromotions(codes))
  if ("error" in result) {
    return actionErrorMessage(result.error, fallback)
  }
  const code = wanted?.trim().toLowerCase()
  if (code && !result.codes.some((c) => c.toLowerCase() === code)) {
    return PROMOTION_NOT_APPLICABLE
  }
  return ""
}

type DiscountCodeProps = {
  cart: HttpTypes.StoreCart
}

const DiscountCode: React.FC<DiscountCodeProps> = ({ cart }) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState("")
  // CORE-36 (กฎข้อ 94): โค้ดที่กำลังลบ (แสดงสถานะ) + ref กันคลิกซ้อนใน tick เดียว ก่อน state re-render (แบบ CORE-27)
  const [removingCode, setRemovingCode] = React.useState<string | null>(null)
  const removingRef = React.useRef(false)

  const { promotions = [] } = cart
  const removePromotionCode = async (code: string) => {
    if (removingRef.current) {
      return
    }
    removingRef.current = true
    setRemovingCode(code)
    // CORE-34 (กฎข้อ 92): ล้าง error ของรอบก่อนก่อนส่ง แบบเดียวกับ addPromotionCode
    setErrorMessage("")

    const validPromotions = promotions.filter(
      (promotion) => promotion.code !== code
    )

    try {
      setErrorMessage(
        await submitPromotionCodes(
          validPromotions.filter((p) => p.code !== undefined).map((p) => p.code!),
          undefined,
          PROMOTION_REMOVE_FAILED
        )
      )
    } finally {
      removingRef.current = false
      setRemovingCode(null)
    }
  }

  const addPromotionCode = async (formData: FormData) => {
    setErrorMessage("")

    const code = formData.get("code")
    if (!code) {
      return
    }
    const input = document.getElementById("promotion-input") as HTMLInputElement
    const codes = promotions
      .filter((p) => p.code !== undefined)
      .map((p) => p.code!)
    codes.push(code.toString())

    // CORE-4g (กฎข้อ 63b): Medusa ตอบ 200 แต่ไม่ใส่ code ที่ใช้ไม่ได้ (หมดอายุ/ไม่ตรงเงื่อนไข) — แจ้งผู้ใช้ ไม่เงียบ
    setErrorMessage(await submitPromotionCodes(codes, code.toString()))

    if (input) {
      input.value = ""
    }
  }

  return (
    <div className="w-full bg-white flex flex-col">
      <div className="txt-medium">
        <form action={(a) => addPromotionCode(a)} className="w-full mb-5">
          <Label className="flex gap-x-1 my-2 items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              type="button"
              className="txt-medium text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="add-discount-button"
            >
              เพิ่มโค้ดส่วนลด
            </button>

            {/* <Tooltip content="You can add multiple promotion codes">
              <InformationCircleSolid color="var(--fg-muted)" />
            </Tooltip> */}
          </Label>

          {isOpen && (
            <div className="flex w-full gap-x-2">
              <Input
                className="size-full"
                id="promotion-input"
                name="code"
                type="text"
                autoFocus={false}
                data-testid="discount-input"
              />
              <SubmitButton
                variant="secondary"
                data-testid="discount-apply-button"
              >
                ใช้โค้ด
              </SubmitButton>
            </div>
          )}

          {/* CORE-28 (กฎข้อ 85): error ของการใส่/ลบโค้ดต้องเห็นแม้ช่องใส่โค้ดปิด */}
          <ErrorMessage error={errorMessage} data-testid="promotion-error" />
        </form>

        {promotions.length > 0 && (
          <div className="w-full flex items-center">
            <div className="flex flex-col w-full">
              <Heading className="txt-medium mb-2">
                โค้ดส่วนลดที่ใช้:
              </Heading>

              {promotions.map((promotion) => {
                return (
                  <div
                    key={promotion.id}
                    className="flex items-center justify-between w-full max-w-full mb-2"
                    data-testid="discount-row"
                  >
                    <Text className="flex gap-x-1 items-baseline txt-small-plus w-4/5 pr-1">
                      <span className="truncate" data-testid="discount-code">
                        <Badge
                          color={promotion.is_automatic ? "green" : "grey"}
                        >
                          {promotion.code}
                        </Badge>{" "}
                        (
                        {promotion.application_method?.value !== undefined &&
                          promotion.application_method.currency_code !==
                            undefined && (
                            <>
                              {promotion.application_method.type ===
                              "percentage"
                                ? `${promotion.application_method.value}%`
                                : convertToLocale({
                                    amount: +promotion.application_method.value,
                                    currency_code:
                                      promotion.application_method
                                        .currency_code,
                                  })}
                            </>
                          )}
                        )
                        {/* {promotion.is_automatic && (
                          <Tooltip content="This promotion is automatically applied">
                            <InformationCircleSolid className="inline text-zinc-400" />
                          </Tooltip>
                        )} */}
                      </span>
                    </Text>
                    {!promotion.is_automatic && (
                      <button
                        className="flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={removingCode !== null}
                        aria-busy={removingCode === promotion.code}
                        onClick={() => {
                          if (!promotion.code) {
                            return
                          }

                          removePromotionCode(promotion.code)
                        }}
                        data-testid="remove-discount-button"
                      >
                        <Trash size={14} />
                        <span className="sr-only">
                          ลบโค้ดส่วนลดออกจากคำสั่งซื้อ
                        </span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DiscountCode
