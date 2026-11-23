// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-93 (spec 01 กฎข้อ 149, AC-190 — owner Q-C17 = ก 2026-11-24): หัว option ของ `OptionsPicker`
// (refinement-list ของหน้า collection/category) ไม่แสดง `({selectedCount})` แบบเดียวกับกฎข้อ 143
// ตัวเลขเดิมคือจำนวนค่าที่ผู้ใช้เลือก ไม่ใช่จำนวนสินค้า — อ่านผิดเป็น "ขนาด (0)" แบบที่ qa เจอบน `/store`
const fetchMock = vi.hoisted(() => vi.fn())
vi.mock("@lib/config", () => ({ sdk: { client: { fetch: fetchMock } } }))
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const OPTIONS = [
  {
    id: "opt_size",
    title: "ขนาด",
    values: [
      { id: "v_f", value: "F" },
      { id: "v_l", value: "L" },
    ],
  },
  { id: "opt_color", title: "สี", values: [{ id: "v_red", value: "แดง" }] },
]

let container: HTMLDivElement
let root: Root

const render = async (selectedValueIds: string[]) => {
  const { default: OptionsPicker } = await import(
    "@modules/store/components/refinement-list/options-picker"
  )
  await act(async () => {
    root.render(
      createElement(OptionsPicker, {
        selectedValueIds,
        setOptionValueIds: () => undefined,
      })
    )
  })
}

// หัว option = ปุ่ม trigger ของ Accordion (มี aria-expanded) ส่วนปุ่มค่าย่อยมี aria-pressed
const headings = () =>
  Array.from(container.querySelectorAll("button[aria-expanded]"), (el) =>
    (el.textContent ?? "").replace(/\s+/g, "")
  )

describe("CORE-93: หัว option ของ OptionsPicker ไม่แสดงจำนวน", () => {
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ product_options: OPTIONS })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('ยังไม่เลือกค่า → หัวเป็น "ขนาด"/"สี" ไม่มี "(0)"', async () => {
    await render([])
    expect(headings()).toEqual(["ขนาด", "สี"])
    expect(container.textContent).not.toMatch(/\(\d+\)/)
  })

  it("เลือกค่าแล้ว หัวก็ไม่แสดงจำนวนค่าที่เลือก — ค่าย่อยยังบอกสถานะด้วย aria-pressed", async () => {
    await render(["v_f", "v_l"])
    expect(headings()).toEqual(["ขนาด", "สี"])
    expect(container.textContent).not.toMatch(/\(\d+\)/)
    expect(
      container.querySelectorAll('button[aria-pressed="true"]')
    ).toHaveLength(2)
  })
})
