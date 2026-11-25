// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import * as shim from "@modules/common/components/ui"

// SFUI-2 (spec 09 กฎ 20, AC-8): shim `@modules/common/components/ui` ส่งต่อไป primitive ของ shadcn (`data-slot`) โดยคง API เดิม
// ไฟล์นี้อยู่ใน PENDING ของ SFUI-6 (import shim = pattern ต้องห้ามตามกฎ 15) และถูกลบพร้อมโฟลเดอร์ shim
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

describe("shim @modules/common/components/ui ส่งต่อไป shadcn", () => {
  it("clx คือ cn", () => {
    expect(shim.clx).toBe(cn)
  })

  it("Button render เป็น Button ของ shadcn (data-slot) คง testid และ isLoading เดิม", () => {
    const el = render(
      <shim.Button variant="secondary" size="small" isLoading data-testid="x-button">
        บันทึก
      </shim.Button>
    )
    const button = el.querySelector('[data-testid="x-button"]') as HTMLButtonElement
    expect(button.tagName).toBe("BUTTON")
    expect(button.getAttribute("data-slot")).toBe("button")
    expect(button.disabled).toBe(true)
    expect(button.textContent).toMatch(THAI)
  })

  it("buttonClassName map variant/size เดิม → buttonVariants ของ shadcn", () => {
    expect(shim.buttonClassName()).toBe(cn(buttonVariants({ variant: "default", size: "default" })))
    expect(shim.buttonClassName({ variant: "secondary", size: "small" }, "w-full")).toBe(
      cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")
    )
    expect(shim.buttonClassName({ variant: "transparent", size: "large" })).toBe(
      cn(buttonVariants({ variant: "ghost", size: "lg" }))
    )
  })

  it("IconButton → Button ghost/icon ของ shadcn", () => {
    const button = render(<shim.IconButton aria-label="ปิด" />).querySelector("button")!
    expect(button.getAttribute("data-slot")).toBe("button")
    expect(button.className).toBe(cn(buttonVariants({ variant: "ghost", size: "icon" })))
  })

  it("Badge / IconBadge → Badge ของ shadcn", () => {
    const el = render(
      <>
        <shim.Badge color="orange" data-testid="b-orange">
          ทดสอบ
        </shim.Badge>
        <shim.Badge color="red" data-testid="b-red" />
        <shim.IconBadge data-testid="b-icon" />
      </>
    )
    for (const id of ["b-orange", "b-red", "b-icon"]) {
      expect(el.querySelector(`[data-testid="${id}"]`)!.getAttribute("data-slot")).toBe("badge")
    }
    expect(el.querySelector('[data-testid="b-orange"]')!.className).toContain("bg-orange-100")
    expect(el.querySelector('[data-testid="b-red"]')!.getAttribute("data-variant")).toBe(
      "destructive"
    )
  })

  it("Label / Input → shadcn (Input เป็น <input> native ที่คง name และ label เดิม)", () => {
    const el = render(
      <form>
        <shim.Label htmlFor="email">อีเมล</shim.Label>
        <shim.Input id="email" name="email" label="อีเมลสำรอง" data-testid="email-input" />
      </form>
    )
    expect(el.querySelector("label[for=email]")!.getAttribute("data-slot")).toBe("label")
    const input = el.querySelector('[data-testid="email-input"]') as HTMLInputElement
    expect(input.tagName).toBe("INPUT")
    expect(input.getAttribute("data-slot")).toBe("input")
    expect(input.name).toBe("email")
    expect(el.textContent).toContain("อีเมลสำรอง")
  })

  it("Table.* → Table ของ shadcn", () => {
    const el = render(
      <shim.Table>
        <shim.Table.Header>
          <shim.Table.Row>
            <shim.Table.Head>ก</shim.Table.Head>
            <shim.Table.HeaderCell>ข</shim.Table.HeaderCell>
          </shim.Table.Row>
        </shim.Table.Header>
        <shim.Table.Body data-testid="products-table">
          <shim.Table.Row data-testid="product-row">
            <shim.Table.Cell>ค</shim.Table.Cell>
          </shim.Table.Row>
        </shim.Table.Body>
      </shim.Table>
    )
    const slot = (selector: string) => el.querySelector(selector)!.getAttribute("data-slot")
    expect(slot("table")).toBe("table")
    expect(slot("thead")).toBe("table-header")
    expect(slot('[data-testid="products-table"]')).toBe("table-body")
    expect(slot('[data-testid="product-row"]')).toBe("table-row")
    expect(slot("th")).toBe("table-head")
    expect(el.querySelectorAll('th[data-slot="table-head"]')).toHaveLength(2)
    expect(slot("td")).toBe("table-cell")
  })
})
