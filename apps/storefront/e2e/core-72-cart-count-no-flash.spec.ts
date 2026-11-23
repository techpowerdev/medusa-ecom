import type { APIRequestContext, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  adminHeaders,
  createCustomer,
  ok,
  publishableKey,
  signInAs,
  variantOf,
} from "./support/medusa"
import { isServerAction } from "./support/server-action"

// CORE-72 (spec 01 กฎข้อ 130, AC-171): nav-cart-link ไม่แสดง "(0)" ระหว่างโหลด — render แรกเป็น "ตะกร้า" (aria-busy="true")
// จนรู้จำนวนจริง; ตะกร้าว่างจริงจึงแสดง "(0)"
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-72" } })

const QUANTITY = 2
const DELAY_MS = 2_000

type Seen = { text: string; busy: string | null }

/**
 * เก็บข้อความ + aria-busy ของ nav-cart-link ทุก mutation ตั้งแต่ document เริ่ม parse (รวม Suspense fallback ใน HTML แรก
 * ที่ถูกแทนก่อน Playwright อ่านทัน) — เก็บจาก node ที่ถูกเพิ่มด้วย เพราะ fallback อาจถูกถอดออกไปแล้วตอน callback รัน
 */
const recordNavCartLink = (page: Page) =>
  page.addInitScript(() => {
    const seen: { text: string; busy: string | null }[] = []
    ;(window as unknown as { __core72Seen: typeof seen }).__core72Seen = seen
    // fallback ของ Suspense ใช้ testid nav-cart-link-loading (ไม่ซ้อนกับตัวจริงระหว่าง stream) — ต้องไม่แสดง "(0)" เช่นกัน
    const SELECTOR = '[data-testid="nav-cart-link"], [data-testid="nav-cart-link-loading"]'
    const push = (el: Element) => seen.push({ text: el.textContent ?? "", busy: el.getAttribute("aria-busy") })
    const visit = (node: Node) => {
      if (!(node instanceof Element)) return
      if (node.matches(SELECTOR)) push(node)
      node.querySelectorAll(SELECTOR).forEach(push)
    }
    new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach(visit)
        const target = r.target instanceof Element ? r.target : r.target.parentElement
        const link = target?.closest(SELECTOR)
        if (link) push(link)
      }
    }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true })
  })

const seenTexts = (page: Page) =>
  page.evaluate(() => (window as unknown as { __core72Seen: Seen[] }).__core72Seen)

/** หน่วง server action (cart ที่ CartDropdown โหลดใน browser) 2 วินาที — request อื่นผ่านตามปกติ */
const delayServerActions = (page: Page) =>
  page.route("**/*", async (route) => {
    if (isServerAction(route.request())) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
    }
    await route.fallback()
  })

async function customerWithCart(request: APIRequestContext, quantity: number) {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  if (quantity === 0) return { customer, cartId: undefined }
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const { regions } = await ok(await request.get(`${BACKEND_URL}/store/regions`, { headers }), "store regions")
  const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === CC))
  const { cart } = await ok(
    await request.post(`${BACKEND_URL}/store/carts`, { headers, data: { region_id: region.id } }),
    "create cart"
  )
  const { variantId } = await variantOf(request, pk, "t-shirt")
  await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cart.id}/line-items`, {
      headers,
      data: { variant_id: variantId, quantity },
    }),
    "add line item"
  )
  return { customer, cartId: cart.id as string }
}

async function openAs(page: Page, baseURL: string, customer: Customer, cartId: string | undefined) {
  await signInAs(page.context(), baseURL, customer)
  if (cartId) await page.context().addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL }])
  await recordNavCartLink(page)
  await delayServerActions(page)
  await page.goto(`/${CC}`)
}

test("AC-171: ลูกค้ามี 2 ชิ้น + cart โหลดช้า 2 วินาที → ระหว่างรอไม่มี \"(0)\" หลังโหลดเป็น \"(2)\"", async ({
  page,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const { customer, cartId } = await customerWithCart(request, QUANTITY)
  await openAs(page, baseURL!, customer, cartId)

  await step(`หลังโหลด nav-cart-link = "ตะกร้า (${QUANTITY})" และไม่ busy`, async () => {
    await expect(page.getByTestId("nav-cart-link")).toHaveText(`ตะกร้า (${QUANTITY})`, { timeout: 15_000 })
    await expect(page.getByTestId("nav-cart-link")).not.toHaveAttribute("aria-busy", "true")
    await evidence("loaded-count")
  })

  await step('ทุกค่าที่เคยแสดงตั้งแต่ load ไม่มี "(0)"; ก่อนรู้จำนวนเป็น "ตะกร้า" + aria-busy="true"', async () => {
    const seen = await seenTexts(page)
    expect(seen.length, "MutationObserver เห็น nav-cart-link").toBeGreaterThan(0)
    // ยืนยันว่าเห็นช่วงรอจริง (fallback ของ Suspense / cart ที่ยังโหลดใน browser) ไม่ใช่ข้ามไป "(2)" ทันที
    expect(seen.some((s) => s.busy === "true"), JSON.stringify(seen)).toBe(true)
    expect(seen.filter((s) => s.text.includes("(0)")), JSON.stringify(seen)).toEqual([])
    for (const s of seen.filter((s) => !s.text.includes(`(${QUANTITY})`))) {
      expect(s, JSON.stringify(seen)).toEqual({ text: "ตะกร้า", busy: "true" })
    }
  })
})

test('AC-171: ตะกร้าว่างจริง (ไม่มี cart) → แสดง "ตะกร้า (0)" หลังโหลด', async ({ page, request, baseURL, step }) => {
  const { customer } = await customerWithCart(request, 0)
  await openAs(page, baseURL!, customer, undefined)

  await step('nav-cart-link = "ตะกร้า (0)" และไม่ busy', async () => {
    await expect(page.getByTestId("nav-cart-link")).toHaveText("ตะกร้า (0)", { timeout: 15_000 })
    await expect(page.getByTestId("nav-cart-link")).not.toHaveAttribute("aria-busy", "true")
  })
})

/**
 * นับ `[data-testid="nav-cart-link"]` ทั้ง document ทุก mutation ตั้งแต่เริ่ม parse — ช่วง stream Suspense ของ nav
 * fallback ยังอยู่ขณะ content จริงมาถึงใน `<div hidden id="S:n">` (ก่อน `$RC` ของ React สลับ) locator ของ Playwright
 * นับ element ที่ซ่อนด้วย จึงชน strict mode (hotfix: CI ของ #464/#465 ล้มที่ core-50/core-26 "resolved to 2 elements")
 */
const recordNavCartLinkCount = (page: Page) =>
  page.addInitScript(() => {
    const counts: number[] = []
    ;(window as unknown as { __navCartCounts: number[] }).__navCartCounts = counts
    new MutationObserver(() => {
      counts.push(document.querySelectorAll('[data-testid="nav-cart-link"]').length)
    }).observe(document, { childList: true, subtree: true })
  })

const countIn = (html: string) => html.split('data-testid="nav-cart-link"').length - 1

// /store ไม่ cache หน้า → Suspense ของ CartButton stream (HTML แรกมี fallback + content ใน div hidden ครบทั้งคู่)
for (const path of [`/${CC}`, `/${CC}/store`]) {
  test(`hotfix nav-cart-link: ${path} มี element ที่ testid nav-cart-link เพียงตัวเดียวทุกขณะระหว่าง stream`, async ({
    page,
    request,
    baseURL,
    step,
  }) => {
    // ไม่มี cart cookie → CartButton ได้ null และ CartDropdown โหลด cart ใน browser (aria-busy เหมือนใน log CI)
    const { customer } = await customerWithCart(request, 0)
    await signInAs(page.context(), baseURL!, customer)
    await recordNavCartLinkCount(page)

    let html = ""
    await step("HTML ที่ stream มาทั้งก้อนมี nav-cart-link ตัวเดียว (fallback ใช้ testid อื่น)", async () => {
      const res = await page.goto(path)
      html = await res!.text()
      expect.soft(countIn(html), "จำนวน nav-cart-link ใน HTML").toBe(1)
    })

    await step('หลังโหลด nav-cart-link = "ตะกร้า (0)"', async () => {
      await expect(page.getByTestId("nav-cart-link")).toHaveText("ตะกร้า (0)", { timeout: 15_000 })
    })

    await step("ทุก mutation ตั้งแต่ load นับ nav-cart-link ได้ไม่เกิน 1", async () => {
      const counts = await page.evaluate(() => (window as unknown as { __navCartCounts: number[] }).__navCartCounts)
      expect(counts.length, "MutationObserver ทำงาน").toBeGreaterThan(0)
      expect(Math.max(...counts), JSON.stringify(counts.filter((c) => c !== 1).slice(0, 20))).toBeLessThanOrEqual(1)
    })
  })
}
