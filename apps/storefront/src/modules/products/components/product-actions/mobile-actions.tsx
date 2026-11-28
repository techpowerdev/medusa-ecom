import React, { useMemo } from "react"

import { Button } from "@/components/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

import useToggleState from "@lib/hooks/use-toggle-state"
import ErrorMessage from "@modules/checkout/components/error-message"
import ChevronDown from "@modules/common/icons/chevron-down"
import X from "@modules/common/icons/x"

import { getProductPrice } from "@lib/util/get-product-price"
import OptionSelect from "./option-select"
import { HttpTypes } from "@medusajs/types"
import { isSimpleProduct } from "@lib/util/product"
import type { FlashOffer } from "@lib/util/flash-sale"
import { FlashPrice } from "../flash-sale"

type MobileActionsProps = {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  options: Record<string, string | undefined>
  updateOptions: (title: string, value: string) => void
  inStock?: boolean
  /** CORE-27 (กฎข้อ 83c): ตัวเลือกที่เลือกตรงกับ variant — disable ปุ่มเหมือนฟอร์มหลัก */
  isValidVariant?: boolean
  handleAddToCart: () => void
  isAdding?: boolean
  show: boolean
  optionsDisabled: boolean
  /** FS-13 (กฎข้อ 18): ราคา flash ของ variant ที่เลือก — แสดงแทนราคาปกติเมื่อแคมเปญยังไม่ sold out */
  flashOffer?: FlashOffer | null
  /** FS-15 (กฎข้อ 20a): จำนวนที่เลือกเกิน remaining_units ของแคมเปญ flash — disable ปุ่มเหมือนฟอร์มหลัก */
  qtyExceeded?: boolean
  /** qa #134 D-1: ข้อความเมื่อเพิ่มลง cart ไม่สำเร็จ (handler เดียวกับฟอร์มหลัก) */
  error?: string | null
  /** FS-19 (กฎข้อ 24a): ข้อมูล flash ยังไม่ตอบ — ปุ่มรอแบบเดียวกับ `add-product-button` (กฎข้อ 21a) */
  flashLoading?: boolean
}

const MobileActions: React.FC<MobileActionsProps> = ({
  product,
  variant,
  options,
  updateOptions,
  inStock,
  isValidVariant,
  handleAddToCart,
  isAdding,
  show,
  optionsDisabled,
  flashOffer,
  qtyExceeded,
  error,
  flashLoading,
}) => {
  const { state, open, close } = useToggleState()

  const price = getProductPrice({
    product: product,
    variantId: variant?.id,
  })

  const selectedPrice = useMemo(() => {
    if (!price) {
      return null
    }
    const { variantPrice, cheapestPrice } = price

    return variantPrice || cheapestPrice || null
  }, [price])

  const isSimple = isSimpleProduct(product)

  return (
    <Sheet open={state} onOpenChange={(next) => (next ? open() : close())}>
      <div
        className={cn("lg:hidden inset-x-0 bottom-0 fixed z-50", {
          "pointer-events-none": !show,
        })}
      >
        {/* FS-19 (กฎข้อ 24b): จางเฉพาะตอนแสดง — ซ่อนด้วยการ unmount ทันที ไม่มี leave transition ที่จางทับปุ่มหลัก */}
        {/* SFUI-3b (spec 09 กฎ 4c): `Transition appear` → `animate-in fade-in duration-300` ของ tw-animate-css (จบที่ opacity 1) */}
        {show && (
          <div
            className="animate-in fade-in duration-300 bg-white flex flex-col gap-y-3 justify-center items-center text-base leading-6 font-normal p-4 h-full w-full border-t border-gray-200"
            data-testid="mobile-actions"
          >
            <div className="flex items-center gap-x-2">
              <span data-testid="mobile-title">{product.title}</span>
              <span>—</span>
              {flashOffer && !flashOffer.sale.sold_out ? (
                <FlashPrice price={flashOffer.price} />
              ) : selectedPrice ? (
                <div className="flex items-end gap-x-2 text-foreground">
                  {selectedPrice.price_type === "sale" && (
                    <p>
                      <span className="line-through text-xs leading-5 font-normal">
                        {selectedPrice.original_price}
                      </span>
                    </p>
                  )}
                  <span
                    className={cn({
                      "text-primary underline-offset-4":
                        selectedPrice.price_type === "sale",
                    })}
                  >
                    {selectedPrice.calculated_price}
                  </span>
                </div>
              ) : (
                <div></div>
              )}
            </div>
            <div
              className={cn("grid grid-cols-2 w-full gap-x-4", {
                "grid-cols-1!": isSimple,
              })}
            >
              {!isSimple && (
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    data-testid="mobile-actions-button"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>
                        {variant
                          ? Object.values(options).join(" / ")
                          : "เลือกตัวเลือก"}
                      </span>
                      <ChevronDown />
                    </div>
                  </Button>
                </SheetTrigger>
              )}
              <Button
                type="button"
                onClick={handleAddToCart}
                // CORE-27 (กฎข้อ 83c): เงื่อนไขชุดเดียวกับ `add-product-button`
                disabled={
                  !inStock ||
                  !variant ||
                  !isValidVariant ||
                  // = `!!disabled || isAdding` ของ ProductActions
                  optionsDisabled ||
                  !!isAdding ||
                  !!qtyExceeded ||
                  !!flashLoading
                }
                aria-busy={flashLoading}
                className="w-full"
                isLoading={isAdding}
                data-testid="mobile-cart-button"
              >
                {!variant
                  ? "เลือกตัวเลือกสินค้า"
                  : !inStock
                  ? "สินค้าหมด"
                  : "เพิ่มลงตะกร้า"}
              </Button>
            </div>
            {/* SFUI-21e (spec 09 กฎ 74 (a)): error ของการกระทำ "เพิ่มลงตะกร้า" = Alert ผ่าน ErrorMessage */}
            <ErrorMessage error={error} data-testid="mobile-add-to-cart-error" />
          </div>
        )}
      </div>
      {/* SFUI-3b (spec 09 กฎ 4c): Sheet แทนเฉพาะ Dialog ของ `mobile-actions-modal` — ไม่ใช่แถบ `mobile-actions` */}
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="gap-y-3 text-left"
        data-testid="mobile-actions-modal"
      >
        <div className="w-full flex items-center justify-between px-6 pt-6">
          <SheetTitle>ตัวเลือกสินค้า</SheetTitle>
          {/* SFUI-21a (spec 09 กฎ 76): ปุ่มปิด = Close asChild → Button ghost icon ขนาด default ของ shadcn (icon X size-4) */}
          <SheetClose asChild>
            <Button variant="ghost" size="icon" aria-label="ปิด" data-testid="close-modal-button">
              <X />
            </Button>
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">
          เลือกตัวเลือกของ {product.title} ก่อนเพิ่มลงตะกร้า
        </SheetDescription>
        <div className="px-6 pb-12">
          {(product.variants?.length ?? 0) > 1 && (
            <div className="flex flex-col gap-y-6">
              {(product.options || []).map((option) => {
                return (
                  <div key={option.id}>
                    <OptionSelect
                      option={option}
                      current={options[option.id]}
                      updateOption={updateOptions}
                      title={option.title ?? ""}
                      name={`mobile-options[${option.id}]`}
                      disabled={optionsDisabled}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default MobileActions
