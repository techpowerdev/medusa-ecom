import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

// EV-7e (spec 02 กฎข้อ 29a/29b, AC-43): หน้า /account/vouchers แบ่งหน้าละ 20 (`?page=`) และ voucher-card แสดง support_contact
const listCustomerEvouchers = vi.fn()

vi.mock("@lib/data/evouchers", () => ({
  listCustomerEvouchers: (...a: unknown[]) => listCustomerEvouchers(...a),
}))

const voucher = (i: number, support_contact: string | null = null) => ({
  id: `evc_${i}`,
  code: `CODE-${i}`,
  pin: null,
  expires_at: null,
  delivered_at: null,
  order_id: "order_1",
  pool: { name: "Pool", face_value: 500, validity_note: null, how_to_use: "แสดง code" },
  partner: { name: "Partner", logo_url: null, terms_url: "javascript:alert(1)", support_contact },
})

const renderPage = async (page?: string) => {
  const { default: Vouchers } = await import("./app/[countryCode]/(main)/account/@dashboard/vouchers/page")
  return renderToStaticMarkup(
    await Vouchers({ searchParams: Promise.resolve(page === undefined ? {} : { page }) })
  )
}

const count = (html: string, testId: string) =>
  html.match(new RegExp(`data-testid="${testId}"`, "g"))?.length ?? 0

describe("หน้า vouchers แบ่งหน้า (กฎข้อ 29a)", () => {
  beforeEach(() => listCustomerEvouchers.mockReset())

  it("หน้าแรกขอ limit 20 offset 0 และมีปุ่ม vouchers-next เมื่อ count > 20", async () => {
    listCustomerEvouchers.mockResolvedValue({
      evouchers: Array.from({ length: 20 }, (_, i) => voucher(i)),
      count: 25,
    })
    const html = await renderPage()
    expect(listCustomerEvouchers).toHaveBeenCalledWith(20, 0)
    expect(count(html, "voucher-card")).toBe(20)
    expect(html).toMatch(/<a[^>]*href="\?page=2"[^>]*data-testid="vouchers-next"|data-testid="vouchers-next"[^>]*href="\?page=2"/)
    expect(count(html, "vouchers-prev")).toBe(0)
  })

  it("?page=2 ขอ offset 20, มี vouchers-prev ไปหน้า 1 และไม่มี vouchers-next", async () => {
    listCustomerEvouchers.mockResolvedValue({
      evouchers: Array.from({ length: 5 }, (_, i) => voucher(20 + i)),
      count: 25,
    })
    const html = await renderPage("2")
    expect(listCustomerEvouchers).toHaveBeenCalledWith(20, 20)
    expect(count(html, "voucher-card")).toBe(5)
    expect(count(html, "vouchers-prev")).toBe(1)
    expect(count(html, "vouchers-next")).toBe(0)
  })

  it("ไม่เกิน 20 รายการ → ไม่มีปุ่มแบ่งหน้า", async () => {
    listCustomerEvouchers.mockResolvedValue({ evouchers: [voucher(1)], count: 1 })
    const html = await renderPage()
    expect(count(html, "vouchers-prev") + count(html, "vouchers-next")).toBe(0)
  })
})

describe("voucher-card (กฎข้อ 29b, 26)", () => {
  beforeEach(() => listCustomerEvouchers.mockReset())

  it("แสดง support_contact เมื่อ partner มี และไม่แสดงเมื่อไม่มี", async () => {
    listCustomerEvouchers.mockResolvedValue({
      evouchers: [voucher(1, "โทร 02-000-0000"), voucher(2)],
      count: 2,
    })
    const html = await renderPage()
    expect(count(html, "voucher-support-contact")).toBe(1)
    expect(html).toContain("โทร 02-000-0000")
  })

  it("ไม่มี <a> ที่ href ขึ้นต้น javascript: บนหน้า", async () => {
    listCustomerEvouchers.mockResolvedValue({ evouchers: [voucher(1)], count: 1 })
    expect(await renderPage()).not.toMatch(/href="\s*javascript:/i)
  })
})
