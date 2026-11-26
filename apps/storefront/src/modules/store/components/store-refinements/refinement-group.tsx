"use client"

import { useRefinementList } from "react-instantsearch"

import { cn } from "@/lib/utils"

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
        {items.map((item) => (
          <li key={item.value}>
            <label className="flex cursor-pointer items-start gap-x-2">
              <input
                type="checkbox"
                checked={item.isRefined}
                onChange={() => refine(item.value)}
                className="mt-1 shrink-0 accent-primary"
                data-testid={`refinement-${attribute}`}
              />
              <span
                className={cn(
                  "text-xs leading-5 font-normal min-w-0 break-words",
                  item.isRefined ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
              <span className="text-xs leading-5 font-normal shrink-0 text-muted-foreground">
                ({item.count})
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default RefinementGroup
