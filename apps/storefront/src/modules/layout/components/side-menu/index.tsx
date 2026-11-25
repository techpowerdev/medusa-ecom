"use client"

import useToggleState from "@lib/hooks/use-toggle-state"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ArrowRight, X } from "lucide-react"
import { useState } from "react"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import CountrySelect from "../country-select"

// test id คงเดิมของ starter (`<key>-link`) — e2e หาด้วย test id ไม่ใช่ข้อความ (ADR-014)
const SideMenuItems = [
  { key: "home", label: "หน้าแรก", href: "/" },
  { key: "store", label: "สินค้าทั้งหมด", href: "/store" },
  { key: "account", label: "บัญชีของฉัน", href: "/account" },
  { key: "cart", label: "ตะกร้า", href: "/cart" },
]

type SideMenuProps = {
  regions: HttpTypes.StoreRegion[] | null
  storeName: string
}

// SFUI-3b (spec 09 กฎ 4): side menu เป็น `Sheet side="left"` — Radix จัดการ focus trap, Escape และคืน focus ให้ `nav-menu-button`
const SideMenu = ({ regions, storeName }: SideMenuProps) => {
  const [open, setOpen] = useState(false)
  const countryToggleState = useToggleState()
  const close = () => setOpen(false)

  return (
    <div className="h-full">
      <div className="flex items-center h-full">
        <div className="h-full flex">
          <Sheet open={open} onOpenChange={setOpen}>
            <div className="relative flex h-full">
              <SheetTrigger
                data-testid="nav-menu-button"
                className="relative h-full flex items-center transition-all ease-out duration-200 focus:outline-hidden hover:text-foreground"
              >
                เมนู
              </SheetTrigger>
            </div>

            <SheetContent
              side="left"
              showCloseButton={false}
              overlayProps={{ "data-testid": "side-menu-backdrop" }}
              // เต็มจอบนมือถือเหมือนเดิม (แผงเดิม w-full) — w-3/4 ของ Sheet แคบกว่ารายการประเทศ (min-w 320px) จนลูกศรหลุดจอ
              className="w-full justify-between gap-0 p-6 text-sm sm:max-w-sm"
              data-testid="nav-menu-popup"
            >
              <div className="flex items-center justify-between">
                <SheetTitle className="text-base">เมนู</SheetTitle>
                <SheetClose
                  data-testid="close-menu-button"
                  aria-label="ปิดเมนู"
                  className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <X className="size-5" />
                </SheetClose>
              </div>
              <SheetDescription className="sr-only">
                ลิงก์ไปยังหน้าต่างๆ ของร้าน และเลือกประเทศที่จัดส่ง
              </SheetDescription>
              <ul className="flex flex-col gap-6 items-start justify-start">
                {SideMenuItems.map(({ key, label, href }) => {
                  return (
                    <li key={key}>
                      <LocalizedClientLink
                        href={href}
                        className="text-3xl leading-10 hover:text-muted-foreground"
                        onClick={close}
                        data-testid={`${key}-link`}
                      >
                        {label}
                      </LocalizedClientLink>
                    </li>
                  )
                })}
              </ul>
              <div className="flex flex-col gap-y-6">
                {/* SFUI-3b (review SFUI-3c): ลูกศรสะท้อนสถานะเปิดของรายการประเทศผ่าน `toggleState` — ไม่เปิด/ปิดตาม hover
                    (รายการประเทศเปิดด้วยคลิก/คีย์บอร์ดของ Select ใน SFUI-3c) */}
                <div className="flex justify-between">
                  {regions && (
                    <CountrySelect
                      toggleState={countryToggleState}
                      regions={regions}
                    />
                  )}
                  <ArrowRight
                    className={cn(
                      "size-4 transition-transform duration-150",
                      countryToggleState.state ? "-rotate-90" : ""
                    )}
                  />
                </div>
                <p className="flex justify-between text-sm leading-5 text-muted-foreground">
                  © {new Date().getFullYear()} {storeName} สงวนลิขสิทธิ์
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  )
}

export default SideMenu
