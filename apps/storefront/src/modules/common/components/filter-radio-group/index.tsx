import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { Circle } from "lucide-react"

type FilterRadioGroupProps = {
  title: string
  items: {
    value: string
    label: string
  }[]
  value: string
  handleChange: (value: string) => void
  "data-testid"?: string
}

// SFUI-5a (spec 09 กฎ 20): RadioGroup ของ shadcn — item ซ่อนด้วย sr-only (ไม่ใช่ hidden: label ต้องคลิกถึง)
const FilterRadioGroup = ({
  title,
  items,
  value,
  handleChange,
  "data-testid": dataTestId,
}: FilterRadioGroupProps) => {
  return (
    <div className="flex gap-x-3 flex-col gap-y-3">
      <p className="text-sm leading-5 font-medium text-muted-foreground">{title}</p>
      <RadioGroup value={value} onValueChange={handleChange} data-testid={dataTestId}>
        {items?.map((i) => (
          <div
            key={i.value}
            className={cn("flex items-center", {
              "-ml-4": i.value === value,
            })}
          >
            {i.value === value && <Circle className="mr-2 fill-current size-2" />}
            <RadioGroupItem value={i.value} id={i.value} className="sr-only" />
            <Label
              htmlFor={i.value}
              className={cn(
                "text-sm! leading-5 font-normal transform-none! text-muted-foreground hover:cursor-pointer",
                {
                  "text-foreground": i.value === value,
                }
              )}
              data-testid="radio-label"
              data-active={i.value === value}
            >
              {i.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}

export default FilterRadioGroup
