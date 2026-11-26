// @vitest-environment jsdom
import { act, type ReactElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { RadioGroupItem } from "@/components/radio-group"
import { SheetContent } from "@/components/sheet"
import { Slider } from "@/components/slider"
import { RadioGroup, RadioGroupItem as UiRadioGroupItem } from "@/components/ui/radio-group"
import { Sheet, SheetContent as UiSheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Slider as UiSlider } from "@/components/ui/slider"

// SFUI-7 (spec 09 กฎ 3, 9, 10, AC-19): wrapper ใน src/components/* เพิ่มสิ่งที่ primitive ของ CLI ไม่เปิด (overlay testid, ชื่อ thumb,
// children ของ radio) โดย DOM ส่วนอื่นเท่ากับของ shadcn — ถ้า `shadcn add --overwrite` เปลี่ยน class ของ primitive test นี้จะเตือนให้ตามแก้ wrapper
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeAll(() => {
  // Radix Slider วัดขนาด thumb ด้วย ResizeObserver ซึ่ง jsdom ไม่มี
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

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

/** id ที่ React/Radix สุ่ม (useId) ไม่นับในการเทียบ DOM */
const normalize = (html: string) => html.replace(/(id|aria-controls|aria-describedby|aria-labelledby)="[^"]*"/g, '$1=""')

describe("SheetContent (wrapper src/components/sheet.tsx)", () => {
  const sheet = (content: ReactElement) => (
    <Sheet open>
      {content}
    </Sheet>
  )
  const body = (title = "เมนู") => [
    <SheetTitle key="t">{title}</SheetTitle>,
    <SheetDescription key="d">รายละเอียด</SheetDescription>,
  ]
  const portal = () => normalize(document.body.querySelector("[data-slot=sheet-content]")!.parentElement!.innerHTML)

  for (const side of ["left", "right", "top", "bottom"] as const) {
    it(`side="${side}" → DOM เท่ากับ SheetContent ของ shadcn ที่ปิดปุ่มปิดในตัว (wrapper ไม่มีปุ่มนี้)`, () => {
      const props = { side, className: "w-full p-6", "data-testid": "panel" }
      render(sheet(<UiSheetContent {...props} showCloseButton={false}>{body()}</UiSheetContent>))
      const ui = portal()
      act(() => root.unmount())
      root = createRoot(container)
      render(sheet(<SheetContent {...props}>{body()}</SheetContent>))
      expect(portal()).toBe(ui)
    })
  }

  it("overlayProps ถึง overlay (testid side-menu-backdrop ของ side menu เดิม)", () => {
    render(
      sheet(
        <SheetContent side="left" overlayProps={{ "data-testid": "side-menu-backdrop" }}>
          {body()}
        </SheetContent>
      )
    )
    const overlay = document.body.querySelector("[data-slot=sheet-overlay]")!
    expect(overlay.getAttribute("data-testid")).toBe("side-menu-backdrop")
  })
})

describe("Slider (wrapper src/components/slider.tsx)", () => {
  const props = { className: "h-5", value: [10, 90], min: 0, max: 100, step: 1, "aria-label": "ช่วงราคา" }

  it("ไม่ส่ง thumbLabels → DOM เท่ากับ Slider ของ shadcn", () => {
    const ui = normalize(render(<UiSlider {...props} />).innerHTML)
    expect(normalize(render(<Slider {...props} />).innerHTML)).toBe(ui)
  })

  it("thumbLabels → aria-label ของ thumb แต่ละตัวเป็นข้อความที่ส่ง (แทน Minimum/Maximum ของ Radix)", () => {
    const el = render(<Slider {...props} thumbLabels={["ราคาต่ำสุด", "ราคาสูงสุด"]} />)
    const thumbs = Array.from(el.querySelectorAll("[role=slider]"))
    expect(thumbs.map((t) => t.getAttribute("aria-label"))).toEqual(["ราคาต่ำสุด", "ราคาสูงสุด"])
  })
})

describe("RadioGroupItem (wrapper src/components/radio-group.tsx)", () => {
  const group = (item: ReactElement) => (
    <RadioGroup value="a">
      {item}
    </RadioGroup>
  )

  it("ไม่มี children → DOM เท่ากับ RadioGroupItem ของ shadcn", () => {
    const props = { value: "a", className: "w-full", "data-testid": "opt" }
    const ui = normalize(render(group(<UiRadioGroupItem {...props} />)).innerHTML)
    expect(normalize(render(group(<RadioGroupItem {...props} />)).innerHTML)).toBe(ui)
  })

  it("children อยู่ในปุ่ม role=radio ต่อจาก indicator (ชื่อวิธีชำระเป็นชื่อของปุ่ม)", () => {
    const el = render(
      group(
        <RadioGroupItem value="a" data-testid="opt">
          <span>บัตรเครดิต</span>
        </RadioGroupItem>
      )
    )
    const radio = el.querySelector("[role=radio]")!
    expect(radio.getAttribute("data-testid")).toBe("opt")
    expect(radio.textContent).toBe("บัตรเครดิต")
    expect(radio.lastElementChild!.tagName).toBe("SPAN")
    expect(radio.firstElementChild!.getAttribute("data-slot")).toBe("radio-group-indicator")
  })
})
