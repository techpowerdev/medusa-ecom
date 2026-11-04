import crypto from "node:crypto"

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

/**
 * padding ซ้าย/ขวาของทุก header cell (`cart-items-header`) และทุก cell ของ `product-row` แรก + ความกว้างกล่องปุ่มลบ/จำนวน —
 * ใช้เทียบ layout ที่ ≥ small กับค่าก่อน CORE-42 (กฎข้อ 100a "≥ small คง layout เดิม"); ไม่เทียบ left/width ของ cell
 * เพราะขึ้นกับฟอนต์ของเครื่องที่รัน
 */
async function desktopLayout(page: Page) {
  return page.evaluate(() => {
    const padding = (el: Element) =>
      `${getComputedStyle(el).paddingLeft}/${getComputedStyle(el).paddingRight}`
    const header = document.querySelector('[data-testid="cart-items-header"]')!
    const row = document.querySelector('[data-testid="product-row"]')!
    const quantity = row
      .querySelector('[data-testid="product-select-button"]')!
      .closest("td")!.firstElementChild!
    return {
      header: Array.from(header.querySelectorAll("th")).map(padding),
      row: Array.from(row.querySelectorAll("td")).map(padding),
      quantityBoxWidth: quantity.getBoundingClientRect().width,
    }
  })
}

const DESKTOP_BASELINE = {
  header: ["0px/16px", "16px/16px", "16px/16px", "16px/16px", "16px/0px"],
  row: ["0px/16px", "16px/16px", "16px/16px", "16px/16px", "16px/0px"],
  quantityBoxWidth: 112,
}

test("AC-136a: ตารางสินค้า /cart ไม่ล้นที่ 375 (จำนวน 1 และ 99 + ส่วนลด) และ layout ที่ 1280 คงเดิม", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  // qa #264 O-4: ล้นเมื่อ line มีส่วนลด (ราคาเดิมขีดฆ่า + ราคาลดมีทศนิยม เช่น ฿560.50) — ใส่โค้ด 5% แบบเดียวกับ qa
  // qa #278 D-1: จำนวน 99 (฿58,410 ขีดฆ่า / ฿55,489.50) ยังล้น — ใช้สินค้าของ test เองราคาเดียวกับ t-shirt (590)
  // suffix สุ่ม — worker ที่รันขนาน (เช่น --repeat-each) ได้ Date.now() เดียวกัน
  const runId = `${Date.now()}${crypto.randomInt(1e6)}`
  const code = `CORE42${runId}`
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
  let productId: string | undefined
  try {
    // สินค้าของ test เอง (ไม่ตัด stock) ราคาเท่า t-shirt ของ seed — จำนวน 99 ไม่ขึ้นกับ stock ที่ test อื่นใช้ไป (CI #278 insufficient_inventory)
    const product = await createTempProduct()
    productId = product.productId
    for (const quantity of [1, 99]) {
      await openCart(quantity, product.variantId)
      await expectCartFits(quantity)
      if (quantity === 1) await expectDesktopLayout()
    }
  } finally {
    await deleteAllThenExpectOk(request, admin, [
      `/admin/promotions/${promotionId}`,
      productId && `/admin/products/${productId}`,
    ])
  }

  /** เสื้อชั่วคราว 590 THB (`manage_inventory: false`) ชื่อ/ราคาเดียวกับ t-shirt ของ seed (ความกว้างช่องชื่อ = คำยาวสุด → layout เดียวกับ qa) — คืน id ของ product/variant */
  async function createTempProduct() {
    const get = async (path: string) =>
      (await request.get(`${BACKEND_URL}${path}`, { headers: admin })).json()
    const { sales_channels } = await get("/admin/sales-channels?limit=1")
    const { shipping_profiles } = await get(
      "/admin/shipping-profiles?type=default"
    )
    const handle = `e2e-core42-${runId}`
    const res = await request.post(
      `${BACKEND_URL}/admin/products?fields=id,*variants`,
      {
        headers: admin,
        data: {
          title: "เสื้อยืด Medusa",
          handle,
          status: "published",
          shipping_profile_id: shipping_profiles[0].id,
          sales_channels: [{ id: sales_channels[0].id }],
          options: [{ title: "Size", values: ["M"] }],
          variants: [
            {
              title: "M",
              sku: handle.toUpperCase(),
              options: { Size: "M" },
              manage_inventory: false,
              prices: [{ currency_code: "thb", amount: 590 }],
            },
          ],
        },
      }
    )
    expect(res.ok(), `create product: ${await res.text()}`).toBe(true)
    const { product } = await res.json()
    return {
      productId: product.id as string,
      variantId: product.variants[0].id as string,
    }
  }

  /** cart ใหม่ของลูกค้าใหม่ (Store API ด้วย token ของเจ้าของ) ที่มีสินค้า 1 line ตามจำนวน + โค้ด 5% แล้วตั้ง cookie ให้ browser */
  async function openCart(quantity: number, variant: string) {
    const a = await createCustomer(request, pk)
    const cartId = await cartReadyForPayment(request, pk, a, {
      quantity,
      variant,
    })
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
    await context.clearCookies()
    await signInAs(context, baseURL!, a)
    await context.addCookies([
      { name: "_medusa_cart_id", value: cartId, url: baseURL! },
    ])
  }

  async function expectCartFits(quantity: number) {
    await step(
      `375 จำนวน ${quantity}: หน้าไม่ล้นแนวนอน และ product-price อยู่ในจอครบ ไม่ถูกตัด`,
      async () => {
        await page.setViewportSize(MOBILE)
        await page.goto(`/${CC}/cart`)
        await expect(page.getByTestId("product-row")).toHaveCount(1)
        await expect(page.getByTestId("product-original-price")).toBeVisible()
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
        await evidence(`01-cart-375-qty${quantity}`)
      }
    )
  }

  async function expectDesktopLayout() {
    await step(
      "1280: header 5 ช่อง visible และ padding/ตำแหน่งของทุก cell เท่าก่อน CORE-42",
      async () => {
        await page.setViewportSize(DESKTOP)
        await page.goto(`/${CC}/cart`)
        const header = page.getByTestId("cart-items-header")
        await expect(header.locator("th")).toHaveCount(5)
        for (let i = 0; i < 5; i++) {
          await expect(header.locator("th").nth(i)).toBeVisible()
        }
        await expect(page.getByTestId("product-unit-price")).toBeVisible()
        await expect(page.getByTestId("product-price")).toBeVisible()
        expect(await desktopLayout(page)).toEqual(DESKTOP_BASELINE)
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
