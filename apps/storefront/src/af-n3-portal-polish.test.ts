import fs from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { pageOutOfRange } from "@lib/util/affiliate-portal"

// AF-N3 (spec 05 กฎ 40, AC-47): สกุลเงินของ Earnings, เครื่องหมาย − ของยอดติดลบ, component คัดลอก/แชร์เดียว,
// หน้าเกินจำนวนของ Programs/Payouts
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

const SRC = __dirname
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8")
const THAI = /[฀-๿]/
const MINUS = "−"
const ann = { id: "aff_1", email: "ann@x.th", name: "Ann", code: "ANN", status: "active", has_payout_info: true }
const params = Promise.resolve({ countryCode: "th" })

const mockApi = (byUrl: Record<string, unknown>) =>
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "/affiliate/me") return { affiliate: ann }
    if (url in byUrl) return byUrl[url]
    throw new Error(`unexpected ${url}`)
  })

/** ข้อความภายใน element ที่มี data-testid (ไม่รวม tag ซ้อน) */
const texts = (html: string, id: string) =>
  Array.from(html.matchAll(new RegExp(`data-testid="${id}"[^>]*>([\\s\\S]*?)</div>`, "g"))).map((m) =>
    m[1].replace(/<[^>]+>/g, "|")
  )

// ห้ามคืนค่า mock จาก hook (vitest เรียกค่าที่คืนเป็น cleanup)
beforeEach(() => {
  fetchMock.mockReset()
})

describe("Earnings: สกุลเงินตาม API (กฎ 40a)", () => {
  it.each([
    "app/[countryCode]/(main)/affiliate/earnings/page.tsx",
    "lib/util/affiliate-portal.ts",
  ])("%s ไม่มี literal \"thb\"", (rel) => {
    expect(read(rel)).not.toMatch(/["'`]thb["'`]/i)
  })

  const renderEarnings = async (totals: unknown[]) => {
    mockApi({ "/affiliate/me/earnings": { totals } })
    const { default: Page } = await import("./app/[countryCode]/(main)/affiliate/earnings/page")
    return renderToStaticMarkup(await Page({ params }))
  }

  it("แสดงสกุลตาม currency ของแถวที่ API คืน (usd ไม่กลายเป็น ฿)", async () => {
    const html = await renderEarnings([{ status: "paid", amount: 5, currency: "usd", count: 1 }])
    const paid = texts(html, "affiliate-earnings-paid")[0]
    expect(paid).toContain("US$")
    expect(paid).not.toContain("฿")
  })

  it("สถานะที่ไม่มีแถว → 0 ในสกุลของร้าน (STORE_CURRENCY_CODE)", async () => {
    const html = await renderEarnings([])
    expect(texts(html, "affiliate-earnings-pending")[0]).toContain("฿0")
  })

  it("ยอด reversed ติดลบขึ้นต้นด้วย − (U+2212) ไม่ใช่ hyphen (กฎ 40d)", async () => {
    const html = await renderEarnings([{ status: "reversed", amount: -20.5, currency: "thb", count: 1 }])
    const amount = html.match(/data-testid="affiliate-earnings-reversed"[\s\S]*?<dd[^>]*>(.*?)<\/dd>/)?.[1]
    expect(amount?.startsWith(MINUS)).toBe(true)
    expect(amount).toContain("฿20.50")
    expect(amount).not.toContain("-")
  })
})

describe("ปุ่มคัดลอก/แชร์ใช้ component เดียว (กฎ 40b)", () => {
  const importOf = (rel: string) =>
    read(rel).match(/import\s+\w+\s+from\s+"([^"]*(?:share|copy)[^"]*)"/)?.[1]?.replace(/^\.\.\//, "@modules/affiliate/components/")

  it("Profile และการ์ด Products import component เดียวกัน", () => {
    const profile = importOf("app/[countryCode]/(main)/affiliate/profile/page.tsx")
    const card = importOf("modules/affiliate/components/product-card/index.tsx")
    expect(profile).toBeDefined()
    expect(profile).toBe(card)
  })

  it("ไม่มี component คัดลอก/แชร์ตัวเก่าค้าง", () => {
    expect(fs.existsSync(path.join(SRC, "modules/affiliate/components/copy-link-button"))).toBe(false)
    expect(fs.existsSync(path.join(SRC, "modules/affiliate/components/share-button"))).toBe(false)
  })
})

describe("pageOutOfRange (กฎ 40c)", () => {
  it.each([
    [1, 50, 0, false], // หน้าแรกว่าง = ยังไม่มีรายการ
    [2, 50, 0, true],
    [2, 50, 50, true],
    [2, 50, 51, false],
    [99, 50, 120, true],
    [3, 50, 120, false],
  ])("page %s limit %s count %s → %s", (page, limit, count, expected) => {
    expect(pageOutOfRange(page, limit, count)).toBe(expected)
  })
})

describe("หน้าเกินจำนวนของ Programs/Payouts (กฎ 40c)", () => {
  const cases = [
    ["Programs", "./app/[countryCode]/(main)/affiliate/programs/page", "/affiliate/me/programs", "programs"],
    ["Payouts", "./app/[countryCode]/(main)/affiliate/payouts/page", "/affiliate/me/payouts", "payouts"],
  ] as const

  it.each(cases)("%s ?page=99 → affiliate-page-out-of-range ภาษาไทย + ลิงก์หน้าแรก", async (_n, mod, api, key) => {
    mockApi({ [api]: { [key]: [], count: 3, limit: 50, offset: 4900 } })
    const { default: Page } = await import(/* @vite-ignore */ mod)
    const html = renderToStaticMarkup(await Page({ params, searchParams: Promise.resolve({ page: "99" }) }))
    const block = html.match(/data-testid="affiliate-page-out-of-range"[\s\S]*?<\/div>/)?.[0]
    expect(block).toBeDefined()
    expect(block).toMatch(THAI)
    expect(block).toMatch(new RegExp(`href="/th/affiliate/${key}"`))
    expect(html).not.toContain(`affiliate-${key}-empty`)
  })

  it.each(cases)("%s หน้าแรกว่าง → ยังแสดงข้อความ ยังไม่มี… เดิม", async (_n, mod, api, key) => {
    mockApi({ [api]: { [key]: [], count: 0, limit: 50, offset: 0 } })
    const { default: Page } = await import(/* @vite-ignore */ mod)
    const html = renderToStaticMarkup(await Page({ params, searchParams: Promise.resolve({}) }))
    expect(html).toContain(`affiliate-${key}-empty`)
    expect(html).not.toContain("affiliate-page-out-of-range")
  })
})
