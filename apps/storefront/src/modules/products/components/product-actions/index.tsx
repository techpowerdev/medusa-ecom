"use client"

import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import { notifyCartUpdated } from "@lib/util/cart-events"
import { friendlyErrorMessage } from "@lib/util/error-message"
import { isVariantInStock } from "@lib/util/inventory"
import {
  PDP_QUANTITY_OPTIONS,
  clampLineItemQuantity,
} from "@lib/util/pending-add-to-cart"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { findVariantByOptions, optionsAsKeymap } from "@lib/util/product-variant-options"
import { useParams, usePathname } from "next/navigation"
import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import ProductPrice from "../product-price"
import FlashSale, { useFlashOffer } from "../flash-sale"
import FlashQtyExceedsRemaining from "../flash-sale/qty-exceeds-remaining"
import { flashQtyExceeded } from "@lib/util/flash-sale"
import MobileActions from "./mobile-actions"
import { useRouter } from "next/navigation"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const ADD_TO_CART_FAILED =
  "เพิ่มสินค้าลงตะกร้าไม่สำเร็จ จำนวนที่เลือกอาจเกินสินค้าคงเหลือหรือสินค้าหมดแล้ว"

const getDefaultVariant = (product: HttpTypes.StoreProduct) =>
  product.variants?.find(isVariantInStock) ?? product.variants?.[0]

export default function ProductActions({
  product,
  region,
  disabled,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  // Preselected on the server so the form posts a valid variant without JavaScript.
  // The page is statically rendered, so `?v_id=` is applied after hydration.
  const [options, setOptions] = useState<Record<string, string | undefined>>(
    () => optionsAsKeymap(getDefaultVariant(product)?.options ?? null) ?? {}
  )
  const [isUrlVariantApplied, setIsUrlVariantApplied] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  // CORE-24 (กฎข้อ 59): จำนวนที่เลือก — ฟอร์ม no-JS ส่งค่าเดียวกันผ่าน `<select name="quantity">`
  const [quantity, setQuantity] = useState(1)
  // qa #134 D-1: addToCart ล้ม (เช่นจำนวนเกิน stock) → แสดงข้อความไทย และปลด isAdding ให้ปุ่ม/ตัวเลือกใช้ต่อได้
  const [addError, setAddError] = useState<string | null>(null)
  const countryCode = useParams().countryCode as string

  const selectedVariant = useMemo(
    () => findVariantByOptions(product.variants, options),
    [product.variants, options]
  )

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  //check if the selected options produce a valid variant
  const isValidVariant = !!selectedVariant

  // CORE-25 (กฎข้อ 78): ใช้ `v_id` จาก URL ครั้งเดียวต่อสินค้า — RSC refresh (เช่นหลัง add-to-cart) ส่ง `product`
  // object ใหม่มาได้ขณะที่ URL ยังเป็น `v_id` ของตัวเลือกก่อนหน้า (router.replace ยังไม่ commit) ถ้าใช้ซ้ำจะรีเซ็ตตัวเลือกของลูกค้า
  const urlVariantAppliedFor = useRef<string | null>(null)

  useEffect(() => {
    if (urlVariantAppliedFor.current === product.id) {
      return
    }
    urlVariantAppliedFor.current = product.id

    const variantId = new URLSearchParams(window.location.search).get("v_id")
    const variant = product.variants?.find((v) => v.id === variantId)
    if (variant) {
      setOptions(optionsAsKeymap(variant.options) ?? {})
    }
    setIsUrlVariantApplied(true)
  }, [product.id, product.variants])

  useEffect(() => {
    if (!isUrlVariantApplied) {
      return
    }

    const params = new URLSearchParams(window.location.search)
    const value = isValidVariant ? selectedVariant?.id : null

    if (params.get("v_id") === value) {
      return
    }

    if (value) {
      params.set("v_id", value)
    } else {
      params.delete("v_id")
    }

    router.replace(pathname + "?" + params.toString())
  }, [selectedVariant, isValidVariant, isUrlVariantApplied])

  const inStock = useMemo(
    () => isVariantInStock(selectedVariant),
    [selectedVariant]
  )

  const flash = useFlashOffer(
    product,
    region,
    isValidVariant ? selectedVariant : undefined
  )
  // FS-13 (กฎข้อ 18): แคมเปญ flash ขายครบ cap แล้ว → checkout จะล้ม FLASH_SOLD_OUT จึงไม่ให้เพิ่มลง cart
  const canBuy = inStock && !flash.offer?.sale.sold_out
  // FS-15 (กฎข้อ 20a): จำนวนเกิน remaining_units ของแคมเปญ → complete ล้มแน่นอน จึงไม่ให้เพิ่มจนกว่าจะลดจำนวน
  const flashRemaining = flashQtyExceeded(flash.offer, quantity)

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  // CORE-27 (กฎข้อ 83): กันยิงซ้อนแบบ synchronous — `isAdding` เป็น state จึงยังไม่อัปเดตในคลิกที่สองของ tick เดียว
  const addInFlight = useRef(false)

  // add the selected variant to the cart
  const handleAddToCart = async () => {
    if (!selectedVariant?.id || addInFlight.current) return null

    addInFlight.current = true
    setIsAdding(true)
    setAddError(null)

    try {
      await addToCart({
        variantId: selectedVariant.id,
        quantity,
        countryCode,
      })
      notifyCartUpdated()
    } catch (error) {
      setAddError(friendlyErrorMessage(error, ADD_TO_CART_FAILED))
    } finally {
      addInFlight.current = false
      setIsAdding(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    handleAddToCart()
  }

  return (
    <>
      <div className="flex flex-col gap-y-2" ref={actionsRef}>
        <form
          method="post"
          action={`/${countryCode}/cart/add`}
          onSubmit={handleSubmit}
          className="flex flex-col gap-y-2"
          {...{
            toolname: "add_to_cart",
            tooldescription:
              "Add the selected product variant to the shopping cart",
          }}
        >
          <input type="hidden" name="product_id" value={product.id} />
          <input
            type="hidden"
            name="variant_id"
            value={isValidVariant ? selectedVariant?.id ?? "" : ""}
          />
          <div>
            {(product.variants?.length ?? 0) > 1 && (
              <div className="flex flex-col gap-y-4">
                {(product.options || []).map((option) => {
                  return (
                    <div key={option.id}>
                      <OptionSelect
                        option={option}
                        current={options[option.id]}
                        updateOption={setOptionValue}
                        title={option.title ?? ""}
                        name={`options[${option.id}]`}
                        data-testid="product-options"
                        disabled={!!disabled || isAdding}
                      />
                    </div>
                  )
                })}
                <Divider />
              </div>
            )}
          </div>

          <ProductPrice
            product={product}
            variant={selectedVariant}
            struck={!!flash.offer && !flash.offer.sale.sold_out}
          />

          <FlashSale {...flash} />

          <label className="flex items-center gap-x-3 text-small-regular">
            <span>จำนวน</span>
            <select
              name="quantity"
              value={quantity}
              onChange={(e) =>
                setQuantity(clampLineItemQuantity(e.target.value))
              }
              disabled={
                !canBuy ||
                !selectedVariant ||
                !isValidVariant ||
                !!disabled ||
                isAdding
              }
              className="border border-ui-border-base bg-ui-bg-subtle rounded-md px-3 py-1.5"
              data-testid="product-quantity-select"
            >
              {PDP_QUANTITY_OPTIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>

          <FlashQtyExceedsRemaining remaining={flashRemaining} />

          {selectedVariant && isValidVariant && (
            <p
              className="text-small-regular text-ui-fg-subtle"
              data-testid="product-availability"
            >
              {canBuy ? "มีสินค้า" : "สินค้าหมด"}
            </p>
          )}

          <Button
            type="submit"
            disabled={
              !canBuy ||
              !selectedVariant ||
              !!disabled ||
              isAdding ||
              !isValidVariant ||
              flashRemaining != null ||
              flash.loading
            }
            // FS-16 (กฎข้อ 21a): รอข้อมูล flash (sold_out/remaining) ก่อนให้กด
            aria-busy={flash.loading}
            variant="primary"
            className="w-full h-10"
            isLoading={isAdding}
            data-testid="add-product-button"
          >
            {!selectedVariant
              ? "เลือกตัวเลือกสินค้า"
              : !canBuy || !isValidVariant
              ? "สินค้าหมด"
              : "เพิ่มลงตะกร้า"}
          </Button>
          {addError && (
            <p
              className="text-small-regular text-ui-fg-error"
              role="alert"
              data-testid="add-to-cart-error"
            >
              {addError}
            </p>
          )}
        </form>
        <MobileActions
          product={product}
          variant={selectedVariant}
          options={options}
          updateOptions={setOptionValue}
          inStock={canBuy}
          isValidVariant={!!isValidVariant}
          qtyExceeded={flashRemaining != null}
          flashOffer={flash.offer}
          flashLoading={flash.loading}
          handleAddToCart={handleAddToCart}
          isAdding={isAdding}
          // CORE-25 (กฎข้อ 78): แสดงเฉพาะเมื่อรู้แน่ว่าฟอร์มหลักพ้นจอ — SSR/ก่อน hydrate แถบเคยทับปุ่มเพิ่มลงตะกร้าหลัก
          show={inView === false}
          optionsDisabled={!!disabled || isAdding}
          error={addError}
        />
      </div>
    </>
  )
}
