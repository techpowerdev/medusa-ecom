import { readFileSync } from "node:fs"
import path from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-92 (spec 01 กฎข้อ 148, AC-189): overview ที่มีแต่ membership กลุ่ม, GB-8 limit=1 จาก overview,
// a11y ของ `SearchPagination` บน /store และไม่มี eslint-disable ใน orders/page.tsx
const THAI = /[\u0E00-\u0E7F]/

const retrieveCustomer = vi.fn()
const listOrders = vi.fn()
const listGroupBuyMemberships = vi.fn()
const usePagination = vi.fn()

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound")
  },
  redirect: () => {
    throw new Error("redirect")
  },
  useParams: () => ({ countryCode: "th" }),
}))
vi.mock("@lib/data/customer", () => ({
  retrieveCustomer: () => retrieveCustomer(),
}))
vi.mock("@lib/data/orders", () => ({
  listOrders: (...a: unknown[]) => listOrders(...a),
}))
vi.mock("@lib/data/group-buy", () => ({
  listGroupBuyMemberships: (...a: unknown[]) => listGroupBuyMemberships(...a),
}))
vi.mock("@modules/account/components/add-variant-error", () => ({
  default: () => null,
}))
vi.mock("react-instantsearch", () => ({
  usePagination: (...a: unknown[]) => usePagination(...a),
}))

const count = (html: string, testId: string) =>
  html.match(new RegExp(`data-testid="${testId}"`, "g"))?.length ?? 0

const renderOverview = async () => {
  const { default: OverviewTemplate } = await import(
    "./app/[countryCode]/(main)/account/@dashboard/page"
  )
  return renderToStaticMarkup(
    await OverviewTemplate({
      params: Promise.resolve({ countryCode: "th" }),
      searchParams: Promise.resolve({}),
    })
  )
}

describe("overview ของบัญชี (กฎข้อ 148a/148b)", () => {
  beforeEach(() => {
    retrieveCustomer
      .mockReset()
      .mockResolvedValue({
        id: "cus_1",
        first_name: "ก",
        email: "a@b.c",
        addresses: [],
      })
    listOrders.mockReset()
    listGroupBuyMemberships.mockReset()
  })

  it("มีแต่ membership กลุ่ม → ไม่มี no-orders-message แต่มีลิงก์ ดูทั้งหมด", async () => {
    listOrders.mockResolvedValue({ orders: [], count: 0 })
    listGroupBuyMemberships.mockResolvedValue({
      memberships: [{ id: "m_1" }],
      count: 1,
    })
    const html = await renderOverview()
    expect(count(html, "overview-orders-view-all")).toBe(1)
    expect(count(html, "no-orders-message")).toBe(0)
  })

  it("ไม่มีทั้ง order และ membership → แสดง no-orders-message ไม่มีลิงก์ ดูทั้งหมด", async () => {
    listOrders.mockResolvedValue({ orders: [], count: 0 })
    listGroupBuyMemberships.mockResolvedValue({ memberships: [], count: 0 })
    const html = await renderOverview()
    expect(count(html, "no-orders-message")).toBe(1)
    expect(count(html, "overview-orders-view-all")).toBe(0)
  })

  it("GB-8 อ่านล้ม (null) → คงพฤติกรรมเดิม แสดง no-orders-message", async () => {
    listOrders.mockResolvedValue({ orders: [], count: 0 })
    listGroupBuyMemberships.mockResolvedValue(null)
    const html = await renderOverview()
    expect(count(html, "no-orders-message")).toBe(1)
  })

  it("overview เรียก GB-8 ด้วย limit 1 (ต้องรู้แค่ว่ามี membership หรือไม่)", async () => {
    listOrders.mockResolvedValue({ orders: [], count: 0 })
    listGroupBuyMemberships.mockResolvedValue({ memberships: [], count: 0 })
    await renderOverview()
    expect(listGroupBuyMemberships).toHaveBeenCalledTimes(1)
    expect(listGroupBuyMemberships).toHaveBeenCalledWith(1)
  })
})

describe("SearchPagination ของ /store (กฎข้อ 148c)", () => {
  const renderPagination = async (
    currentRefinement: number,
    pages: number[],
    nbPages: number
  ) => {
    usePagination.mockReturnValue({
      pages,
      currentRefinement,
      nbPages,
      refine: vi.fn(),
      createURL: (page: number) => `/th/store?product%5Bpage%5D=${page + 1}`,
    })
    const { default: SearchPagination } = await import(
      "@modules/store/components/store-hits/pagination"
    )
    return renderToStaticMarkup(createElement(SearchPagination))
  }

  // SFUI-19c (spec 09 กฎ 66): `pagination` ของ shadcn — เลขหน้าเป็นลิงก์ `PaginationLink` ที่มี href ของหน้านั้น
  it("nav มี aria-label ไทย, ลิงก์หน้าปัจจุบันเท่านั้นที่มี aria-current=page, aria-label ของลิงก์เป็นไทย", async () => {
    const html = await renderPagination(1, [0, 1, 2, 3], 4)
    expect(html).toMatch(
      /<nav[^>]*aria-label="แบ่งหน้า"[^>]*data-testid="product-pagination"/
    )
    expect(html).toContain('data-slot="pagination"')
    expect(html).not.toMatch(/<button/)
    const links = html.match(/<a[^>]*>/g) ?? []
    expect(links).toHaveLength(4)
    links.forEach((a, i) => {
      expect(a).toContain('data-slot="pagination-link"')
      expect(a).toContain(`href="/th/store?product%5Bpage%5D=${i + 1}"`)
      const label = a.match(/aria-label="([^"]*)"/)?.[1] ?? ""
      expect(label).toBe(`หน้า ${i + 1}`)
      expect(label).toMatch(THAI)
    })
    expect(links.filter((a) => a.includes('aria-current="page"'))).toEqual([
      expect.stringContaining('aria-label="หน้า 2"'),
    ])
    expect(html).not.toMatch(/Previous|Next|More pages|aria-label="pagination"/)
  })

  it("จุดไข่ปลาซ่อนจาก screen reader", async () => {
    const html = await renderPagination(5, [3, 4, 5, 6, 7], 12)
    const ellipses = html.match(/<span[^>]*>\.\.\.<\/span>/g) ?? []
    expect(ellipses).toHaveLength(2)
    ellipses.forEach((s) => expect(s).toContain('aria-hidden="true"'))
  })
})

describe("orders/page.tsx (กฎข้อ 148d)", () => {
  it("ไม่มี eslint-disable", () => {
    const src = readFileSync(
      path.resolve(
        __dirname,
        "app/[countryCode]/(main)/account/@dashboard/orders/page.tsx"
      ),
      "utf8"
    )
    expect(src).not.toMatch(/eslint-disable/)
  })
})
