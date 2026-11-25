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
})
