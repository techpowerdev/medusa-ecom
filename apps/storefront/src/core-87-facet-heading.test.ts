import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-87 (spec 01 กฎข้อ 143, AC-184): หัว facet ของ option บน `/store` ต้องไม่แสดงจำนวนที่ขัดกับค่าย่อย
// ผล facet ของ `POST /store/search` มีแค่ key `option_values` แบบ "<option>:<ค่า>" → ไม่มีจำนวนสินค้าต่อ option
// จึงไม่แสดงตัวเลขที่หัว (ห้ามรวมจากค่าย่อย เพราะสินค้าหนึ่งมีหลายค่า)
type Item = { label: string; value: string; count: number; isRefined: boolean }
let items: Item[] = []
vi.mock("@lib/config", () => ({ sdk: {} }))
vi.mock("react-instantsearch", () => ({
  useRefinementList: () => ({ items, refine: () => undefined }),
}))

const facet = (label: string, count: number, isRefined = false): Item => ({
  label,
  value: label,
  count,
  isRefined,
})

const render = async () => {
  const { default: OptionRefinements } = await import(
    "@modules/store/components/store-refinements/option-refinements"
  )
  return renderToStaticMarkup(createElement(OptionRefinements))
}

// หัว facet = ปุ่ม trigger ของ Accordion (มี aria-expanded) ส่วนปุ่มค่าย่อยมี aria-pressed
const headings = (html: string) =>
  Array.from(
    html.matchAll(/<button[^>]*aria-expanded[^>]*>(.*?)<\/button>/g),
    ([, inner]) => inner.replace(/<[^>]+>/g, "").trim()
  )

describe("CORE-87: หัว facet option ไม่แสดงจำนวนผิด", () => {
  beforeEach(() => {
    items = []
  })

  it('สินค้า 2 ชิ้น option "ขนาด" ค่า F 3 / L 2 → หัวเป็น "ขนาด" ไม่มี "(0)"', async () => {
    items = [facet("ขนาด:F", 3), facet("ขนาด:L", 2)]
    const html = await render()
    expect(headings(html)).toEqual(["ขนาด"])
    expect(html).not.toContain("(0)")
    // ค่าย่อยยังแสดงจำนวนจาก facet ตามเดิม
    expect(html).toContain("(3)")
    expect(html).toContain("(2)")
  })

  it("เลือกค่าแล้ว หัวก็ไม่แสดงจำนวนค่าที่เลือก (ไม่ใช่จำนวนสินค้า)", async () => {
    items = [facet("ขนาด:F", 2, true), facet("ขนาด:L", 1), facet("สี:แดง", 2)]
    const html = await render()
    expect(headings(html)).toEqual(["ขนาด", "สี"])
  })
})
