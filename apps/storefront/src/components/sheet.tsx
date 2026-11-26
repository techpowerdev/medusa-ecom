"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// SFUI-7 (spec 09 กฎ 3, 9, 10): SheetContent ของ shadcn + `overlayProps` (เช่น testid `side-menu-backdrop` ของ side menu เดิม)
// และปุ่มปิดในตัวชื่อภาษาไทย — ของ CLI ไม่เปิด prop ของ overlay (และไม่ export SheetPortal/SheetOverlay) ส่วนปุ่มปิดมีข้อความ "Close"
// จึงประกอบจาก primitive ของ Radix ด้วย class เดียวกับ src/components/ui/sheet.tsx (wrappers.test.tsx เทียบ DOM กับของ CLI)
// ส่วนอื่นของ Sheet (Sheet, SheetTrigger, SheetClose, SheetTitle ฯลฯ) ใช้จาก @/components/ui/sheet ตรง
function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  overlayProps,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
  overlayProps?: React.ComponentProps<typeof SheetPrimitive.Overlay> & { "data-testid"?: string }
}) {
  return (
    <SheetPrimitive.Portal data-slot="sheet-portal">
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        {...overlayProps}
        className={cn(
          "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
          overlayProps?.className
        )}
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary">
            <XIcon className="size-4" />
            <span className="sr-only">ปิด</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

export { SheetContent }
