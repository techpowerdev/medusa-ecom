"use client"
import { Button } from "@/components/button"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { setShippingMethod } from "@lib/data/cart"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"
import { actionErrorMessage, settleAction } from "@lib/util/action-result"
import { addressLines } from "@lib/util/address-lines"
import { convertToLocale } from "@lib/util/money"
import { selectedShippingOptionId, shippingOptionsForCart } from "@lib/util/shipping-options"
import { HttpTypes } from "@medusajs/types"
import ErrorMessage from "@modules/checkout/components/error-message"
import Divider from "@modules/common/components/divider"
import { CircleCheck, LoaderCircle } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useId, useState } from "react"

/** CORE-4i-b (กฎข้อ 72): เลือกวิธีจัดส่งแล้วคืนข้อความไทยเมื่อล้ม (`unauthorized` → SIGN_IN_AGAIN_MESSAGE), สำเร็จ → null */
export const selectShippingMethod = async (cartId: string, shippingMethodId: string): Promise<string | null> => {
  const result = await settleAction(setShippingMethod({ cartId, shippingMethodId }))
  return "error" in result ? actionErrorMessage(result.error, "เลือกวิธีจัดส่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง") : null
}

const PICKUP_OPTION_ON = "__PICKUP_ON"
const PICKUP_OPTION_OFF = "__PICKUP_OFF"

// SFUI-21c (spec 09 กฎ 80, ADR-034 D8): ตัวเลือก = "Choice Card" ของ shadcn (`field` + `radio-group`) — FieldLabel (การ์ด คลิกได้ทั้งใบ)
// → Field horizontal → FieldContent (ชื่อ/ราคา) + RadioGroupItem (indicator default; testid/data-option-id/aria-disabled อยู่ที่นี่ — กฎ 9)

type ShippingProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
}

const Shipping: React.FC<ShippingProps> = ({
  cart,
  availableShippingMethods: unfilteredShippingMethods,
}) => {
  // CORE-32/33 (กฎข้อ 89, 91): กรองตาม cart ที่นี่ที่เดียว แล้วใช้รายการนี้ตัดสินทั้ง radio, ปุ่ม และสรุป
  const availableShippingMethods = shippingOptionsForCart(unfilteredShippingMethods ?? [], cart)
  const selectedOptionId = selectedShippingOptionId(cart, availableShippingMethods)
  const selectedMethod = selectedOptionId
    ? cart.shipping_methods?.filter((m) => m.shipping_option_id === selectedOptionId).at(-1)
    : undefined
  const [isLoading, setIsLoading] = useState(false)
  const uid = useId()
  const [isLoadingPrices, setIsLoadingPrices] = useState(true)

  const [showPickupOptions, setShowPickupOptions] =
    useState<string>(PICKUP_OPTION_OFF)
  const [calculatedPricesMap, setCalculatedPricesMap] = useState<
    Record<string, number>
  >({})
  const [error, setError] = useState<string | null>(null)
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(
    selectedOptionId
  )

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "delivery"

  const _shippingMethods = availableShippingMethods?.filter(
    (sm) => (sm as unknown as { service_zone?: { fulfillment_set?: { type?: string; location?: { address: HttpTypes.StoreCartAddress } } } }).service_zone?.fulfillment_set?.type !== "pickup"
  )

  const _pickupMethods = availableShippingMethods?.filter(
    (sm) => (sm as unknown as { service_zone?: { fulfillment_set?: { type?: string; location?: { address: HttpTypes.StoreCartAddress } } } }).service_zone?.fulfillment_set?.type === "pickup"
  )

  const hasPickupOptions = !!_pickupMethods?.length

  useEffect(() => {
    setIsLoadingPrices(true)

    if (_shippingMethods?.length) {
      const promises = _shippingMethods
        .filter((sm) => sm.price_type === "calculated")
        .map((sm) => calculatePriceForShippingOption(sm.id, cart.id))

      if (promises.length) {
        Promise.allSettled(promises).then((res) => {
          const pricesMap: Record<string, number> = {}
          res
            .filter((r) => r.status === "fulfilled")
            .forEach((p) => {
              if (p.value?.id) {
                pricesMap[p.value.id] = p.value.amount ?? 0
              }
            })

          setCalculatedPricesMap(pricesMap)
          setIsLoadingPrices(false)
        })
      }
    }

    if (_pickupMethods?.find((m) => m.id === shippingMethodId)) {
      setShowPickupOptions(PICKUP_OPTION_ON)
    }
  }, [unfilteredShippingMethods])

  const handleEdit = () => {
    router.push(pathname + "?step=delivery", { scroll: false })
  }

  const handleSubmit = () => {
    router.push(pathname + "?step=payment", { scroll: false })
  }

  const handleSetShippingMethod = async (
    id: string,
    variant: "shipping" | "pickup"
  ) => {
    setError(null)

    if (variant === "pickup") {
      setShowPickupOptions(PICKUP_OPTION_ON)
    } else {
      setShowPickupOptions(PICKUP_OPTION_OFF)
    }

    let currentId: string | null = null
    setIsLoading(true)
    setShippingMethodId((prev) => {
      currentId = prev
      return id
    })

    const failure = await selectShippingMethod(cart.id, id)
    if (failure) {
      setShippingMethodId(currentId)
      setError(failure)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <h2
          className={cn(
            "flex flex-row text-2xl font-semibold gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none":
                !isOpen && !selectedMethod,
            }
          )}
          data-testid="delivery-heading"
        >
          การจัดส่ง
          {!isOpen && selectedMethod && <CircleCheck className="size-4" />}
        </h2>
        {!isOpen &&
          cart?.shipping_address &&
          cart?.billing_address &&
          cart?.email && (
            <p className="text-sm leading-[1.4rem]">
              {/* SFUI-23 (spec 09 กฎ 84): -mr-4 ให้ข้อความชิดขวาแถวหัวข้อ (padding/พื้นที่กดคงตาม default) */}
              <Button variant="link" className="-mr-4" onClick={handleEdit} data-testid="edit-delivery-button">
                แก้ไข
              </Button>
            </p>
          )}
      </div>
      {isOpen ? (
        <>
          <div className="grid">
            <div className="flex flex-col">
              <span
                className="font-medium text-sm leading-[1.4rem] text-foreground"
                data-testid="delivery-method-title"
              >
                วิธีจัดส่ง
              </span>
              <span className="mb-4 text-muted-foreground text-sm leading-[1.4rem]">
                เลือกวิธีรับสินค้าที่คุณต้องการ
              </span>
            </div>
            {availableShippingMethods.length === 0 ? (
              <p
                className="pb-8 text-sm leading-[1.4rem] text-muted-foreground"
                data-testid="delivery-options-empty"
              >
                ไม่มีวิธีจัดส่งสำหรับสินค้าในตะกร้านี้ กรุณาติดต่อร้าน
              </p>
            ) : (
            <div data-testid="delivery-options-container">
              <div className="grid gap-3 pb-8 md:pt-0 pt-2">
                {/* SFUI-3e (spec 09 กฎ 4, 12–13): RadioGroup ของ shadcn — ลูกศรเปลี่ยนตัวเลือก; ไม่อยู่ใน <form> (ไม่มี input ซ่อน
                    และไม่โดน reset ของ form) — คลิกตัวที่เลือกอยู่ไม่เรียก onValueChange เหมือน headless เดิม */}
                {hasPickupOptions && (
                  <RadioGroup
                    value={showPickupOptions}
                    onValueChange={() => {
                      const id = _pickupMethods.find(
                        (option) => !option.insufficient_inventory
                      )?.id

                      if (id) {
                        handleSetShippingMethod(id, "pickup")
                      }
                    }}
                  >
                    <FieldLabel htmlFor={`${uid}-pickup`}>
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>รับสินค้าด้วยตนเอง</FieldTitle>
                          <FieldDescription>-</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem
                          value={PICKUP_OPTION_ON}
                          id={`${uid}-pickup`}
                          data-testid="delivery-option-radio"
                        />
                      </Field>
                    </FieldLabel>
                  </RadioGroup>
                )}
                <RadioGroup
                  value={shippingMethodId ?? ""}
                  onValueChange={(v) => {
                    if (v) {
                      return handleSetShippingMethod(v, "shipping")
                    }
                  }}
                >
                  {_shippingMethods?.map((option) => {
                    const isDisabled =
                      option.price_type === "calculated" &&
                      !isLoadingPrices &&
                      typeof calculatedPricesMap[option.id] !== "number"

                    return (
                      <FieldLabel key={option.id} htmlFor={`${uid}-${option.id}`}>
                        <Field orientation="horizontal" data-disabled={isDisabled || undefined}>
                          <FieldContent>
                            <FieldTitle>{option.name}</FieldTitle>
                            <FieldDescription>
                              {option.price_type === "flat" ? (
                                convertToLocale({
                                  amount: option.amount!,
                                  currency_code: cart?.currency_code,
                                })
                              ) : calculatedPricesMap[option.id] ? (
                                convertToLocale({
                                  amount: calculatedPricesMap[option.id],
                                  currency_code: cart?.currency_code,
                                })
                              ) : isLoadingPrices ? (
                                <LoaderCircle className="size-4 animate-spin" />
                              ) : (
                                "-"
                              )}
                            </FieldDescription>
                          </FieldContent>
                          <RadioGroupItem
                            value={option.id}
                            id={`${uid}-${option.id}`}
                            data-testid="delivery-option-radio"
                            data-option-id={option.id}
                            disabled={isDisabled}
                            // คง aria-disabled แบบ headless เดิม (Radix ใส่แค่ disabled)
                            aria-disabled={isDisabled || undefined}
                          />
                        </Field>
                      </FieldLabel>
                    )
                  })}
                </RadioGroup>
              </div>
            </div>
            )}
          </div>

          {showPickupOptions === PICKUP_OPTION_ON && (
            <div className="grid">
              <div className="flex flex-col">
                <span className="font-medium text-sm leading-[1.4rem] text-foreground">
                  สาขา
                </span>
                <span className="mb-4 text-muted-foreground text-sm leading-[1.4rem]">
                  เลือกสาขาที่ใกล้คุณ
                </span>
              </div>
              <div data-testid="delivery-options-container">
                <div className="pb-8 md:pt-0 pt-2">
                  <RadioGroup
                    value={shippingMethodId ?? ""}
                    onValueChange={(v) => {
                      if (v) {
                        return handleSetShippingMethod(v, "pickup")
                      }
                    }}
                  >
                    {_pickupMethods?.map((option) => {
                      return (
                        <FieldLabel key={option.id} htmlFor={`${uid}-${option.id}`}>
                          <Field orientation="horizontal" data-disabled={option.insufficient_inventory || undefined}>
                            <FieldContent>
                              <FieldTitle>{option.name}</FieldTitle>
                              <FieldDescription>
                                {/* SFUI-18a (spec 09 กฎ 57): ที่อยู่ของจุดรับสินค้าตามลำดับไทย บรรทัดเดียว (ไม่มีจุลภาค/ช่องว่างซ้อน) */}
                                {addressLines(
                                  (option as unknown as { service_zone?: { fulfillment_set?: { location?: { address: HttpTypes.StoreCartAddress } } } }).service_zone?.fulfillment_set?.location
                                    ?.address
                                )
                                  .filter(Boolean)
                                  .join(" ")}
                              </FieldDescription>
                              <FieldDescription>
                                {convertToLocale({
                                  amount: option.amount!,
                                  currency_code: cart?.currency_code,
                                })}
                              </FieldDescription>
                            </FieldContent>
                            <RadioGroupItem
                              value={option.id}
                              id={`${uid}-${option.id}`}
                              disabled={option.insufficient_inventory}
                              aria-disabled={option.insufficient_inventory || undefined}
                              data-testid="delivery-option-radio"
                            />
                          </Field>
                        </FieldLabel>
                      )
                    })}
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          <div>
            <ErrorMessage
              error={error}
              data-testid="delivery-option-error-message"
            />
            <Button
              onClick={handleSubmit}
              isLoading={isLoading}
              disabled={!selectedOptionId}
              data-testid="submit-delivery-option-button"
            >
              ไปขั้นตอนการชำระเงิน
            </Button>
          </div>
        </>
      ) : (
        <div>
          <div className="text-xs leading-5 font-normal">
            {selectedMethod && (
              <div className="flex flex-col w-1/3">
                <p className="text-sm leading-[1.4rem] font-medium text-foreground mb-1">
                  วิธีจัดส่ง
                </p>
                <p className="text-sm leading-[1.4rem] text-muted-foreground">
                  {selectedMethod.name}{" "}
                  {convertToLocale({
                    amount: selectedMethod.amount!,
                    currency_code: cart?.currency_code,
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}

export default Shipping
