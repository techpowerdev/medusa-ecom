"use client"

import { X } from "lucide-react"
import { useClearRefinements, useCurrentRefinements } from "react-instantsearch"

import { Button } from "@/components/ui/button"
import { indexedCurrency, priceAttribute } from "@lib/search-client"
import { convertToLocale } from "@lib/util/money"
import {
  CATEGORY_ATTRIBUTE,
  LABELS_ATTRIBUTE,
  OPTION_VALUES_ATTRIBUTE,
} from "./attributes"

type Refinement = ReturnType<
  typeof useCurrentRefinements
>["items"][number]["refinements"][number]

/**
 * What a single refinement reads as on its chip. The raw label is the facet
 * value, which is the option's `Size:M` form for options and a bare `true` for
 * the on-sale toggle — neither says what it filters on out of context.
 */
function refinementLabel(refinement: Refinement, currencyCode: string) {
  const { attribute, label, value, operator } = refinement

  if (attribute === OPTION_VALUES_ATTRIBUTE) {
    const separator = String(value).indexOf(":")

    return separator < 1
      ? label
      : `${String(value).slice(0, separator)}: ${String(value).slice(
          separator + 1
        )}`
  }

  if (attribute === priceAttribute("on_sale", currencyCode)) {
    return "ลดราคา"
  }

  if (attribute === priceAttribute("min_price", currencyCode)) {
    const amount = convertToLocale({
      amount: Number(value),
      currency_code: indexedCurrency(currencyCode),
      maximumFractionDigits: 0,
    })

    return operator === "<=" || operator === "<"
      ? `ไม่เกิน ${amount}`
      : `ตั้งแต่ ${amount}`
  }

  if (attribute === CATEGORY_ATTRIBUTE) {
    return `หมวดหมู่: ${label}`
  }

  if (attribute === LABELS_ATTRIBUTE) {
    return `ป้ายกำกับ: ${label}`
  }

  return label
}

/**
 * Every active refinement as a chip that drops it, above the filters that set
 * them. The free-text query is excluded by the connector's own defaults, so
 * only what the sidebar controls shows up here.
 */
const CurrentRefinements = ({ currencyCode }: { currencyCode: string }) => {
  const { items, refine } = useCurrentRefinements()
  const { canRefine: canClearAll, refine: clearAll } = useClearRefinements()

  const refinements = items.flatMap((item) => item.refinements)

  if (!refinements.length) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-3" data-testid="current-refinements">
      <div className="flex items-center justify-between gap-x-2 pr-6">
        <span className="text-sm leading-5 font-medium text-muted-foreground">
          ตัวกรองที่เลือก
        </span>
        {canClearAll && (
          <Button
            variant="link"
            onClick={clearAll}
            data-testid="clear-refinements"
          >
            ล้างทั้งหมด
          </Button>
        )}
      </div>

      <ul className="flex flex-wrap gap-2 pr-6">
        {refinements.map((refinement) => {
          const label = refinementLabel(refinement, currencyCode)

          return (
            <li
              key={`${refinement.attribute}:${refinement.operator ?? ""}:${
                refinement.value
              }`}
              className="min-w-0 max-w-full"
            >
              {/* CORE-93 (กฎข้อ 149): ชื่อยาว (เช่น tag) ตัดด้วย truncate บรรทัดเดียว และ title บอกข้อความเต็ม */}
              {/* SFUI-19d (spec 09 กฎ 67c): `Button variant="outline"` ขนาด default */}
              <Button
                variant="outline"
                onClick={() => refine(refinement)}
                aria-label={`ลบตัวกรอง ${label}`}
                title={label}
                className="max-w-full"
                data-testid="remove-refinement"
              >
                <span className="truncate">{label}</span>
                <X aria-hidden="true" />
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default CurrentRefinements
