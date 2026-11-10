import type { Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
  variantOf,
} from "./support/medusa"

// CORE-14f: spec 01 AC-101 (กฎข้อ 65) — การ์ด add-variant-pending บอกสถานะ cart จริง และ countryCode ที่ไม่มีจริงไม่ทำให้ 5xx
// หา element ด้วย data-testid เท่านั้น; ข้อมูลตั้งต้นจาก seed (CORE-2): region Thailand, t-shirt
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-14f" } })

const PRODUCT = "t-shirt"
const PENDING = "add-variant-pending"
const IN_CART_QTY = "add-variant-in-cart-qty"
const NOT_IN_CART = "ยังไม่ได้อยู่ในตะกร้า"
const THAI = /[฀-๿]/

/** status ของทุก document response (รวม redirect) ที่ browser ได้รับ */
function documentStatuses(page: Page): number[] {
  const statuses: number[] = []
  page.on("response", (res) => {
    if (res.request().resourceType() === "document") {
      statuses.push(res.status())
    }
  })
  return statuses
}

/** ไม่มี 5xx และหน้าปลายทางเป็นข้อความ error ไทย หรือ URL ขึ้นต้น /th/ (AC-101) */
async function expectNo5xx(page: Page, statuses: number[]) {
  expect(statuses.length).toBeGreaterThan(0)
  expect(statuses.filter((s) => s >= 500)).toEqual([])
  const error = page.getByTestId("add-variant-error")
  if (await error.count()) {
    await expect(error).toHaveText(THAI)
  } else {
    expect(new URL(page.url()).pathname).toMatch(new RegExp(`^/${CC}/`))
  }
}

for (const javaScriptEnabled of [true, false]) {
  test.describe(`AC-101 (JS ${javaScriptEnabled ? "เปิด" : "ปิด"})`, () => {
    test.use({ javaScriptEnabled })

    test(`AC-101: variant อยู่ใน cart แล้ว qty 2 → การ์ดแสดงจำนวนใน cart ไม่บอกว่ายังไม่อยู่ในตะกร้า (JS ${
      javaScriptEnabled ? "on" : "off"
    })`, async ({ page, context, request, baseURL, step, evidence }) => {
      const admin = await adminHeaders(request)
      const pk = await publishableKey(request, admin)
      const customer = await createCustomer(request, pk)
      const auth = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
      const { variantId } = await variantOf(request, pk, PRODUCT)
      await signInAs(context, baseURL!, customer)
      const pendingPath = `/${CC}/account?${new URLSearchParams({ add_variant: variantId, add_quantity: "1" })}`

      await step("cart ว่าง → การ์ดใช้ข้อความกลาง ไม่มีจำนวนใน cart", async () => {
        await page.goto(pendingPath)
        const card = page.getByTestId(PENDING)
        await expect(card).toBeVisible()
        await expect(card).toHaveText(THAI)
        await expect(card).not.toContainText(NOT_IN_CART)
        await expect(page.getByTestId(IN_CART_QTY)).toHaveCount(0)
      })

      await step("cart ของลูกค้ามี variant นั้น qty 2 → การ์ดแสดง add-variant-in-cart-qty = 2", async () => {
        const { regions } = await (await request.get(`${BACKEND_URL}/store/regions`, { headers: auth })).json()
        const region = regions.find((r: { countries?: { iso_2: string }[] }) =>
          r.countries?.some((c) => c.iso_2 === CC)
        )
        const created = await request.post(`${BACKEND_URL}/store/carts`, { headers: auth, data: { region_id: region.id } })
        expect(created.status()).toBe(200)
        const cartId = (await created.json()).cart.id
        const line = await request.post(`${BACKEND_URL}/store/carts/${cartId}/line-items`, {
          headers: auth,
          data: { variant_id: variantId, quantity: 2 },
        })
        expect(line.status()).toBe(200)
        await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

        await page.goto(pendingPath)
        const card = page.getByTestId(PENDING)
        await expect(card).toBeVisible()
        await expect(page.getByTestId(IN_CART_QTY)).toHaveText("2")
        await expect(card).toHaveText(THAI)
        await expect(card).not.toContainText(NOT_IN_CART)
        await evidence(`01-pending-card-in-cart-${javaScriptEnabled ? "js" : "nojs"}`)
      })

      await step("/zz/account?add_variant=… → ไม่มี 5xx", async () => {
        const statuses = documentStatuses(page)
        await page.goto(`/zz/account?${new URLSearchParams({ add_variant: variantId })}`)
        await expectNo5xx(page, statuses)
      })
    })
  })
}

test.describe("AC-101 ฟอร์ม (JS ปิด)", () => {
  test.use({ javaScriptEnabled: false })

  for (const countryCode of ["zz", "/evil.example"]) {
    test(`AC-101: ส่งฟอร์ม add-variant-confirm ที่แก้ country_code เป็น ${countryCode} → ไม่มี 5xx เห็น error ไทย`, async ({
      page,
      context,
      request,
      baseURL,
      step,
      evidence,
    }) => {
      const admin = await adminHeaders(request)
      const pk = await publishableKey(request, admin)
      const customer = await createCustomer(request, pk)
      const { variantId } = await variantOf(request, pk, PRODUCT)
      await signInAs(context, baseURL!, customer)

      await step(`แก้ hidden country_code เป็น ${countryCode} แล้วกด add-variant-confirm`, async () => {
        await page.goto(`/${CC}/account?${new URLSearchParams({ add_variant: variantId })}`)
        await expect(page.getByTestId("add-variant-confirm")).toBeVisible()
        await page
          .getByTestId(PENDING)
          .locator('input[name="country_code"]')
          .evaluate((el, value) => ((el as HTMLInputElement).value = value), countryCode)
        const statuses = documentStatuses(page)
        await page.getByTestId("add-variant-confirm").click()
        await page.waitForLoadState()
        await expectNo5xx(page, statuses)
        await expect(page.getByTestId("add-variant-error")).toHaveText(THAI)
        expect(new URL(page.url()).pathname).toBe(`/${CC}/account`)
        if (countryCode === "zz") {
          await evidence("02-tampered-country-error-nojs")
        }
      })
    })
  }
})
