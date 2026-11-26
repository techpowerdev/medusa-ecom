import type { ComponentProps, HTMLAttributes, InputHTMLAttributes } from "react"

import { Badge as ShadcnBadge } from "@/components/ui/badge"
import { Button as ShadcnButton, buttonVariants } from "@/components/ui/button"
import { Input as ShadcnInput } from "@/components/ui/input"
import { Label as ShadcnLabel } from "@/components/ui/label"
import {
  Table as ShadcnTable,
  TableBody as ShadcnTableBody,
  TableCell as ShadcnTableCell,
  TableHead as ShadcnTableHead,
  TableHeader as ShadcnTableHeader,
  TableRow as ShadcnTableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

// SFUI-2 (spec 09 กฎ 20, ADR-030): shim ชั่วคราวที่คง API เดิมของ starter แต่ส่งต่อไป primitive ของ shadcn
// (`src/components/ui/*`) — ไฟล์ผู้ใช้ย้ายไป import shadcn ตรงใน SFUI-3x/4/5x แล้วลบทั้งโฟลเดอร์ใน SFUI-6
// React 19: ref เป็น prop ธรรมดา จึงไม่ต้องใช้ forwardRef

export { cn as clx }

// Text Component — `txt-medium` เดิม → `text-sm leading-[1.4rem]` (font-size/line-height เท่ากัน — กฎ 21)
type TextProps = HTMLAttributes<HTMLParagraphElement> & {
  as?: "p" | "span" | "div"
} & Pick<ComponentProps<"p">, "ref">

// class ขนาดแบบ preset ที่ cn ไม่รู้จัก (หายใน SFUI-5x/6 พร้อม shim) — ถ้าผู้เรียกใส่มา ไม่ใส่ขนาดเริ่มต้นทับ
// (ขนาดของ Tailwind/globals.css เช่น text-lg, text-base-regular ให้ cn merge ตามปกติ)
const PRESET_SIZE = /(?:^|\s|:)!?(?:txt-|h[1-3]-webs\b)/

export const Text = ({ className, as: Component = "p", ...props }: TextProps) => {
  const presetSize = PRESET_SIZE.test(className ?? "")
  return <Component className={cn(!presetSize && "text-sm leading-[1.4rem]", className)} {...props} />
}

// Heading Component
type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  level?: "h1" | "h2" | "h3"
} & Pick<ComponentProps<"h2">, "ref">

export const Heading = ({ className, level: Component = "h2", ...props }: HeadingProps) => (
  <Component
    className={cn(
      "font-semibold",
      Component === "h1" && "text-3xl",
      Component === "h2" && "text-2xl",
      Component === "h3" && "text-xl",
      className
    )}
    {...props}
  />
)

// Button Component — variant/size เดิม → ของ shadcn (กฎ 20)
type ButtonStyle = {
  variant?: "primary" | "secondary" | "transparent"
  size?: "small" | "medium" | "large"
}

const VARIANT = { primary: "default", secondary: "outline", transparent: "ghost" } as const
const SIZE = { small: "sm", medium: "default", large: "lg" } as const
// D-1 (กฎ 19 ชนะกฎ 20): `large` เดิมสูง 48px แต่ `lg` ของ shadcn สูง 40px — ปุ่ม submit-payment-button ที่เตี้ยลงทำให้
// คลิกหลังกรอกบัตรตกใน iframe ของ Stripe จึงคง `h-12` (padding `px-6` เท่าเดิมอยู่แล้ว)
const SIZE_KEEP = { small: undefined, medium: undefined, large: "h-12" } as const

type ButtonProps = Omit<ComponentProps<typeof ShadcnButton>, "variant" | "size"> & ButtonStyle

// CORE-90 (spec 01 กฎข้อ 146b): className ของปุ่ม ใช้กับลิงก์ที่หน้าตาเป็นปุ่มได้โดยไม่ซ้อน <button> ใน <a>
export const buttonClassName = (
  { variant = "primary", size = "medium" }: ButtonStyle = {},
  className?: string
) => cn(buttonVariants({ variant: VARIANT[variant], size: SIZE[size] }), SIZE_KEEP[size], className)

export const Button = ({
  variant = "primary",
  size = "medium",
  className,
  ...props
}: ButtonProps) => (
  <ShadcnButton
    variant={VARIANT[variant]}
    size={SIZE[size]}
    className={cn(SIZE_KEEP[size], className)}
    {...props}
  />
)

// Container Component
type ContainerProps = ComponentProps<"div">

export const Container = ({ className, ...props }: ContainerProps) => (
  <div className={cn("rounded-lg bg-card p-4", className)} {...props} />
)

// Badge Component — grey → secondary, red → destructive, สีอื่น → outline + สีพื้น/ตัวอักษรเดิม (กฎ 20)
type BadgeColor = "green" | "red" | "blue" | "orange" | "grey" | "purple"
type BadgeProps = Omit<ComponentProps<typeof ShadcnBadge>, "variant" | "color"> & {
  color?: BadgeColor
}

const BADGE_TINT: Partial<Record<BadgeColor, string>> = {
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  orange: "bg-orange-100 text-orange-700",
  purple: "bg-purple-100 text-purple-700",
}

export const Badge = ({ className, color = "grey", ...props }: BadgeProps) => (
  <ShadcnBadge
    variant={color === "grey" ? "secondary" : color === "red" ? "destructive" : "outline"}
    className={cn(BADGE_TINT[color], className)}
    {...props}
  />
)

// IconBadge Component
type IconBadgeProps = Omit<ComponentProps<typeof ShadcnBadge>, "variant">

export const IconBadge = (props: IconBadgeProps) => (
  <ShadcnBadge variant="secondary" {...props} />
)

// IconButton Component
type IconButtonProps = Omit<ComponentProps<typeof ShadcnButton>, "variant" | "size">

export const IconButton = (props: IconButtonProps) => (
  <ShadcnButton variant="ghost" size="icon" {...props} />
)

// Label Component
export const Label = ShadcnLabel

// Input Component — คง prop `label` เดิม (ห่อด้วย div + Label เหมือนเดิม)
type InputProps = ComponentProps<typeof ShadcnInput> & {
  label?: string
}

export const Input = ({ label, ...props }: InputProps) => (
  <div className="flex flex-col gap-1">
    {label && <ShadcnLabel>{label}</ShadcnLabel>}
    <ShadcnInput {...props} />
  </div>
)

// Table Components — ห่อเป็น component ของไฟล์นี้ก่อน Object.assign
// (table.tsx เป็น "use client": import จาก server component ได้ client reference ที่ห้าม assign property)
const TableRoot = (props: ComponentProps<typeof ShadcnTable>) => <ShadcnTable {...props} />
const TableHeader = (props: ComponentProps<typeof ShadcnTableHeader>) => (
  <ShadcnTableHeader {...props} />
)
const TableBody = (props: ComponentProps<typeof ShadcnTableBody>) => (
  <ShadcnTableBody {...props} />
)
const TableRow = (props: ComponentProps<typeof ShadcnTableRow>) => <ShadcnTableRow {...props} />
// padding เดิมของ shim (shadcn ใช้ px-2/p-2 — cell ราคา/รวมใน cart แคบลง: core-42/core-47)
const TableHead = ({ className, ...props }: ComponentProps<typeof ShadcnTableHead>) => (
  <ShadcnTableHead className={cn("px-4", className)} {...props} />
)
const TableCell = ({ className, ...props }: ComponentProps<typeof ShadcnTableCell>) => (
  <ShadcnTableCell className={cn("p-4", className)} {...props} />
)

export const Table = Object.assign(TableRoot, {
  Header: TableHeader,
  Body: TableBody,
  Row: TableRow,
  Head: TableHead,
  HeaderCell: TableHead,
  Cell: TableCell,
})

// RadioGroup / Checkbox — คงเป็น <input> native ตามเดิม (ผู้ใช้ย้ายไป RadioGroup/Checkbox ของ shadcn ตรงใน SFUI-5a — กฎ 20)
type RadioGroupProps = ComponentProps<"div">

const RadioGroupRoot = ({ className, ...props }: RadioGroupProps) => (
  <div className={cn("flex flex-col gap-2", className)} {...props} />
)

type RadioGroupItemProps = ComponentProps<"input"> & {
  label?: string
}

const RadioGroupItem = ({ className, label, id, ...props }: RadioGroupItemProps) => (
  <div className="flex items-center gap-2">
    <input
      type="radio"
      id={id}
      className={cn("h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-900", className)}
      {...props}
    />
    {label && <ShadcnLabel htmlFor={id}>{label}</ShadcnLabel>}
  </div>
)

export const RadioGroup = Object.assign(RadioGroupRoot, {
  Item: RadioGroupItem,
})

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> &
  Pick<ComponentProps<"input">, "ref"> & {
    label?: string
  }

export const Checkbox = ({ className, label, id, ...props }: CheckboxProps) => (
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      id={id}
      className={cn(
        "h-4 w-4 rounded-sm border-gray-300 text-gray-900 focus:ring-gray-900",
        className
      )}
      {...props}
    />
    {label && <ShadcnLabel htmlFor={id}>{label}</ShadcnLabel>}
  </div>
)
