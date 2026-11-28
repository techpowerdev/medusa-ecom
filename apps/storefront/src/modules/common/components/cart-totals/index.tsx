"use client"

import { isDigitalOnlyCart } from "@lib/util/digital-checkout"
import { convertToLocale } from "@lib/util/money"
import { PricedDocument, priceBreakdown } from "@lib/util/price-breakdown"
import React from "react"

type CartTotalsProps = {
  totals: PricedDocument & {
    currency_code: string
    items?: (NonNullable<PricedDocument["items"]>[number] & { requires_shipping?: boolean | null })[] | null
  }
}

// SFUI-24a (spec 01 กฎข้อ 158 — แทนกฎข้อ 81b, 115, 118, 120): สรุปยอดตัวเดียวของ /cart, checkout, order-completed และ
// รายละเอียดคำสั่งซื้อ — รวมค่าสินค้า + ค่าจัดส่ง − ส่วนลด (โค้ด) + ภาษีมูลค่าเพิ่ม (เฉพาะรายการที่ไม่รวม VAT) = ยอดรวมทั้งสิ้น (`total` ของ Medusa)
// data-value = ค่าดิบก่อนปัด; ส่วนลดอัตโนมัติ (flash/ซื้อกลุ่ม) อยู่ในรวมค่าสินค้าแล้ว ไม่มีแถวของตัวเอง
const CartTotals: React.FC<CartTotalsProps> = ({ totals }) => {
  const { currency_code } = totals
  const { subtotal, shipping, discount, tax, total, codes, taxRate, hasShippingCharge } = priceBreakdown(totals)
  const money = (amount: number) => convertToLocale({ amount, currency_code })
  // EV-7d (spec 02 กฎข้อ 28a): cart digital-only ไม่มีการจัดส่ง — ไม่แสดงแถวและคำว่าค่าจัดส่ง
  // ยกเว้นยังมีค่าจัดส่งเก็บจริง (ลบสินค้าจัดส่งออกแล้ว Medusa ไม่ลบ shipping method) — ยอดรวมต้องมีแถวอธิบาย
  const noShippingCharge = isDigitalOnlyCart(totals) && !hasShippingCharge

  return (
    <div data-testid="cart-totals">
      <div className="flex flex-col gap-y-2 text-sm leading-[1.4rem] text-muted-foreground ">
        {/* ป้ายยาวตัดบรรทัดได้ (min-w-0) แต่จำนวนเงินอยู่บรรทัดเดียว (whitespace-nowrap) ที่ 375 */}
        <div className="flex items-center justify-between gap-x-2">
          <span className="min-w-0" data-testid="cart-subtotal-label">
            รวมค่าสินค้า
          </span>
          <span className="whitespace-nowrap" data-testid="cart-subtotal" data-value={subtotal}>
            {money(subtotal)}
          </span>
        </div>
        {!noShippingCharge && (
          <div className="flex items-center justify-between">
            <span>ค่าจัดส่ง</span>
            <span data-testid="cart-shipping" data-value={shipping}>
              {money(shipping)}
            </span>
          </div>
        )}
        {discount > 0.005 && (
          <div className="flex items-center justify-between gap-x-2">
            <span className="min-w-0" data-testid="cart-discount-label">
              {codes.length ? `ส่วนลด (โค้ด ${codes.join(", ")})` : "ส่วนลด"}
            </span>
            <span className="whitespace-nowrap text-primary" data-testid="cart-discount" data-value={discount}>
              - {money(discount)}
            </span>
          </div>
        )}
        {tax > 0.005 && (
          <div className="flex items-center justify-between">
            <span data-testid="cart-taxes-label">
              {taxRate === null ? "ภาษีมูลค่าเพิ่ม" : `ภาษีมูลค่าเพิ่ม ${taxRate}%`}
            </span>
            <span data-testid="cart-taxes" data-value={tax}>
              {money(tax)}
            </span>
          </div>
        )}
      </div>
      <div className="h-px w-full border-b border-gray-200 my-4" />
      <div className="flex items-center justify-between text-foreground mb-2 text-sm leading-[1.4rem] ">
        <span>ยอดรวมทั้งสิ้น</span>
        <span className="text-lg font-medium" data-testid="cart-total" data-value={total}>
          {money(total)}
        </span>
      </div>
      <div className="h-px w-full border-b border-gray-200 mt-4" />
    </div>
  )
}

export default CartTotals
