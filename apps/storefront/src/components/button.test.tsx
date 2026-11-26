// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { Button } from "@/components/button"
import { Button as UiButton, buttonVariants } from "@/components/ui/button"

// SFUI-2 (spec 09 กฎ 3, 14, 20, AC-8): Button มี `isLoading` (แสดงข้อความไทย + disabled ตาม shim เดิม)
// SFUI-7 (กฎ 3, AC-19): `isLoading` อยู่ใน wrapper `@/components/button` ที่ประกอบจาก Button ของ shadcn (ไฟล์ ui = ผล CLI)
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

describe("Button (wrapper src/components/button.tsx ของ Button ใน src/components/ui)", () => {
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

  it("ไม่ loading → DOM เท่ากับ Button ของ shadcn ทุก attribute (wrapper ไม่เปลี่ยนหน้าตา)", () => {
    const props = { variant: "outline", size: "sm", className: "w-full", "data-testid": "x", type: "submit" } as const
    const ui = render(<UiButton {...props}>ยืนยัน</UiButton>).innerHTML
    expect(render(<Button {...props}>ยืนยัน</Button>).innerHTML).toBe(ui)
    const disabled = render(<UiButton disabled>ยืนยัน</UiButton>).innerHTML
    expect(render(<Button disabled>ยืนยัน</Button>).innerHTML).toBe(disabled)
  })

  it("asChild ไม่ loading → ส่ง class ให้ลูก; asChild + isLoading → render <button> ที่ disabled (Slot ใช้กับข้อความไม่ได้)", () => {
    const child = render(
      <Button asChild>
        <span>ไป</span>
      </Button>
    ).querySelector("span")!
    expect(child.getAttribute("data-slot")).toBe("button")
    const button = render(
      <Button asChild isLoading>
        <span>ไป</span>
      </Button>
    ).querySelector("button")!
    expect(button.disabled).toBe(true)
    expect(button.querySelector("span")).toBeNull()
  })

  it('buttonVariants({ variant: "outline", size: "sm" }) คืน string ที่ไม่ว่าง', () => {
    const classes = buttonVariants({ variant: "outline", size: "sm" })
    expect(typeof classes).toBe("string")
    expect(classes.length).toBeGreaterThan(0)
  })
})
