"use client"

import { useId } from "react"
import { useToggleRefinement } from "react-instantsearch"

import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"

import { priceAttribute } from "@lib/search-client"

/**
 * Narrows to products whose calculated price is below their original in the
 * region's currency. Hides itself when nothing is discounted, which is the
 * case until a price list applies to some product.
 */
const OnSaleToggle = ({ currencyCode }: { currencyCode: string }) => {
  const { value, refine, canRefine } = useToggleRefinement({
    attribute: priceAttribute("on_sale", currencyCode),
    on: true,
  })
  const id = useId()

  if (!canRefine) {
    return null
  }

  // SFUI-19d (spec 09 กฎ 67b): ตัวอย่าง docs ของ checkbox — `Field orientation="horizontal"` → `Checkbox` → `FieldLabel`
  return (
    <Field orientation="horizontal">
      <Checkbox
        id={id}
        checked={value.isRefined}
        onCheckedChange={() => refine(value)}
        data-testid="on-sale-toggle"
      />
      <FieldLabel htmlFor={id}>
        เฉพาะสินค้าลดราคา
        {typeof value.count === "number" && (
          <span className="text-muted-foreground">({value.count})</span>
        )}
      </FieldLabel>
    </Field>
  )
}

export default OnSaleToggle
