// @vitest-environment jsdom
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import ErrorMessage from "./index"

// SFUI-21d (spec 09 กฎ 74 (a)/(d), AC-70 (2)): ErrorMessage = Alert destructive ของ shadcn — render จริง (ไม่ mock primitive — บทเรียน PAY-16)
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

const render = (node: ReactNode) => act(() => root.render(node))

describe("ErrorMessage (SFUI-21d)", () => {
  it("error ว่าง/null/undefined → ไม่ render", () => {
    for (const error of ["", null, undefined]) {
      render(<ErrorMessage error={error} data-testid="e" />)
      expect(container.innerHTML).toBe("")
    }
  })

  it("มีข้อความ → root เป็น Alert (role=alert, data-slot=alert) ที่มี testid + id, ข้อความอยู่ใน AlertDescription", () => {
    render(<ErrorMessage error="โค้ดไม่ถูกต้อง" id="promo-err" data-testid="promotion-error" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute("role")).toBe("alert")
    expect(root.getAttribute("data-slot")).toBe("alert")
    expect(root.getAttribute("data-testid")).toBe("promotion-error")
    expect(root.id).toBe("promo-err")
    expect(root.textContent).toBe("โค้ดไม่ถูกต้อง")
    expect(root.querySelector('[data-slot="alert-description"]')?.textContent).toBe("โค้ดไม่ถูกต้อง")
    expect(root.querySelector('[data-slot="alert-title"]')).toBeNull()
    // icon (svg) ไม่มีข้อความ และไม่ส่ง size-* (ขนาดมาจาก [&>svg]:size-4 ของ Alert)
    const icon = root.querySelector(":scope > svg")
    expect(icon).not.toBeNull()
    expect(icon?.getAttribute("class") ?? "").not.toMatch(/\bsize-/)
  })
})
