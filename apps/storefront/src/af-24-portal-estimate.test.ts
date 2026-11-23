import fs from "node:fs"
import path from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PortalProduct } from "@lib/data/affiliate-portal"

// AF-24 (spec 05 กฎ 48, AC-56): การ์ดแสดงยอดประมาณการจาก API (ราคาก่อน VAT) ไม่คำนวณเองที่ storefront
// และ Earnings บอกว่ายอดรอตรวจสอบหักรายการยกเลิก/คืนเงินแล้ว (กฎ 48b)
const fetchMock = vi.fn()
vi.mock("@lib/config", () => ({ sdk: { client: { fetch: (...a: unknown[]) => fetchMock(...a) } } }))
// CORE-84: medusa-fetch (server-only) ถูก import โดย data function ของ affiliate/group buy — test นี้ไม่เรียก
vi.mock("@lib/data/medusa-fetch", () => ({ medusaFetch: vi.fn() }))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "_affiliate_jwt" ? { value: "tok" } : undefined) }),
}))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  },
}))

const THAI = /[฀-๿]/
const SRC = __dirname

const item = (estimate: PortalProduct["estimate"], amounts = [590]): PortalProduct => ({
  product: {
    id: "prod_1",
    title: "เสื้อ",
    handle: "shirt",
    thumbnail: null,
    variants: amounts.map((amount, i) => ({
      id: `var_${i}`,
      calculated_price: { calculated_amount: amount, currency_code: "thb" },
    })),
  },
  program: {
    id: "prog_1",
    name: "โปรแกรม",
    starts_at: "2026-10-01T00:00:00Z",
    ends_at: "2026-12-31T00:00:00Z",
    commission_value: 10,
  },
  rate_varies: false,
  estimate,
  share_url: "https://shop.test/r/ANN?p=shirt",
})

const renderCard = async (product: PortalProduct) => {
  const { default: Card } = await import("@modules/affiliate/components/product-card")
  return renderToStaticMarkup(createElement(Card, { item: product, tab: "active" }))
}

const textOf = (html: string, id: string) =>
  html.match(new RegExp(`data-testid="${id}"[^>]*>([\\s\\S]*?)</p>`))?.[1]?.replace(/<[^>]+>/g, "")

describe("การ์ดสินค้า: ยอดประมาณการจาก API (กฎ 48a)", () => {
  it("฿590 รวม VAT อัตรา 10% → แสดง ฿55.14 ตามที่ API ให้ ไม่ใช่ ฿59 ที่คิดจากราคารวม VAT", async () => {
    const html = await renderCard(item({ amount: 55.14, currency_code: "thb", excludes_tax: true }))
    const estimate = textOf(html, "affiliate-estimate")
    expect(estimate).toContain("฿55.14")
    expect(estimate).not.toContain("฿59")
    expect(textOf(html, "affiliate-estimate-basis")).toMatch(THAI)
    expect(textOf(html, "affiliate-estimate-basis")).toContain("VAT")
  })

  it("ไม่มีราคาก่อน VAT (excludes_tax=false) → ยอดจาก API และไม่มีป้าย 'คิดจากราคาก่อน VAT'", async () => {
    const html = await renderCard(item({ amount: 59, currency_code: "thb", excludes_tax: false }))
    expect(textOf(html, "affiliate-estimate")).toContain("฿59")
    expect(html).not.toContain("affiliate-estimate-basis")
  })

  it("estimate=null → ไม่มี affiliate-estimate", async () => {
    expect(await renderCard(item(null))).not.toContain("affiliate-estimate")
  })

  it("การ์ดไม่มีคณิตเงินเอง: ไม่ import estimateCommission และ util ไม่มีฟังก์ชันนี้แล้ว", () => {
    const card = fs.readFileSync(path.join(SRC, "modules/affiliate/components/product-card/index.tsx"), "utf8")
    expect(card).not.toMatch(/estimateCommission|commission_value\s*[*/]/)
    const util = fs.readFileSync(path.join(SRC, "lib/util/affiliate-portal.ts"), "utf8")
    expect(util).not.toContain("estimateCommission")
  })
})

describe("Earnings: ยอดรอตรวจสอบสุทธิ (กฎ 48b)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("ใต้ affiliate-earnings-pending มีข้อความไทยว่าหักรายการยกเลิก/คืนเงินแล้ว และแสดงยอดตาม API", async () => {
    const ann = { id: "aff_1", email: "ann@x.th", name: "Ann", code: "ANN", status: "active", has_payout_info: true }
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/affiliate/me") return { affiliate: ann }
      if (url === "/affiliate/me/earnings") {
        return { totals: [{ currency: "thb", status: "pending", amount: 40.1, count: 2 }] }
      }
      throw new Error(`unexpected ${url}`)
    })
    const { default: Page } = await import("./app/[countryCode]/(main)/affiliate/earnings/page")
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ countryCode: "th" }) }))
    const pending = html.match(/data-testid="affiliate-earnings-pending"[\s\S]*?<\/div>/)?.[0] ?? ""
    expect(pending).toContain("฿40.10")
    const note = pending.match(/data-testid="affiliate-earnings-pending-note"[^>]*>(.*?)<\/dd>/)?.[1]
    expect(note).toMatch(THAI)
    expect(note).toContain("หักรายการยกเลิก/คืนเงินแล้ว")
  })
})
