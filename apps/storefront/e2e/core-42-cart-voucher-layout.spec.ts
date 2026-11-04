import { Page } from "@playwright/test"

import {
  createVoucher,
  placeCapturedOrder,
  waitDelivered,
} from "./support/evoucher"
import { deleteAllThenExpectOk } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-42 (spec 01 กฎข้อ 100, AC-136): (a) ตารางสินค้า /cart ไม่ล้นที่ 375 (คอลัมน์ "รวม" อยู่ในจอ ไม่ถูกตัด)
// และคอลัมน์ราคาต่อหน่วยยังอยู่ที่ 1280; (b) แถวรหัสของการ์ด voucher ไม่มีช่องว่างใต้แถวเมื่อสถานะว่าง (span aria-live ยังอยู่)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-42" } })

const MOBILE = { width: 375, height: 812 }
const DESKTOP = { width: 1280, height: 720 }

/** ทุก `product-price` อยู่ในจอ (0 ≤ left, right ≤ 375) และจุดกลางไม่ถูก ancestor ตัด (elementFromPoint อยู่ใน product-price) */
async function pricesInViewport(page: Page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="product-price"]')
    ).map((el) => {
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2
      )
      return {
        left: r.left,
        right: r.right,
        hitInside: !!hit && el.contains(hit),
      }
    })
  )
}

/** ระยะจากขอบล่างของ `voucher-code-row` ถึงขอบล่างสุดของ voucher-code / voucher-copy-button */
async function codeRowGap(page: Page) {
  return page.evaluate(() => {
    const row = document.querySelector('[data-testid="voucher-code-row"]')!
    const bottom = (id: string) =>
      row.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect().bottom
    return (
      row.getBoundingClientRect().bottom -
      Math.max(bottom("voucher-code"), bottom("voucher-copy-button"))
    )
  })
}

test("AC-136a: ตารางสินค้า /cart ไม่ล้นที่ 375 และคอลัมน์ราคาต่อหน่วยยังแสดงที่ 1280", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const a = await createCustomer(request, pk)
  const cartId = await cartReadyForPayment(request, pk, a)
  // qa #264 O-4: ล้นเมื่อ line มีส่วนลด (ราคาเดิมขีดฆ่า + ราคาลดมีทศนิยม เช่น ฿560.50) — ใส่โค้ด 5% แบบเดียวกับ qa
  const code = `CORE42${Date.now()}`
  const created = await request.post(`${BACKEND_URL}/admin/promotions`, {
    headers: admin,
    data: {
      code,
      type: "standard",
      status: "active",
      is_automatic: false,
      application_method: {
        type: "percentage",
        target_type: "order",
        allocation: "across",
        value: 5,
      },
    },
  })
  expect(created.ok(), `create promotion: ${await created.text()}`).toBe(true)
  const promotionId = (await created.json()).promotion.id
  try {
    const applied = await request.post(
      `${BACKEND_URL}/store/carts/${cartId}/promotions`,
      {
        headers: {
          authorization: `Bearer ${a.token}`,
          "x-publishable-api-key": pk,
        },
        data: { promo_codes: [code] },
      }
    )
    expect(applied.ok(), `apply promotion: ${applied.status()}`).toBe(true)
    await signInAs(context, baseURL!, a)
    await context.addCookies([
      { name: "_medusa_cart_id", value: cartId, url: baseURL! },
    ])
    await checkCart()
  } finally {
    await deleteAllThenExpectOk(request, admin, [
      `/admin/promotions/${promotionId}`,
    ])
  }

  async function checkCart() {
    await step(
      "375: หน้าไม่ล้นแนวนอน และ product-price อยู่ในจอครบ ไม่ถูกตัด",
      async () => {
        await page.setViewportSize(MOBILE)
        await page.goto(`/${CC}/cart`)
        await expect(page.getByTestId("product-row")).toHaveCount(1)
        await expect(page.getByTestId("product-price")).toBeVisible()
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth)
        ).toBeLessThanOrEqual(375)
        const prices = await pricesInViewport(page)
        expect(prices.length).toBeGreaterThan(0)
        for (const p of prices) {
          expect(p.left).toBeGreaterThanOrEqual(0)
          expect(p.right).toBeLessThanOrEqual(375)
          expect(p.hitInside, "จุดกลางของ product-price ไม่ถูกตัด").toBe(true)
        }
        await evidence("01-cart-375")
      }
    )

    await step(
      "1280: cart-items-header มี 5 ช่อง คอลัมน์ราคาต่อหน่วยแสดง",
      async () => {
        await page.setViewportSize(DESKTOP)
        await page.goto(`/${CC}/cart`)
        const header = page.getByTestId("cart-items-header")
        // ช่องที่ 2 เป็น HeaderCell ว่าง (toBeVisible อาจไม่นับ) — นับจำนวนช่องแล้วเช็กช่องราคา/รวม visible
        await expect(header.locator("th")).toHaveCount(5)
        await expect(header.locator("th").nth(3)).toBeVisible()
        await expect(header.locator("th").nth(4)).toBeVisible()
        await expect(page.getByTestId("product-unit-price")).toBeVisible()
        await expect(page.getByTestId("product-price")).toBeVisible()
      }
    )
  }
})

test("AC-136b: แถวรหัสของการ์ด voucher ไม่มีช่องว่างเมื่อสถานะว่าง และสถานะคัดลอกล้มอยู่ในแถวใต้ปุ่ม", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const voucher = await createVoucher(request, admin, 1, {
    expires_at: "2099-12-31T05:00:00.000Z",
  })
  const a = await createCustomer(request, pk)
  const order = await placeCapturedOrder(
    request,
    admin,
    pk,
    a,
    voucher.variantId,
    1
  )
  await waitDelivered(request, admin, order, 1)
  await signInAs(context, baseURL!, a)

  const card = page.getByTestId("voucher-card").first()
  const status = card.getByTestId("voucher-copy-status")

  for (const viewport of [MOBILE, DESKTOP]) {
    await step(
      `${viewport.width}: สถานะว่าง → ไม่มีช่องว่างใต้แถวรหัส และ live region ยังอยู่`,
      async () => {
        await page.setViewportSize(viewport)
        await page.goto(`/${CC}/account/vouchers`)
        await expect(card.getByTestId("voucher-copy-button")).toBeVisible()
        expect(await codeRowGap(page)).toBeLessThanOrEqual(1)
        await expect(status).toHaveCount(1)
        await expect(status).toHaveAttribute("aria-live", "polite")
        expect(
          await status.evaluate((el) => getComputedStyle(el).display)
        ).not.toBe("none")
        if (viewport.width === MOBILE.width)
          await evidence("02-voucher-row-empty-375")
      }
    )
  }

  await step(
    "375: writeText reject → สถานะ + ค่าอยู่ใน voucher-code-row ใต้ปุ่ม",
    async () => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator.clipboard, "writeText", {
          value: () =>
            Promise.reject(new DOMException("denied", "NotAllowedError")),
          configurable: true,
        })
      })
      await page.setViewportSize(MOBILE)
      await page.goto(`/${CC}/account/vouchers`)
      const row = card.getByTestId("voucher-code-row")
      const button = row.getByTestId("voucher-copy-button")
      await button.click()
      await expect(row.getByTestId("voucher-copy-status")).toHaveText(THAI)
      await expect(row.getByTestId("voucher-copy-status-value")).toHaveCount(1)
      const buttonBox = (await button.boundingBox())!
      const statusBox = (await row
        .getByTestId("voucher-copy-status")
        .boundingBox())!
      expect(statusBox.y).toBeGreaterThanOrEqual(
        buttonBox.y + buttonBox.height - 1
      )
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth)
      ).toBeLessThanOrEqual(375)
      await evidence("03-voucher-copy-failed-375")
    }
  )
})
