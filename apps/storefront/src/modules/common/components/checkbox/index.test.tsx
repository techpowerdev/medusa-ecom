// @vitest-environment jsdom
import { act, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import CheckboxWithLabel from "./index"

// SFUI-5a (spec 09 กฎ 13, 20): Checkbox → shadcn (Radix) — root `role="checkbox"` มี testid,
// ใน <form> ส่ง `same_as_billing=on` เมื่อติ๊ก (cart.ts อ่าน `=== "on"`) และไม่ส่งเมื่อไม่ติ๊ก
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// jsdom ไม่มี ResizeObserver (Radix Checkbox วัดขนาดปุ่มให้ input ซ่อน) — polyfill เฉพาะไฟล์นี้ (spec 09 Non-functional)
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

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

function Harness({ initial }: { initial: boolean }) {
  const [checked, setChecked] = useState(initial)
  return (
    <form>
      <CheckboxWithLabel
        label="ใช้ที่อยู่จัดส่งเป็นที่อยู่สำหรับออกใบเสร็จ"
        name="same_as_billing"
        checked={checked}
        onChange={() => setChecked(!checked)}
        data-testid="billing-address-checkbox"
      />
    </form>
  )
}

const form = () => container.querySelector("form")!
const box = () => container.querySelector<HTMLElement>('[data-testid="billing-address-checkbox"]')!

describe("CheckboxWithLabel (shadcn Checkbox)", () => {
  it("testid อยู่บน root ของ shadcn ที่เป็น role=checkbox และสถานะตาม checked", () => {
    act(() => root.render(<Harness initial />))
    expect(box().getAttribute("data-slot")).toBe("checkbox")
    expect(box().getAttribute("role")).toBe("checkbox")
    expect(box().getAttribute("aria-checked")).toBe("true")
  })

  it('ติ๊ก → FormData มี same_as_billing="on"; กดอีกครั้ง → ไม่มีค่า', () => {
    act(() => root.render(<Harness initial />))
    expect(new FormData(form()).get("same_as_billing")).toBe("on")
    act(() => box().click())
    expect(box().getAttribute("aria-checked")).toBe("false")
    expect(new FormData(form()).get("same_as_billing")).toBeNull()
  })

  // qa #353 D-1: React 19 reset `<form action>` หลัง action คืน error — ค่าที่ผู้ใช้เลือกต้องคงอยู่ทั้งบนจอและใน FormData
  it("ไม่ติ๊กแล้ว form.reset() → ยังไม่ติ๊กและ FormData ไม่มี same_as_billing", () => {
    act(() => root.render(<Harness initial />))
    act(() => box().click())
    act(() => form().reset())
    expect(box().getAttribute("aria-checked")).toBe("false")
    expect(new FormData(form()).get("same_as_billing")).toBeNull()
  })

  it("กด label → สลับค่า (htmlFor ชี้ id ของ checkbox)", () => {
    act(() => root.render(<Harness initial={false} />))
    act(() => container.querySelector("label")!.click())
    expect(box().getAttribute("aria-checked")).toBe("true")
  })
})
