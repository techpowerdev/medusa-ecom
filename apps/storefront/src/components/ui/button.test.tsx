// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { Button, buttonVariants } from "@/components/ui/button"

// SFUI-2 (spec 09 กฎ 3, 14, 20, AC-8): Button ของ shadcn มี `isLoading` (แสดงข้อความไทย + disabled ตาม shim เดิม)
// test ของ shim ที่ส่งต่อมาที่นี่อยู่ใน `src/modules/common/components/ui/index.test.tsx` (ลบพร้อม shim ใน SFUI-6)
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const THAI = /[฀-๿]/

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(ui: ReactElement) {
  act(() => root.render(ui))
  return container
}

describe("Button ของ shadcn (src/components/ui/button.tsx)", () => {
  it("isLoading → ปุ่ม disabled และแสดงข้อความภาษาไทยแทน children", () => {
    const el = render(<Button isLoading>ยืนยัน</Button>)
    const button = el.querySelector("button")!
    expect(button.disabled).toBe(true)
    expect(button.textContent).toMatch(THAI)
    expect(button.textContent).not.toContain("ยืนยัน")
    expect(button.getAttribute("data-slot")).toBe("button")
  })

  it("ไม่ loading → แสดง children และกดได้", () => {
    const button = render(<Button>ยืนยัน</Button>).querySelector("button")!
    expect(button.disabled).toBe(false)
    expect(button.textContent).toBe("ยืนยัน")
  })

  it("isLoading ร่วมกับ disabled={false} ยังคง disabled", () => {
    const button = render(
      <Button isLoading disabled={false}>
        ยืนยัน
      </Button>
    ).querySelector("button")!
    expect(button.disabled).toBe(true)
  })

  it('buttonVariants({ variant: "outline", size: "sm" }) คืน string ที่ไม่ว่าง', () => {
    const classes = buttonVariants({ variant: "outline", size: "sm" })
    expect(typeof classes).toBe("string")
    expect(classes.length).toBeGreaterThan(0)
  })
})
