"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldError } from "@/components/ui/field"
import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { updateLineItem } from "@lib/data/cart"
import { actionErrorMessage, settleAction } from "@lib/util/action-result"
import { cartQuantityOptions } from "@lib/util/cart-quantity-options"
import {
  INSUFFICIENT_INVENTORY,
  INSUFFICIENT_INVENTORY_MESSAGE,
} from "@lib/util/insufficient-inventory"
import { HttpTypes } from "@medusajs/types"
import CartFlashExceedsRemaining, {
  CartFlashExceedsCustomerLimit,
} from "@modules/cart/components/flash-exceeds-remaining"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Spinner from "@modules/common/icons/spinner"
import Thumbnail from "@modules/products/components/thumbnail"
import { useState } from "react"

export const UPDATE_QUANTITY_FAILED = "แก้ไขจำนวนสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"

/**
 * CORE-4i (spec 01 กฎข้อ 72): แก้จำนวนแล้วคืนข้อความ error ที่จะแสดง (null = สำเร็จ); action ที่ reject เอง → fallback
 * CORE-48 (กฎข้อ 106): stock ไม่พอ → INSUFFICIENT_INVENTORY_MESSAGE (ไม่ตรวจ stock ฝั่ง storefront เอง)
 */
export const changeLineQuantity = async (lineId: string, quantity: number): Promise<string | null> => {
  const result = await settleAction(updateLineItem({ lineId, quantity }))
  if (!("error" in result)) {
    return null
  }
  return result.error === INSUFFICIENT_INVENTORY
    ? INSUFFICIENT_INVENTORY_MESSAGE
    : actionErrorMessage(result.error, UPDATE_QUANTITY_FAILED)
}

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "full" | "preview"
  currencyCode: string
  /** FS-15 (กฎข้อ 20b): remaining_units เมื่อจำนวนของ line นี้เกินโควตา flash */
  flashRemaining?: number
  /** FS-21 (กฎข้อ 26b): สิทธิ์ flash ที่เหลือของลูกค้า เมื่อจำนวนรวมในแคมเปญเกิน */
  flashCustomerRemaining?: number
}

const Item = ({
  item,
  type = "full",
  currencyCode,
  flashRemaining,
  flashCustomerRemaining,
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
    <TableRow
      className={cn("w-full", {
        "max-small:grid max-small:grid-cols-[auto_minmax(0,1fr)_auto] max-small:items-center":
          card,
      })}
      data-testid="product-row"
    >
      {/* CORE-42 (กฎข้อ 100a): < small ลด padding ของช่องรูป/ชื่อสินค้า/จำนวน ให้คอลัมน์ "รวม" อยู่ในจอ 375 (รวมยอดหลักหมื่นมีทศนิยม — qa #278 D-1) — ≥ small คงเดิม
          SFUI-5c: shadcn TableCell เริ่มที่ p-2 — ทุก cell ใส่ p-4 เดิมของ shim เอง (spec 09 กฎ 21, core-42/47)
          SFUI-6: shadcn TableCell ตั้ง whitespace-nowrap ซึ่ง Table.Cell เดิมไม่มี — ทุก cell ใส่ whitespace-normal ให้ข้อความยาวตัดบรรทัดเท่าเดิม (กฎ 19) */}
      <TableCell
        className={cn("whitespace-normal pl-0! p-4 pr-2 small:pr-4 w-24", {
          "max-small:block max-small:w-auto max-small:row-span-2": card,
        })}
      >
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          className={cn("flex", {
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
      </TableCell>

      <TableCell
        className={cn("whitespace-normal p-4 text-left px-2 small:px-4", {
          "max-small:block max-small:col-span-2 max-small:min-w-0 max-small:break-words":
            card,
        })}
      >
        <p
          className="text-sm leading-[1.4rem] font-medium text-foreground"
          data-testid="product-title"
        >
          {item.product_title}
        </p>
        <LineItemOptions variant={item.variant} data-testid="product-variant" />
      </TableCell>

      {type === "full" && (
        <TableCell
          className={cn("whitespace-normal p-4 px-2 small:px-4", {
            "max-small:block max-small:min-w-0 max-small:pt-0": card,
          })}
        >
          {/* qa #142 D-2 (CORE-19c): `contents!` ให้ปุ่มลบและข้อความ error เป็น flex item ของแถวนี้ — error ขึ้นบรรทัดใหม่กว้างเต็ม w-28 */}
          <div className="flex flex-wrap gap-2 items-center w-28">
            <DeleteButton
              id={item.id}
              className="contents!"
              data-testid="product-delete-button"
            />
            {/* SFUI-16c (spec 09 กฎ 40b, 45; ADR-033): Select ของ shadcn ประกอบตามตัวอย่าง docs — ไม่มี label ที่มองเห็น → ไม่มี Field,
                aria-label ไทย; controlled ด้วย item.quantity (server action ปฏิเสธ → ค่าคงเดิม) และ Radix เรียก onValueChange เฉพาะเมื่อค่าเปลี่ยน
                CORE-44 (กฎข้อ 102b): 1..10 + จำนวนจริงเมื่อ > 10 — stock ตรวจโดย Medusa ตอนแก้จำนวน */}
            <Select
              value={String(item.quantity)}
              onValueChange={(value) => changeQuantity(parseInt(value))}
            >
              <SelectTrigger
                aria-label="จำนวน"
                data-testid="product-select-button"
                data-value={String(item.quantity)}
              >
                <SelectValue placeholder="เลือก...">
                  {item.quantity}
                </SelectValue>
              </SelectTrigger>
              <SelectContent data-testid="product-select-button-options">
                {cartQuantityOptions(item.quantity).map((quantity) => (
                  <SelectItem
                    value={String(quantity)}
                    key={quantity}
                    data-testid="product-select-button-option"
                    data-value={String(quantity)}
                  >
                    {quantity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {updating && <Spinner />}
          </div>
          {/* SFUI-21d (spec 09 กฎ 74 (b)): error ในเซลล์ของแถว = FieldError (inline) */}
          {error && <FieldError data-testid="product-error-message">{error}</FieldError>}
          <CartFlashExceedsRemaining remaining={flashRemaining} />
          <CartFlashExceedsCustomerLimit remaining={flashCustomerRemaining} />
        </TableCell>
      )}

      {type === "full" && (
        <TableCell className="whitespace-normal p-4 hidden small:table-cell">
          <LineItemUnitPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </TableCell>
      )}

      <TableCell
        className={cn("whitespace-normal p-4 pr-0!", {
          "max-small:block max-small:pl-2 max-small:pt-0 max-small:whitespace-nowrap":
            card,
        })}
      >
        <span
          className={cn("pr-0!", {
            "flex flex-col items-end h-full justify-center": type === "preview",
          })}
        >
          {type === "preview" && (
            <span className="flex gap-x-1 ">
              <p className="text-sm leading-[1.4rem] text-muted-foreground">
                <span data-testid="product-quantity">{item.quantity}</span>x{" "}
              </p>
              {/* CORE-66 (spec 01 กฎข้อ 124): preview ชิ้นเดียว ราคาต่อหน่วย = ราคารวม → ไม่แสดงซ้ำ; /cart (type="full") คงเดิม */}
              {item.quantity > 1 && (
                <LineItemUnitPrice
                  item={item}
                  style="tight"
                  currencyCode={currencyCode}
                />
              )}
            </span>
          )}
          <LineItemPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
      </TableCell>
    </TableRow>
  )
}

export default Item
