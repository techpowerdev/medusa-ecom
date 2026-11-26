"use client"

import { X } from "lucide-react"
import React from "react"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"

type SearchDrawerProps = {
  isOpen: boolean
  close: () => void
  /** ปุ่มที่เปิด drawer (ลิงก์ `nav-search-button` ไม่ใช่ SheetTrigger) — คืน focus เมื่อปิด */
  returnFocusRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
}

// SFUI-3b (spec 09 กฎ 4, 11): search drawer เป็น `Sheet side="top"`
const SearchDrawer = ({
  isOpen,
  close,
  returnFocusRef,
  children,
}: SearchDrawerProps) => {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="top"
        showCloseButton={false}
        // ปุ่มเปิดเป็นลิงก์ (ทำงานได้โดยไม่มี JS) จึงไม่มี SheetTrigger ให้ Radix คืน focus — คืนเองที่ลิงก์
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocusRef.current?.focus()
        }}
        className="max-h-[85dvh] min-w-0 gap-0"
        data-testid="search-drawer"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <SheetTitle className="text-base leading-6 font-semibold">ค้นหา</SheetTitle>
          <SheetClose
            aria-label="ปิดการค้นหา"
            className="text-muted-foreground hover:text-foreground"
            data-testid="close-search-drawer"
          >
            <X className="size-5" />
          </SheetClose>
        </div>
        {/* ซ่อนด้วย `hidden` ไม่ใช่ `sr-only`: กล่อง 1px ของ sr-only ที่ข้อความล้นถูกนับเป็น container ที่เลื่อนแนวนอนใน
            drawer (core-19a AC-63) — aria-describedby ยังอ่านข้อความของ element ที่ซ่อนได้ */}
        <SheetDescription hidden>
          พิมพ์ชื่อสินค้าเพื่อค้นหา แล้วเลือกสินค้าจากผลลัพธ์
        </SheetDescription>
        {children}
      </SheetContent>
    </Sheet>
  )
}

export default SearchDrawer
