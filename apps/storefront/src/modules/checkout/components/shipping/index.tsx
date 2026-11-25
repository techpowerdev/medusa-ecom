"use client"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { setShippingMethod } from "@lib/data/cart"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"
import { actionErrorMessage, settleAction } from "@lib/util/action-result"
import { convertToLocale } from "@lib/util/money"
import { selectedShippingOptionId, shippingOptionsForCart } from "@lib/util/shipping-options"
import { HttpTypes } from "@medusajs/types"
import ErrorMessage from "@modules/checkout/components/error-message"
import Divider from "@modules/common/components/divider"
import { CircleCheck, LoaderCircle } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

/** CORE-4i-b (กฎข้อ 72): เลือกวิธีจัดส่งแล้วคืนข้อความไทยเมื่อล้ม (`unauthorized` → SIGN_IN_AGAIN_MESSAGE), สำเร็จ → null */
export const selectShippingMethod = async (cartId: string, shippingMethodId: string): Promise<string | null> => {
  const result = await settleAction(setShippingMethod({ cartId, shippingMethodId }))
  return "error" in result ? actionErrorMessage(result.error, "เลือกวิธีจัดส่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง") : null
}

const PICKUP_OPTION_ON = "__PICKUP_ON"
const PICKUP_OPTION_OFF = "__PICKUP_OFF"

// SFUI-3e (spec 09 กฎ 4, 9, 12): ตัวเลือก = RadioGroupItem ของ shadcn (ปุ่ม role="radio" ที่มี testid และชื่อ/ราคาอยู่ข้างใน)
// ทั้งแถวเป็นปุ่ม (คลิกได้ทั้งแถวเหมือนเดิม); indicator ของ shadcn ซ่อน — วาดวงกลมเองในแถว (แบบเดียวกับ PaymentContainer ของ SFUI-3d)
const OPTION_CLASS =
  "group flex size-auto aspect-auto w-full items-center justify-between rounded-md text-small-regular text-left shadow-none cursor-pointer py-4 px-8 mb-2 hover:border-ring [&>[data-slot=radio-group-indicator]]:hidden"

const OptionDot = () => (
  <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary">
    <span className="hidden size-1.5 rounded-full bg-primary-foreground group-data-[state=checked]:block" />
  </span>
)

type ShippingProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
}

function formatAddress(address: HttpTypes.StoreCartAddress) {
  if (!address) {
    return ""
  }

  let ret = ""

  if (address.address_1) {
    ret += ` ${address.address_1}`
  }

  if (address.address_2) {
    ret += `, ${address.address_2}`
  }

  if (address.postal_code) {
    ret += `, ${address.postal_code} ${address.city}`
  }

  if (address.country_code) {
    ret += `, ${address.country_code.toUpperCase()}`
  }

  return ret
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
              <button
                onClick={handleEdit}
                className="text-primary underline-offset-4 hover:underline"
                data-testid="edit-delivery-button"
              >
                แก้ไข
              </button>
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
              <div className="pb-8 md:pt-0 pt-2">
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
                    className="block"
                  >
                    <RadioGroupItem
                      value={PICKUP_OPTION_ON}
                      data-testid="delivery-option-radio"
                      className={cn(OPTION_CLASS, {
                        "border-primary": showPickupOptions === PICKUP_OPTION_ON,
                      })}
                    >
                      <span className="flex items-center gap-x-4">
                        <OptionDot />
                        <span className="text-base-regular">
                          รับสินค้าด้วยตนเอง
                        </span>
                      </span>
                      <span className="justify-self-end text-foreground">
                        -
                      </span>
                    </RadioGroupItem>
                  </RadioGroup>
                )}
                <RadioGroup
                  value={shippingMethodId ?? ""}
                  onValueChange={(v) => {
                    if (v) {
                      return handleSetShippingMethod(v, "shipping")
                    }
                  }}
                  className="block"
                >
                  {_shippingMethods?.map((option) => {
                    const isDisabled =
                      option.price_type === "calculated" &&
                      !isLoadingPrices &&
                      typeof calculatedPricesMap[option.id] !== "number"

                    return (
                      <RadioGroupItem
                        key={option.id}
                        value={option.id}
                        data-testid="delivery-option-radio"
                        data-option-id={option.id}
                        disabled={isDisabled}
                        // คง aria-disabled แบบ headless เดิม (Radix ใส่แค่ disabled)
                        aria-disabled={isDisabled || undefined}
                        className={cn(OPTION_CLASS, {
                          "border-primary": option.id === shippingMethodId,
                          "hover:border-input cursor-not-allowed": isDisabled,
                        })}
                      >
                        <span className="flex items-center gap-x-4">
                          <OptionDot />
                          <span className="text-base-regular">
                            {option.name}
                          </span>
                        </span>
                        <span className="justify-self-end text-foreground">
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
                        </span>
                      </RadioGroupItem>
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
                    className="block"
                  >
                    {_pickupMethods?.map((option) => {
                      return (
                        <RadioGroupItem
                          key={option.id}
                          value={option.id}
                          disabled={option.insufficient_inventory}
                          aria-disabled={option.insufficient_inventory || undefined}
                          data-testid="delivery-option-radio"
                          className={cn(OPTION_CLASS, {
                            "border-primary": option.id === shippingMethodId,
                            "hover:border-input cursor-not-allowed":
                              option.insufficient_inventory,
                          })}
                        >
                          <span className="flex items-start gap-x-4">
                            <OptionDot />
                            <span className="flex flex-col">
                              <span className="text-base-regular">
                                {option.name}
                              </span>
                              <span className="text-base-regular text-muted-foreground">
                                {formatAddress(
                                  (option as unknown as { service_zone?: { fulfillment_set?: { location?: { address: HttpTypes.StoreCartAddress } } } }).service_zone?.fulfillment_set?.location
                                    ?.address as HttpTypes.StoreCartAddress
                                )}
                              </span>
                            </span>
                          </span>
                          <span className="justify-self-end text-foreground">
                            {convertToLocale({
                              amount: option.amount!,
                              currency_code: cart?.currency_code,
                            })}
                          </span>
                        </RadioGroupItem>
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
              size="lg"
              className="mt"
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
          <div className="text-small-regular">
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
