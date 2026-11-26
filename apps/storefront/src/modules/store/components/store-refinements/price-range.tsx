"use client"

import { useEffect, useState } from "react"
import { useRange } from "react-instantsearch"

import { Slider } from "@/components/slider"
import { indexedCurrency, priceAttribute } from "@lib/search-client"
import { convertToLocale } from "@lib/util/money"

/**
 * Price filter over the region currency's `min_price_*` field, which is
 * declared `facetable({ types: ["stats"] })` — the stats facet is what
 * supplies the slider's bounds. Refines on release rather than per pixel.
 */
const PriceRange = ({ currencyCode }: { currencyCode: string }) => {
  const { start, range, canRefine, refine } = useRange({
    attribute: priceAttribute("min_price", currencyCode),
  })
  const currency = indexedCurrency(currencyCode)
  // CORE-15 (AC-69): ใช้ convertToLocale (th-TH, ฿) เหมือนราคาบนการ์ด — ไม่ขึ้นกับ locale ของ browser
  // ปัดเป็นบาทเต็มก่อน → ไม่มีสตางค์ในป้าย (เช่น ฿590)
  const format = (amount: number) =>
    convertToLocale({ amount: Math.round(amount), currency_code: currency })

  const min = Math.floor(range.min ?? 0)
  const max = Math.ceil(range.max ?? 0)

  // `start` holds ±Infinity for an unset bound, so fall back to the extremes.
  const from = Number.isFinite(start[0]) ? (start[0] as number) : min
  const to = Number.isFinite(start[1]) ? (start[1] as number) : max

  const [value, setValue] = useState<number[]>([from, to])

  // Follow the refinement when it changes elsewhere — clearing all filters, or
  // a bound arriving from the URL on load.
  useEffect(() => {
    setValue([from, to])
  }, [from, to])

  // No stats yet, or every product costs the same: nothing to slide between.
  if (!canRefine || min >= max) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-4">
      <span className="text-sm font-medium leading-5 text-muted-foreground">
        ราคา
      </span>

      <div className="flex flex-col gap-y-3 pr-6">
        <Slider
          className="h-5"
          value={value}
          min={min}
          max={max}
          step={1}
          minStepsBetweenThumbs={0}
          onValueChange={setValue}
          // Only refine when the thumb is released, so dragging doesn't fire a
          // search per pixel.
          onValueCommit={(committed) => refine([committed[0], committed[1]])}
          aria-label="ช่วงราคา"
          thumbLabels={["ราคาต่ำสุด", "ราคาสูงสุด"]}
          data-testid="price-range"
        />

        <div className="flex items-center justify-between">
          <span
            className="text-xs leading-5 font-normal text-muted-foreground"
            data-testid="price-range-min"
          >
            {format(value[0])}
          </span>
          <span
            className="text-xs leading-5 font-normal text-muted-foreground"
            data-testid="price-range-max"
          >
            {format(value[1])}
          </span>
        </div>
      </div>
    </div>
  )
}

export default PriceRange
