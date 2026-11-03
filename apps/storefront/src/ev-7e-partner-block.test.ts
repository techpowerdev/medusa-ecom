// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// EV-7e (spec 02 กฎข้อ 29c/29d, AC-43): บล็อกพาร์ทเนอร์บน PDP — HTML จาก server มีบล็อกเดียวของ variant ตั้งต้น,
// อ่าน `v_id` หลัง mount (ไม่มี Suspense fallback ซ้อน) และแสดงเฉพาะ variant ที่ ProductActions เลือกอยู่จริง
const search = vi.hoisted(() => ({ value: "" }))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const pool = (name: string, partner: Partial<{ logo_url: string; terms_url: string }> = {}) => ({
  name: `Pool ${name}`,
  face_value: 500,
  validity_note: null,
  how_to_use: "แสดง code ที่แคชเชียร์",
  partner: { name: `Partner ${name}`, logo_url: null, terms_url: null, ...partner },
})

const variant = (id: string, p: ReturnType<typeof pool> | null, stock = 1) => ({
  id,
  manage_inventory: true,
  allow_backorder: false,
  inventory_quantity: stock,
  evoucher_pool: p,
})

const VARIANTS = [variant("a", pool("A")), variant("b", pool("B")), variant("c", null)]

const blocks = () => document.querySelectorAll('[data-testid="evoucher-partner-block"]')
const partnerName = () =>
  document.querySelector('[data-testid="evoucher-partner-name"]')?.textContent

let container: HTMLDivElement
let root: Root

const Block = async () =>
  (await import("@modules/evoucher/components/partner-block")).default

const render = async (variants = VARIANTS) => {
  const EvoucherPartnerBlock = await Block()
  await act(async () => {
    root.render(createElement(EvoucherPartnerBlock, { variants }))
  })
}

beforeEach(() => {
  search.value = ""
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe("EvoucherPartnerBlock (กฎข้อ 29c)", () => {
  it("HTML จาก server: บล็อกเดียวของ variant ตั้งต้น และไม่อ่าน search params ระหว่าง prerender", async () => {
    search.value = "v_id=b"
    const EvoucherPartnerBlock = await Block()
    const html = renderToString(createElement(EvoucherPartnerBlock, { variants: VARIANTS }))
    expect(html.match(/data-testid="evoucher-partner-block"/g)).toHaveLength(1)
    expect(html).toContain("Partner A")
  })

  it("หลัง mount อ่าน v_id จาก URL → แสดงของ variant นั้น เหลือบล็อกเดียว", async () => {
    search.value = "v_id=b"
    await render()
    expect(blocks()).toHaveLength(1)
    expect(partnerName()).toBe("Partner B")
  })

  it("ยังไม่มี v_id (ProductActions ยังไม่ sync) → variant ตั้งต้น; หลังลูกค้าเลือก option ไม่ครบ (v_id ถูกลบ) → ไม่แสดงบล็อก", async () => {
    await render()
    expect(partnerName()).toBe("Partner A")

    search.value = "v_id=a"
    await render()
    expect(partnerName()).toBe("Partner A")

    search.value = ""
    await render()
    expect(blocks()).toHaveLength(0)
  })

  it("เลือก variant ที่ไม่มี pool → ไม่แสดงบล็อก", async () => {
    search.value = "v_id=c"
    await render()
    expect(blocks()).toHaveLength(0)
  })
})

describe("ลิงก์/รูปของ partner เฉพาะ http(s) (กฎข้อ 26, 29d)", () => {
  it("terms_url javascript: และ logo_url data: (ข้อมูลเก่า) → ไม่ render <a>/<img>", async () => {
    await render([
      variant("a", pool("A", { terms_url: "javascript:alert(1)", logo_url: "data:text/html,x" })),
    ])
    expect(blocks()).toHaveLength(1)
    expect(container.querySelector("a")).toBeNull()
    expect(container.querySelector("img")).toBeNull()
  })

  it("https → render ลิงก์และรูปตามเดิม", async () => {
    await render([
      variant("a", pool("A", { terms_url: "https://example.com/t", logo_url: "https://example.com/l.png" })),
    ])
    expect(container.querySelector('[data-testid="evoucher-terms-link"]')?.getAttribute("href")).toBe(
      "https://example.com/t"
    )
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://example.com/l.png")
  })
})
