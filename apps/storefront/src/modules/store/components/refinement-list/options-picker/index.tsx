"use client"

import { useEffect, useState } from "react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"

type OptionsPickerProps = {
  selectedValueIds: string[]
  setOptionValueIds: (valueIds: string[]) => void
}

const OptionsPicker = ({
  selectedValueIds,
  setOptionValueIds,
}: OptionsPickerProps) => {
  const [options, setOptions] = useState<HttpTypes.StoreProductOption[]>([])
  const [openItems, setOpenItems] = useState<string[]>([])

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await sdk.client.fetch<{
          product_options?: HttpTypes.StoreProductOption[]
        }>("/store/product-options", {
          method: "GET",
          query: {
            is_exclusive: false,
            fields: "*values",
          },
        })

        if (response?.product_options) {
          setOptions(response.product_options)
        }
      } catch (error) {
        console.error("Failed to fetch product options", error)
      }
    }

    fetchOptions()
  }, [])

  useEffect(() => {
    if (options.length) {
      setOpenItems(options.map((option) => option.id))
    }
  }, [options])

  if (!options.length) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium leading-5 text-muted-foreground">
          ตัวเลือกสินค้า
        </span>
      </div>
      <Accordion
        type="multiple"
        value={openItems}
        onValueChange={(values) => setOpenItems(values as string[])}
        className="flex flex-col gap-y-3 pr-6"
      >
        {options.map((option) => {
          const values =
            option.values
              ?.map((value) => ({
                id: value.id,
                label: value.value,
              }))
              .filter(
                (value): value is { id: string; label: string } =>
                  !!value.id && !!value.label
              ) || []

          if (!values.length) {
            return null
          }

          const toggleValue = (valueId: string) => {
            const isSelected = selectedValueIds.includes(valueId)
            const nextSelections = isSelected
              ? selectedValueIds.filter((id) => id !== valueId)
              : [...selectedValueIds, valueId]

            setOptionValueIds(Array.from(new Set(nextSelections)))
          }

          return (
            <AccordionItem
              key={option.id}
              value={option.id}
              className="overflow-hidden border-b-0"
            >
              {/* SFUI-4: chevron มาจาก AccordionTrigger ของ shadcn (หมุนเมื่อเปิดด้วย data-state) */}
              <AccordionTrigger className="items-center py-3">
                {/* CORE-93 (กฎข้อ 149): ไม่แสดงจำนวนที่หัว แบบเดียวกับกฎข้อ 143 */}
                <span className="text-sm font-medium leading-5 text-foreground">
                  {option.title || "ตัวเลือก"}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-1">
                {/* SFUI-19d (spec 09 กฎ 67a): `toggle-group` ของ shadcn — toggle เฉพาะค่าที่เปลี่ยน */}
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  spacing={2}
                  className="flex-wrap"
                  value={values
                    .filter((value) => selectedValueIds.includes(value.id))
                    .map((value) => value.id)}
                  onValueChange={(next) => {
                    const changed = values.find(
                      (value) =>
                        selectedValueIds.includes(value.id) !==
                        next.includes(value.id)
                    )
                    if (changed) toggleValue(changed.id)
                  }}
                >
                  {values.map((value) => (
                    <ToggleGroupItem
                      key={value.id}
                      value={value.id}
                      data-testid="option-refinement"
                    >
                      {value.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}

export default OptionsPicker
