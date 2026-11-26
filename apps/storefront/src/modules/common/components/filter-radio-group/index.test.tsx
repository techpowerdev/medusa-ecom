// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import FilterRadioGroup from "./index"

// SFUI-5a (spec 09 กฎ 20): filter/sort ของ store → shadcn RadioGroup — item เป็น `role="radio"` ซ่อนด้วย `sr-only`
// (ไม่ใช่ `hidden` ที่ทำให้ label คลิกไม่ถึง) และคง `radio-label` + `data-active` เดิม
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

const items = [
  { value: "created_at", label: "มาใหม่ล่าสุด" },
  { value: "price_asc", label: "ราคา: ต่ำไปสูง" },
]

describe("FilterRadioGroup (shadcn RadioGroup)", () => {
  it("render radio ของ Radix (sr-only) + radio-label ที่มี data-active ตามค่าที่เลือก", () => {
    act(() =>
      root.render(
        <FilterRadioGroup title="เรียงตาม" items={items} value="price_asc" handleChange={() => {}} data-testid="sort-by-container" />
      )
    )
    const group = container.querySelector('[data-testid="sort-by-container"]')!
    expect(group.getAttribute("role")).toBe("radiogroup")
    const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'))
    expect(radios).toHaveLength(2)
    radios.forEach((r) => {
      expect(r.className).toContain("sr-only")
      expect(r.className).not.toMatch(/(^|\s)hidden(\s|$)/)
    })
    expect(radios[1].getAttribute("aria-checked")).toBe("true")
    const labels = Array.from(group.querySelectorAll('[data-testid="radio-label"]'))
    expect(labels.map((l) => l.getAttribute("data-active"))).toEqual(["false", "true"])
  })

  it("กด label → handleChange(value)", () => {
    const handleChange = vi.fn()
    act(() =>
      root.render(<FilterRadioGroup title="เรียงตาม" items={items} value="price_asc" handleChange={handleChange} />)
    )
    act(() => container.querySelectorAll<HTMLElement>('[data-testid="radio-label"]')[0].click())
    expect(handleChange).toHaveBeenCalledWith("created_at")
  })
})
