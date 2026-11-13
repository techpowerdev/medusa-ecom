"use client"

import { isDigitalOnlyCart } from "@lib/util/digital-checkout"
import { convertToLocale } from "@lib/util/money"
import React from "react"

type CartTotalsProps = {
  totals: {
    total?: number | null
    tax_total?: number | null
    currency_code: string
    original_item_total?: number | null
    original_shipping_total?: number | null
    discount_total?: number | null
    items?: { requires_shipping?: boolean | null }[] | null
  }
}

const CartTotals: React.FC<CartTotalsProps> = ({ totals }) => {
  const {
    currency_code,
    total,
    tax_total,
    original_item_total,
    original_shipping_total,
    discount_total,
  } = totals
  // CORE-57 (spec 01 กฎข้อ 115): ทุกแถวรวม VAT — original_item_total − discount_total + original_shipping_total = total
  // ไม่ใช้ item_total/shipping_total เพราะหักส่วนลดแล้ว แต่ discount_total รวมส่วนลดเดียวกันอีก (หักซ้ำ)
  // EV-7d (spec 02 กฎข้อ 28a): cart digital-only ไม่มีการจัดส่ง — ไม่แสดงแถวและคำว่าค่าจัดส่ง
  // ยกเว้นยังมีค่าจัดส่งเก็บจริง (ลบสินค้าจัดส่งออกแล้ว Medusa ไม่ลบ shipping method) — ยอดรวมต้องมีแถวอธิบาย
  const noShippingCharge = isDigitalOnlyCart(totals) && !original_shipping_total

  return (
    <div data-testid="cart-totals">
      <div className="flex flex-col gap-y-2 txt-medium text-ui-fg-subtle ">
        <div className="flex items-center justify-between">
          {/* eslint-disable-next-line no-restricted-syntax -- "VAT" เป็นคำย่อที่ลูกค้าไทยใช้ ป้ายตาม Q-C7 ที่ owner ตัดสิน (spec 01 กฎข้อ 115a) */}
          <span>ยอดรวมสินค้า (รวม VAT)</span>
          <span data-testid="cart-subtotal" data-value={original_item_total || 0}>
            {convertToLocale({ amount: original_item_total ?? 0, currency_code })}
          </span>
        </div>
        {!noShippingCharge && (
          <div className="flex items-center justify-between">
            <span>ค่าจัดส่ง</span>
            <span
              data-testid="cart-shipping"
              data-value={original_shipping_total || 0}
            >
              {convertToLocale({
                amount: original_shipping_total ?? 0,
                currency_code,
              })}
            </span>
          </div>
        )}
        {!!discount_total && (
          <div className="flex items-center justify-between">
            <span>ส่วนลด</span>
            <span
              className="text-ui-fg-interactive"
              data-testid="cart-discount"
              data-value={discount_total || 0}
            >
              -{" "}
              {convertToLocale({
                amount: discount_total ?? 0,
                currency_code,
              })}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          {/* eslint-disable-next-line no-restricted-syntax -- "VAT" เป็นคำย่อที่ลูกค้าไทยใช้ ป้ายตาม Q-C7 ที่ owner ตัดสิน (spec 01 กฎข้อ 115a) */}
          <span className="flex gap-x-1 items-center ">รวม VAT แล้ว</span>
          <span data-testid="cart-taxes" data-value={tax_total || 0}>
            {convertToLocale({ amount: tax_total ?? 0, currency_code })}
          </span>
        </div>
      </div>
      <div className="h-px w-full border-b border-gray-200 my-4" />
      <div className="flex items-center justify-between text-ui-fg-base mb-2 txt-medium ">
        <span>ยอดรวมทั้งสิ้น</span>
        <span
          className="txt-xlarge-plus"
          data-testid="cart-total"
          data-value={total || 0}
        >
          {convertToLocale({ amount: total ?? 0, currency_code })}
        </span>
      </div>
      <div className="h-px w-full border-b border-gray-200 mt-4" />
    </div>
  )
}

export default CartTotals
