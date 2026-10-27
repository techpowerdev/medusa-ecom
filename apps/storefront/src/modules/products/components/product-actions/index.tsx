"use client"

import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import { notifyCartUpdated } from "@lib/util/cart-events"
import { isVariantInStock } from "@lib/util/inventory"
import {
  PDP_QUANTITY_OPTIONS,
  clampLineItemQuantity,
} from "@lib/util/pending-add-to-cart"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { isEqual } from "lodash"
import { useParams, usePathname } from "next/navigation"
import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import ProductPrice from "../product-price"
import FlashSale, { useFlashOffer } from "../flash-sale"
import MobileActions from "./mobile-actions"
import { useRouter } from "next/navigation"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt) => {
    if (varopt.option_id) acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

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
  const countryCode = useParams().countryCode as string

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  //check if the selected options produce a valid variant
  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  useEffect(() => {
    const variantId = new URLSearchParams(window.location.search).get("v_id")
    const variant = product.variants?.find((v) => v.id === variantId)
    if (variant) {
      setOptions(optionsAsKeymap(variant.options) ?? {})
    }
    setIsUrlVariantApplied(true)
  }, [product.variants])

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

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  // add the selected variant to the cart
  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    setIsAdding(true)

    await addToCart({
      variantId: selectedVariant.id,
      quantity,
      countryCode,
    })
    notifyCartUpdated()

    setIsAdding(false)
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

          <ProductPrice product={product} variant={selectedVariant} />

          <FlashSale {...flash} />

          <label className="flex items-center gap-x-3 text-small-regular">
            <span>จำนวน</span>
            <select
              name="quantity"
              value={quantity}
              onChange={(e) =>
                setQuantity(clampLineItemQuantity(e.target.value))
              }
              disabled={!!disabled || isAdding}
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
              !isValidVariant
            }
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
        </form>
        <MobileActions
          product={product}
          variant={selectedVariant}
          options={options}
          updateOptions={setOptionValue}
          inStock={canBuy}
          flashOffer={flash.offer}
          handleAddToCart={handleAddToCart}
          isAdding={isAdding}
          show={!inView}
          optionsDisabled={!!disabled || isAdding}
        />
      </div>
    </>
  )
}
