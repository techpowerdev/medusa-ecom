import crypto from "node:crypto"

import { APIResponse, Locator, Page } from "@playwright/test"

import { deleteAllThenExpectOk } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { continueToReview } from "./support/stripe"
import { THAI, latinWordsOutsideAllowList } from "./support/thai-text"

// CORE-60: spec 01 AC-159 (กฎข้อ 118, Q-C8 = ก) — ป้ายแถวแรกของ cart-totals บอกว่าเป็นยอดก่อนส่วนลดเฉพาะเมื่อมีส่วนลด
// ตัวเลข/แถวคงเดิม (กฎข้อ 115) และที่ 375 จำนวนเงินอยู่บรรทัดเดียวไม่ทับป้าย
// หา element ภายใน cart-totals ด้วย data-testid เท่านั้น (dropdown มี cart-subtotal-label ชื่อเดียวกัน) ไม่ match ประโยคไทยตรงตัว
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-60" }, viewport: { width: 1280, height: 800 } })

const MANUAL = "pp_system_default"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ store API ใน e2e
const ok = async (res: APIResponse, what: string): Promise<any> => {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}

const dataValue = async (el: Locator) => Number(await el.getAttribute("data-value"))

/** ข้อความป้ายใน cart-totals — มีอักษรไทยและไม่มีคำละตินนอกรายการยกเว้น (ADR-014 + ภาคผนวก 2026-11-13) */
async function subtotalLabel(page: Page) {
  const label = page.getByTestId("cart-totals").getByTestId("cart-subtotal-label")
  await expect(label).toHaveCount(1)
  const text = ((await label.textContent()) ?? "").trim()
  expect(text).toMatch(THAI)
  expect(latinWordsOutsideAllowList(text), `"${text}"`).toEqual([])
  return text
}

test("AC-159: ป้ายแถวแรกของ cart-totals เปลี่ยนเมื่อมีส่วนลด ตัวเลขเท่าเดิม และไม่ล้นที่ 375", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(150_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer: Customer = await createCustomer(request, pk)
  const cartId = await cartReadyForPayment(request, pk, customer)
  const store = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const getCart = async () =>
    (await ok(await request.get(`${BACKEND_URL}/store/carts/${cartId}`, { headers: store }), "get cart")).cart
  await signInAs(context, baseURL!, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  let promotionId: string | undefined
  try {
    const totals = page.getByTestId("cart-totals")
    let withoutDiscount = ""

    await step("(a) ไม่มีส่วนลด: ไม่มีแถวส่วนลด และป้ายแถวแรกเป็นไทย", async () => {
      expect(Number((await getCart()).discount_total), "discount_total ก่อนใช้โค้ด").toBe(0)
      await page.goto(`/${CC}/cart`)
      await expect(totals).toBeVisible()
      await expect(totals.getByTestId("cart-discount")).toHaveCount(0)
      withoutDiscount = await subtotalLabel(page)
      await evidence("01-cart-no-discount-label")
    })

    let withDiscount = ""
    await step("(b) ใช้โค้ดส่วนลดแล้ว: ป้ายเปลี่ยน ตัวเลข = original_item_total และแถวรวมได้ยอดสุทธิ", async () => {
      const code = `CORE60${Date.now()}${crypto.randomInt(1e6)}`
      const created = await request.post(`${BACKEND_URL}/admin/promotions`, {
        headers: admin,
        data: {
          code,
          type: "standard",
          status: "active",
          is_automatic: false,
          application_method: { type: "percentage", target_type: "order", allocation: "across", value: 10 },
        },
      })
      expect(created.ok(), `create promotion: ${await created.text()}`).toBe(true)
      promotionId = (await created.json()).promotion.id
      await ok(
        await request.post(`${BACKEND_URL}/store/carts/${cartId}/promotions`, {
          headers: store,
          data: { promo_codes: [code] },
        }),
        "apply promotion"
      )
      const cart = await getCart()
      expect(Number(cart.discount_total), "discount_total หลังใช้โค้ด").toBeGreaterThan(0)

      await page.reload()
      await expect(totals.getByTestId("cart-discount")).toBeVisible()
      withDiscount = await subtotalLabel(page)
      expect(withDiscount).not.toBe(withoutDiscount)

      const subtotal = await dataValue(totals.getByTestId("cart-subtotal"))
      expect(Math.abs(subtotal - Number(cart.original_item_total))).toBeLessThanOrEqual(0.01)
      const rows =
        subtotal -
        (await dataValue(totals.getByTestId("cart-discount"))) +
        (await dataValue(totals.getByTestId("cart-shipping")))
      const grand = await dataValue(totals.getByTestId("cart-total"))
      expect(Math.abs(rows - grand), `rows=${rows} total=${grand}`).toBeLessThanOrEqual(0.01)
      await evidence("02-cart-discount-label")
    })

    await step("(c) ขั้น review: ป้ายเดียวกับ /cart", async () => {
      await page.goto(`/${CC}/checkout?step=payment`)
      await page.getByTestId(`payment-option-${MANUAL}`).click()
      await continueToReview(page)
      expect(await subtotalLabel(page)).toBe(withDiscount)
      await evidence("03-review-discount-label")
    })

    await step("(d) 375×812: ป้ายยาวขึ้นแต่จำนวนเงินบรรทัดเดียว ไม่ทับป้าย และไม่ล้นจอ", async () => {
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto(`/${CC}/cart`)
      await expect(totals.getByTestId("cart-discount")).toBeVisible()
      const box = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="cart-totals"]')!
        const rect = (id: string) => {
          const el = root.querySelector(`[data-testid="${id}"]`)!
          const r = el.getBoundingClientRect()
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, lines: el.getClientRects().length }
        }
        return {
          scrollWidth: document.documentElement.scrollWidth,
          label: rect("cart-subtotal-label"),
          amount: rect("cart-subtotal"),
        }
      })
      expect(box.scrollWidth, "scrollWidth").toBeLessThanOrEqual(375)
      expect(box.label.right, "label right").toBeLessThanOrEqual(375)
      expect(box.amount.right, "amount right").toBeLessThanOrEqual(375)
      const overlapX = Math.min(box.label.right, box.amount.right) - Math.max(box.label.left, box.amount.left)
      const overlapY = Math.min(box.label.bottom, box.amount.bottom) - Math.max(box.label.top, box.amount.top)
      expect(Math.max(0, overlapX) * Math.max(0, overlapY), "intersection ของป้ายกับจำนวนเงิน").toBe(0)
      expect(box.amount.lines, "cart-subtotal บรรทัดเดียว").toBe(1)
      await evidence("04-cart-discount-label-375")
    })
  } finally {
    await deleteAllThenExpectOk(request, admin, [promotionId && `/admin/promotions/${promotionId}`])
  }
})
