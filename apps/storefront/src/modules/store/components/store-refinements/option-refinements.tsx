"use client"

import { useState } from "react"
import { useRefinementList } from "react-instantsearch"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { OPTION_VALUES_ATTRIBUTE } from "./attributes"

const FACET_LIMIT = 200

// SFUI-24b (spec 09 กฎ 87): Medusa admin 2.22.1 (`@medusajs/dashboard` `createDefaultOptionAndVariant`) สร้าง option นี้
// ให้สินค้าที่ไม่มี variant (เช่น บัตรกำนัล) — ไม่ใช่ตัวเลือกจริง จึงไม่แสดงในตัวกรอง (ข้ามเฉพาะเมื่อ title และค่าตรงกันทั้งคู่)
const MEDUSA_DEFAULT_OPTION_TITLE = "Default option"
const MEDUSA_DEFAULT_OPTION_VALUE = "Default option value"

type OptionGroup = {
  title: string
  values: {
    label: string
    value: string
    count: number
    isRefined: boolean
  }[]
}

export function groupItems(
  items: ReturnType<typeof useRefinementList>["items"]
): OptionGroup[] {
  const groups = new Map<string, OptionGroup>()

  for (const item of items) {
    const separator = item.label.indexOf(":")

    if (separator < 1) {
      continue
    }

    const title = item.label.slice(0, separator)
    const label = item.label.slice(separator + 1)

    if (
      title === MEDUSA_DEFAULT_OPTION_TITLE &&
      label === MEDUSA_DEFAULT_OPTION_VALUE
    ) {
      continue
    }

    if (!groups.has(title)) {
      groups.set(title, { title, values: [] })
    }

    groups.get(title)!.values.push({
      label,
      value: item.value,
      count: item.count,
      isRefined: item.isRefined,
    })
  }

  return Array.from(groups.values())
}

const OptionRefinements = () => {
  const { items, refine } = useRefinementList({
    attribute: OPTION_VALUES_ATTRIBUTE,
    limit: FACET_LIMIT,
    // Alphabetical keeps a size or colour list stable as counts move around.
    sortBy: ["name:asc"],
    operator: "and",
  })
  const [closedGroups, setClosedGroups] = useState<string[]>([])

  const groups = groupItems(items)

  if (!groups.length) {
    return null
  }

  return (
    <Accordion
      type="multiple"
      value={groups
        .map((group) => group.title)
        .filter((title) => !closedGroups.includes(title))}
      onValueChange={(openTitles) =>
        setClosedGroups(
          groups
            .map((group) => group.title)
            .filter((title) => !openTitles.includes(title))
        )
      }
      className="flex flex-col gap-y-3 pr-6"
    >
      {groups.map((group) => (
        <AccordionItem
          key={group.title}
          value={group.title}
          className="overflow-hidden border-b-0"
        >
          {/* SFUI-4: chevron มาจาก AccordionTrigger ของ shadcn (หมุนเมื่อเปิดด้วย data-state) */}
          <AccordionTrigger className="items-center">
            {/* CORE-87 (spec 01 กฎข้อ 143): ไม่มีตัวเลขที่หัว — facet ของ index มีจำนวนต่อ "<option>:<ค่า>" เท่านั้น
                ไม่มีจำนวนสินค้าต่อ option และรวมจากค่าย่อยไม่ได้ (สินค้าหนึ่งมีหลายค่า) */}
            <span
              className="text-sm font-medium leading-5 text-foreground"
              data-testid="option-refinement-title"
            >
              {group.title}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-1">
            {/* SFUI-19d (spec 09 กฎ 67a): `toggle-group` ของ shadcn — กลุ่มส่งค่าที่เลือกทั้งหมด จึง refine เฉพาะค่าที่เปลี่ยน */}
            <ToggleGroup
              type="multiple"
              variant="outline"
              spacing={2}
              className="flex-wrap"
              value={group.values.filter((v) => v.isRefined).map((v) => v.value)}
              onValueChange={(next) => {
                const changed = group.values.find(
                  (v) => v.isRefined !== next.includes(v.value)
                )
                if (changed) refine(changed.value)
              }}
            >
              {group.values.map((value) => (
                <ToggleGroupItem
                  key={value.value}
                  value={value.value}
                  data-testid="option-refinement"
                >
                  {value.label}
                  <span className="text-muted-foreground">({value.count})</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

export default OptionRefinements
