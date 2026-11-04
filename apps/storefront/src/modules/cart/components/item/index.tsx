"use client"

import { Table, Text, clx } from "@modules/common/components/ui"
import { updateLineItem } from "@lib/data/cart"
import { actionErrorMessage, settleAction } from "@lib/util/action-result"
import { cartQuantityOptions } from "@lib/util/cart-quantity-options"
import { HttpTypes } from "@medusajs/types"
import CartItemSelect from "@modules/cart/components/cart-item-select"
import ErrorMessage from "@modules/checkout/components/error-message"
import CartFlashExceedsRemaining from "@modules/cart/components/flash-exceeds-remaining"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Spinner from "@modules/common/icons/spinner"
import Thumbnail from "@modules/products/components/thumbnail"
import { useState } from "react"

const UPDATE_QUANTITY_FAILED = "แก้ไขจำนวนสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"

/** CORE-4i (spec 01 กฎข้อ 72): แก้จำนวนแล้วคืนข้อความ error ที่จะแสดง (null = สำเร็จ); action ที่ reject เอง → fallback */
export const changeLineQuantity = async (lineId: string, quantity: number): Promise<string | null> => {
  const result = await settleAction(updateLineItem({ lineId, quantity }))
  return "error" in result ? actionErrorMessage(result.error, UPDATE_QUANTITY_FAILED) : null
}

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "full" | "preview"
  currencyCode: string
  /** FS-15 (กฎข้อ 20b): remaining_units เมื่อจำนวนของ line นี้เกินโควตา flash */
  flashRemaining?: number
}

const Item = ({
  item,
  type = "full",
  currencyCode,
  flashRemaining,
}: ItemProps) => {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changeQuantity = async (quantity: number) => {
    setError(null)
    setUpdating(true)

    setError(await changeLineQuantity(item.id, quantity))
    setUpdating(false)
  }

  // CORE-47 (กฎข้อ 105): /cart < small แต่ละ line เป็นการ์ด — render ครั้งเดียว `tr` เป็น grid 3 คอลัมน์ (รูป | ชื่อ/จำนวน | รวม)
  // แล้ว `td` เป็น block: รูป row-span 2 ซ้าย, ชื่อ + ตัวเลือก col-span 2 ใช้ความกว้างที่เหลือ, บรรทัดล่าง = ปุ่มลบ/จำนวน + รวมชิดขวา
  // class ทั้งหมดอยู่ใต้ `type === "full"` และเป็น `max-small:` (≥ small ไม่มี class ใหม่ → ตารางเดิมทุกพิกเซล; preview เท่าเดิม)
  const card = type === "full"

  return (
    <Table.Row
      className={clx("w-full", {
        "max-small:grid max-small:grid-cols-[auto_minmax(0,1fr)_auto] max-small:items-center":
          card,
      })}
      data-testid="product-row"
    >
      {/* CORE-42 (กฎข้อ 100a): < small ลด padding ของช่องรูป/ชื่อสินค้า/จำนวน ให้คอลัมน์ "รวม" อยู่ในจอ 375 (รวมยอดหลักหมื่นมีทศนิยม — qa #278 D-1) — ≥ small คงเดิม */}
      <Table.Cell
        className={clx("!pl-0 p-4 pr-2 small:pr-4 w-24", {
          "max-small:block max-small:w-auto max-small:row-span-2": card,
        })}
      >
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          className={clx("flex", {
            "w-16": type === "preview",
            "small:w-24 w-12": type === "full",
          })}
        >
          <Thumbnail
            thumbnail={item.thumbnail}
            images={item.variant?.product?.images}
            size="square"
          />
        </LocalizedClientLink>
      </Table.Cell>

      <Table.Cell
        className={clx("text-left px-2 small:px-4", {
          "max-small:block max-small:col-span-2 max-small:min-w-0 max-small:break-words":
            card,
        })}
      >
        <Text
          className="txt-medium-plus text-ui-fg-base"
          data-testid="product-title"
        >
          {item.product_title}
        </Text>
        <LineItemOptions variant={item.variant} data-testid="product-variant" />
      </Table.Cell>

      {type === "full" && (
        <Table.Cell
          className={clx("px-2 small:px-4", {
            "max-small:block max-small:min-w-0 max-small:pt-0": card,
          })}
        >
          {/* qa #142 D-2 (CORE-19c): `!contents` ให้ปุ่มลบและข้อความ error เป็น flex item ของแถวนี้ — error ขึ้นบรรทัดใหม่กว้างเต็ม w-28 */}
          <div className="flex flex-wrap gap-2 items-center w-28">
            <DeleteButton
              id={item.id}
              className="!contents"
              data-testid="product-delete-button"
            />
            <CartItemSelect
              value={item.quantity}
              onChange={(value) => changeQuantity(parseInt(value.target.value))}
              className="w-14 h-10 p-4"
              data-testid="product-select-button"
            >
              {/* CORE-44 (กฎข้อ 102b): 1..10 + จำนวนจริงเมื่อ > 10 — stock ตรวจโดย Medusa ตอนแก้จำนวน */}
              {cartQuantityOptions(item.quantity).map((quantity) => (
                <option value={quantity} key={quantity}>
                  {quantity}
                </option>
              ))}
            </CartItemSelect>
            {updating && <Spinner />}
          </div>
          <ErrorMessage error={error} data-testid="product-error-message" />
          <CartFlashExceedsRemaining remaining={flashRemaining} />
        </Table.Cell>
      )}

      {type === "full" && (
        <Table.Cell className="hidden small:table-cell">
          <LineItemUnitPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </Table.Cell>
      )}

      <Table.Cell
        className={clx("!pr-0", {
          "max-small:block max-small:pl-2 max-small:pt-0 max-small:whitespace-nowrap":
            card,
        })}
      >
        <span
          className={clx("!pr-0", {
            "flex flex-col items-end h-full justify-center": type === "preview",
          })}
        >
          {type === "preview" && (
            <span className="flex gap-x-1 ">
              <Text className="text-ui-fg-muted">{item.quantity}x </Text>
              <LineItemUnitPrice
                item={item}
                style="tight"
                currencyCode={currencyCode}
              />
            </span>
          )}
          <LineItemPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
      </Table.Cell>
    </Table.Row>
  )
}

export default Item
