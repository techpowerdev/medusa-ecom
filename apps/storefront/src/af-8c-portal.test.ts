import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PortalProduct } from "@lib/data/affiliate-portal"

// AF-8c (spec 05 กฎ 35, 36, AC-41): การ์ด rate_varies ไม่แสดงยอดประมาณการ และ backend ล่ม → affiliate-portal-error
const fetchMock = vi.fn()
vi.mock("@lib/config", () => ({ sdk: { client: { fetch: (...a: unknown[]) => fetchMock(...a) } } }))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "_affiliate_jwt" ? { value: "tok" } : undefined) }),
}))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  },
}))

const THAI = /[฀-๿]/
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status })

const item = (rate_varies: boolean, amounts: number[]): PortalProduct => ({
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
  rate_varies,
  share_url: "https://shop.test/r/ANN?p=shirt",
})

const renderCard = async (product: PortalProduct) => {
  const { default: Card } = await import("@modules/affiliate/components/product-card")
  return renderToStaticMarkup(createElement(Card, { item: product, tab: "active" }))
}

const testIdText = (html: string, id: string) => html.match(new RegExp(`data-testid="${id}"[^>]*>(.*?)</p>`))?.[1]

describe("การ์ดสินค้า (กฎ 35)", () => {
  it("rate_varies=true → ไม่มี affiliate-estimate แต่มี affiliate-rate-varies", async () => {
    const html = await renderCard(item(true, [100, 200]))
    expect(html).not.toContain("affiliate-estimate")
    expect(html).toContain('data-testid="affiliate-rate-varies"')
  })

  it("rate_varies=false variant 100/200 อัตรา 10% → affiliate-estimate ฿10 ขึ้นต้น ตั้งแต่", async () => {
    const estimate = testIdText(await renderCard(item(false, [100, 200])), "affiliate-estimate")
    expect(estimate).toContain("ตั้งแต่")
    expect(estimate).toContain("฿10")
  })

  it("rate_varies=false ราคาเดียว → ไม่มี ตั้งแต่", async () => {
    const estimate = testIdText(await renderCard(item(false, [100, 100])), "affiliate-estimate")
    expect(estimate).toContain("฿10")
    expect(estimate).not.toContain("ตั้งแต่")
  })
})

describe("backend ล่ม (กฎ 36b)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  const params = Promise.resolve({ countryCode: "th" })
  const failures = [
    ["network", new TypeError("fetch failed")],
    ["5xx", httpError(503)],
  ] as const

  it.each(failures)("data function: %s → reject (ไม่กลืนเป็น null แบบ 401)", async (_, error) => {
    fetchMock.mockRejectedValue(error)
    const { getAffiliate } = await import("@lib/data/affiliate-portal")
    await expect(getAffiliate()).rejects.toBe(error)
  })

  it("401 → null (redirect ไป login ตามเดิม)", async () => {
    fetchMock.mockRejectedValue(httpError(401))
    const { getAffiliate } = await import("@lib/data/affiliate-portal")
    await expect(getAffiliate()).resolves.toBeNull()
  })

  const hasPortalError = (html: string) => {
    expect(html).toContain('data-testid="affiliate-portal-error"')
    expect(html).toMatch(/<a[^>]*data-testid="affiliate-portal-retry"/)
    expect(html.match(/data-testid="affiliate-portal-error"[\s\S]*/)?.[0]).toMatch(THAI)
  }

  it.each(failures)("layout: /affiliate/me ล้มแบบ %s → render affiliate-portal-error แทนเนื้อหา", async (_, error) => {
    fetchMock.mockRejectedValue(error)
    const { default: Layout } = await import("./app/[countryCode]/(main)/affiliate/layout")
    const html = renderToStaticMarkup(await Layout({ children: createElement("main", { id: "page" }), params }))
    hasPortalError(html)
    expect(html).not.toContain('id="page"')
  })

  const ann = { id: "aff_1", email: "ann@x.th", name: "Ann", code: "ANN", status: "active", has_payout_info: true }
  const pages = [
    ["Products", "./app/[countryCode]/(main)/affiliate/page", "/affiliate/products"],
    ["Programs", "./app/[countryCode]/(main)/affiliate/programs/page", "/affiliate/me/programs"],
    ["Earnings", "./app/[countryCode]/(main)/affiliate/earnings/page", "/affiliate/me/earnings"],
    ["Payouts", "./app/[countryCode]/(main)/affiliate/payouts/page", "/affiliate/me/payouts"],
  ] as const

  describe.each(failures)("%s", (_, error) => {
    it.each(pages)("หน้า %s: API ของหน้าล้ม → render affiliate-portal-error", async (_name, path, api) => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url === "/affiliate/me") {
          return { affiliate: ann }
        }
        expect(url).toBe(api)
        throw error
      })
      const { default: Page } = await import(/* @vite-ignore */ path)
      hasPortalError(renderToStaticMarkup(await Page({ params, searchParams: Promise.resolve({}) })))
    })
  })

  it("403 ตามสถานะยังแสดง affiliate-status-notice ไม่ใช่ affiliate-portal-error", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/affiliate/me") {
        return { affiliate: { ...ann, status: "suspended" } }
      }
      throw httpError(403)
    })
    const { default: Page } = await import("./app/[countryCode]/(main)/affiliate/programs/page")
    const html = renderToStaticMarkup(await Page({ params, searchParams: Promise.resolve({}) }))
    expect(html).toContain("affiliate-status-notice")
    expect(html).not.toContain("affiliate-portal-error")
  })
})
