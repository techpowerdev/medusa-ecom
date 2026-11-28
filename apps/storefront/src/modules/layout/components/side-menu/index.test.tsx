// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useParams: () => ({ countryCode: "th" }),
  usePathname: () => "/th",
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@lib/data/cart", () => ({ updateRegion: vi.fn() }))

// SFUI-20c (spec 09 กฎ 72, AC-64 — ADR-034 D6): เมนูข้าง — ประเทศรวมทุก region ≤ 1 → ไม่มีตัวเลือก region (`country-select-button`)
// และลูกศร `country-select-arrow`; ≥ 2 → แสดงตามเดิม (render จริง — เปิด Sheet ด้วยการคลิก `nav-menu-button`)
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

const region = (id: string, countries: [string, string][]) =>
  ({ id, countries: countries.map(([iso_2, display_name]) => ({ iso_2, display_name })) }) as never

const open = async (regions: unknown) => {
  const { default: SideMenu } = await import("./index")
  await act(async () => {
    root.render(createElement(SideMenu, { regions, storeName: "ร้าน" } as never))
  })
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-testid="nav-menu-button"]')!.click()
  })
  expect(document.querySelector('[data-testid="nav-menu-popup"]'), "Sheet เปิด").not.toBeNull()
}
const has = (id: string) => document.querySelector(`[data-testid="${id}"]`) !== null

describe("SideMenu ตัวเลือก region (กฎ 72)", () => {
  it("region เดียว ประเทศเดียว → ไม่มี country-select-button และ country-select-arrow", async () => {
    await open([region("reg_th", [["th", "Thailand"]])])
    expect(has("country-select-button")).toBe(false)
    expect(has("country-select-arrow")).toBe(false)
  })

  it("ไม่มี region → ไม่มีตัวเลือก", async () => {
    await open(null)
    expect(has("country-select-button")).toBe(false)
    expect(has("country-select-arrow")).toBe(false)
  })

  it("รวม 2 ประเทศ (คนละ region) → แสดง country-select-button และ country-select-arrow ตามเดิม", async () => {
    await open([region("reg_th", [["th", "Thailand"]]), region("reg_sg", [["sg", "Singapore"]])])
    expect(has("country-select-button")).toBe(true)
    expect(has("country-select-arrow")).toBe(true)
  })

  it("region เดียว 2 ประเทศ → แสดง", async () => {
    await open([region("reg_sea", [["th", "Thailand"], ["sg", "Singapore"]])])
    expect(has("country-select-button")).toBe(true)
  })
})
