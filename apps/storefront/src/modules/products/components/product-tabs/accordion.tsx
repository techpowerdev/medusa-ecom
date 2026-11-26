import React from "react"

import {
  Accordion as AccordionRoot,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

// SFUI-4 (spec 09 กฎ 4): ห่อ Accordion ของ shadcn ให้ product-tabs ใช้ API เดิม (`Accordion` + `Accordion.Item title`)
// หัวแท็บทั้งแถวเป็นปุ่ม trigger (ชื่อปุ่ม = ชื่อแท็บ) และใช้ chevron ของ shadcn แทนไอคอน +/− เดิม
type AccordionItemProps = React.ComponentProps<typeof AccordionItem> & {
  title: string
  headingSize?: "small" | "medium" | "large"
  children: React.ReactNode
}

type AccordionProps = React.ComponentProps<typeof AccordionRoot>

const Accordion: React.FC<AccordionProps> & {
  Item: React.FC<AccordionItemProps>
} = (props) => <AccordionRoot {...props} />

const Item: React.FC<AccordionItemProps> = ({
  title,
  children,
  className,
  headingSize: _headingSize = "large",
  ...props
}) => {
  return (
    <AccordionItem
      {...props}
      className={cn(
        "border-grey-20 border-t border-b-0 py-3 last:mb-0 last:border-b",
        className
      )}
    >
      <AccordionTrigger className="items-center px-1 py-1.5 font-normal text-muted-foreground">
        {title}
      </AccordionTrigger>
      <AccordionContent className="px-1 pb-0">
        <div className="w-full">{children}</div>
      </AccordionContent>
    </AccordionItem>
  )
}

Accordion.Item = Item

export default Accordion
