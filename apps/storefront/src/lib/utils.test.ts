import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// SFUI-1b (spec 09 AC-7, กฎ 2): import ผ่าน alias "@" ของ vitest/tsconfig (ไม่ใช่ path สัมพัทธ์)
import { FONT_SIZE_UTILITIES, cn } from "@/lib/utils"

describe("cn (@/lib/utils — AC-7)", () => {
  it("รวม class แล้ว class ที่มาทีหลังชนะ (tailwind-merge)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("ข้ามค่า falsy แบบ clsx", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c")
  })
})

// SFUI-2 (session หลักตัดสิน Q1): utility ขนาดฟอนต์ของ globals.css (`text-xl-semi` ฯลฯ) ต้องอยู่กลุ่ม font-size ของ cn
// ไม่งั้น tailwind-merge ถือเป็นสีตัวอักษรแล้วตัดทิ้งเมื่อเจอ `text-<สี>` ในการเรียกเดียวกัน (ราคา sale บน PDP เคยหายขนาด)
describe("cn — utility ขนาดฟอนต์ของ globals.css (SFUI-2)", () => {
  it("คง utility ขนาดฟอนต์ไว้คู่กับสีตัวอักษร", () => {
    expect(cn("text-xl-semi", "text-ui-fg-muted")).toBe("text-xl-semi text-ui-fg-muted")
    // line-item-price (ราคาที่ลดแล้ว)
    expect(cn("text-base-regular", { "text-ui-fg-interactive": true })).toBe(
      "text-base-regular text-ui-fg-interactive"
    )
    // รูปเดียวกับจุดที่เคยหาย: product-price (ราคา sale บน PDP), native-select (placeholder)
    expect(cn("text-xl-semi", { "text-ui-fg-interactive": true })).toBe(
      "text-xl-semi text-ui-fg-interactive"
    )
    expect(cn("relative flex items-center text-base-regular", undefined, { "text-ui-fg-muted": true })).toBe(
      "relative flex items-center text-base-regular text-ui-fg-muted"
    )
    expect(cn("text-small-regular", "text-muted-foreground")).toBe(
      "text-small-regular text-muted-foreground"
    )
  })

  it("ขนาดฟอนต์ยัง merge ปกติ (ตัวหลังชนะ) รวมถึงระหว่าง utility ของเรากับของ Tailwind", () => {
    expect(cn("text-sm", "text-lg")).toBe("text-lg")
    expect(cn("text-sm", "text-xl-semi")).toBe("text-xl-semi")
    expect(cn("text-xl-semi", "text-sm")).toBe("text-sm")
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })

  it("ทุก @utility text-* ใน globals.css ที่กำหนดขนาดฟอนต์อยู่ใน FONT_SIZE_UTILITIES (กันหลุดเมื่อเพิ่มใหม่)", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../styles/globals.css"), "utf8")
    const declared = Array.from(css.matchAll(/@utility\s+(text-[\w-]+)\s*\{([^}]*)\}/g))
      .filter(([, , body]) => /font-size|@apply[^;]*\btext-(?:\[|xs\b|sm\b|base\b|lg\b|\d?xl\b)/.test(body))
      .map(([, name]) => name)
    expect(declared.length).toBeGreaterThan(0)
    expect([...FONT_SIZE_UTILITIES].map((u) => `text-${u}`).sort()).toEqual(declared.sort())
  })
})
