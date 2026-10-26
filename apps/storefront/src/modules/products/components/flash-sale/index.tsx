"use client"

import { getActiveFlashSales } from "@lib/data/flash-sales"
import {
  type ActiveFlashSales,
  countdownLabel,
  flashOfferForVariant,
} from "@lib/util/flash-sale"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { useEffect, useState } from "react"

type FlashSaleProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  variant?: HttpTypes.StoreProductVariant
}

/**
 * FS-6 (spec 03, AC-4, AC-13 e, กฎข้อ 4): banner แคมเปญ + countdown "สิ้นสุดใน" + ราคา flash/ราคาขีดฆ่า
 * + "สินค้าหมด"/"เหลือ N ชิ้น" บน PDP — PDP เป็น static (revalidate 60) จึงดึงข้อมูลฝั่ง client ทุกครั้งที่เปิดหน้า
 * ราคามาจาก Promotion module ของ Medusa (FS-4) ยอดจริงคือยอดใน cart (กฎข้อ 14)
 */
export default function FlashSale({
  product,
  region,
  variant,
}: FlashSaleProps) {
  const [data, setData] = useState<ActiveFlashSales | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    const ids = (product.variants ?? []).map((v) => v.id)
    getActiveFlashSales(region.id, ids).then((res) => alive && setData(res))
    return () => {
      alive = false
    }
  }, [product.variants, region.id])

  const offer = flashOfferForVariant(data, variant?.id, now)
  const ticking = !!offer

  // เดินนาฬิกาเฉพาะตอนมี offer; เลย ends_at → offer เป็น null แล้วหยุดเอง (ไม่ต้องโหลดหน้าใหม่)
  useEffect(() => {
    if (!ticking) {
      return
    }
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [ticking])

  if (!offer) {
    return null
  }

  const { sale, price } = offer
  const countdown = sale.show_countdown
    ? countdownLabel(sale.ends_at, now)
    : null
  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: price.currency_code })

  return (
    <div
      className="flex flex-col gap-y-2 rounded-rounded border border-ui-fg-interactive p-3"
      data-testid="flash-sale"
    >
      <p
        className="text-base-semi text-ui-fg-interactive"
        data-testid="flash-banner"
      >
        {sale.banner_text || "แฟลชเซล ราคาพิเศษช่วงเวลาจำกัด"}
      </p>
      {countdown && (
        <p className="text-small-regular" data-testid="flash-countdown">
          สิ้นสุดใน <span className="tabular-nums">{countdown}</span>
        </p>
      )}
      {sale.sold_out ? (
        <p
          className="text-base-semi text-ui-fg-error"
          data-testid="flash-sold-out"
        >
          สินค้าหมด
        </p>
      ) : (
        <>
          <p className="flex items-baseline gap-x-2">
            <span
              className="text-xl-semi text-ui-fg-interactive"
              data-testid="flash-price"
            >
              {money(price.flash_price!)}
            </span>
            <span
              className="line-through text-ui-fg-subtle"
              data-testid="flash-original-price"
            >
              {money(price.original_price)}
            </span>
          </p>
          {sale.remaining_units != null && (
            <p className="text-small-regular" data-testid="flash-remaining">
              เหลือ {sale.remaining_units} ชิ้น
            </p>
          )}
        </>
      )}
    </div>
  )
}
