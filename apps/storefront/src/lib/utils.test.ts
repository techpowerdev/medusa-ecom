import { cn as packageCn } from "cn"
import { describe, expect, it } from "vitest"

// SFUI-1b (spec 09 AC-7, กฎ 2): import ผ่าน alias "@" ของ vitest/tsconfig (ไม่ใช่ path สัมพัทธ์)
import { cn } from "@/lib/utils"

describe("cn (@/lib/utils — AC-7)", () => {
  it("รวม class แล้ว class ที่มาทีหลังชนะ (tailwind-merge)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("ข้ามค่า falsy แบบ clsx", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c")
  })

  // SFUI-10 (spec 09 กฎ 24, AC-24): ไม่ extend แล้ว — เป็นฟังก์ชันเดียวกับของ package cn (ADR-030 ข้อ 3)
  it("เป็น cn ของ package cn ตรงตัว (re-export ไม่สร้างฟังก์ชันใหม่)", () => {
    expect(cn).toBe(packageCn)
    expect(cn("text-sm", "text-lg")).toBe("text-lg")
    expect(cn("text-sm", "text-muted-foreground")).toBe("text-sm text-muted-foreground")
  })
})
