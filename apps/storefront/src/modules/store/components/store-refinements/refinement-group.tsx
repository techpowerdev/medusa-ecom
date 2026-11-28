"use client"

import { useId } from "react"
import { useRefinementList } from "react-instantsearch"

import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"

type RefinementGroupProps = {
  attribute: string
  title: string
}

const RefinementGroup = ({ attribute, title }: RefinementGroupProps) => {
  const { items, refine } = useRefinementList({
    attribute,
    limit: 20,
    sortBy: ["count:desc", "name:asc"],
  })
  const id = useId()

  if (!items.length) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-3">
      <span
        className="text-sm font-medium leading-5 text-muted-foreground"
        data-testid={`refinement-title-${attribute}`}
      >
        {title}
      </span>
      <ul className="flex flex-col gap-y-2 pr-6">
        {/* SFUI-19d (spec 09 กฎ 67b): ตัวอย่าง docs ของ checkbox — `Field orientation="horizontal"` → `Checkbox` → `FieldLabel` */}
        {items.map((item, index) => (
          <li key={item.value}>
            <Field orientation="horizontal">
              <Checkbox
                id={`${id}-${index}`}
                checked={item.isRefined}
                onCheckedChange={() => refine(item.value)}
                data-testid={`refinement-${attribute}`}
              />
              <FieldLabel htmlFor={`${id}-${index}`} className="min-w-0 break-words">
                {item.label}
                <span className="shrink-0 text-muted-foreground">({item.count})</span>
              </FieldLabel>
            </Field>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default RefinementGroup
