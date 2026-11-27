import type { Page } from "@playwright/test"

import { RETURN_NOT_STOCKED } from "../src/lib/util/return-request"
import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  fulfillAndShip,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { expectThai } from "./support/thai-text"
import { chooseOption, expectSelected } from "./support/select"

// CORE-71: spec 01 AC-170 / กฎข้อ 129 — backend (CORE-55) ปฏิเสธการคืนเมื่อ location ของ return option ไม่มีของ
// → ลองใหม่ไม่ช่วย ฟอร์มต้องบอกให้ติดต่อร้าน (`return-contact-store` + ลิงก์ /contact); error อื่นคงข้อความเดิม
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-71" } })

const MISSING_ORDER_ERROR = '"error":"ไม่พบคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง"'

/**
 * route mock ผลของ server action ส่งคำขอคืน: POST /store/returns ยิงจาก Next server จึง mock จาก browser ไม่ได้ (แบบ CORE-20d)
 * — ส่งต่อด้วย order id ที่ไม่มีจริง (action ล้มก่อนถึง backend และคืนค่าที่เลือกตามจริง) แล้วแทน error ใน payload
 * ด้วย `replacement` (unit `return-request-action.test.ts` ตรวจว่า MedusaApiError 400 ที่มี code `RETURN_ITEM_NOT_STOCKED`/`RETURN_NO_LOCATION`
 * จาก medusaFetch ได้ผลนี้ — CORE-83; integration `store-returns-receive.spec.ts` ตรวจว่า backend ตอบ code นี้)
 */
async function mockReturnAction(page: Page, orderId: string, replacement: string) {
  await page.route(
    (url) => url.pathname.endsWith(`/account/orders/details/${orderId}/return`),
    async (route) => {
      const req = route.request()
      const postData = req.postDataBuffer()?.toString("utf8") ?? ""
      if (req.method() !== "POST" || !req.headers()["next-action"] || !postData.includes("order_id")) {
        return route.fallback()
      }
      const response = await route.fetch({ postData: postData.replaceAll(orderId, "order_core71_missing") })
      const body = await response.text()
      expect(body).toContain(MISSING_ORDER_ERROR)
      return route.fulfill({ response, body: body.replace(MISSING_ORDER_ERROR, replacement) })
    }
  )
}

test.describe("AC-170: ขอคืนสินค้าเมื่อ location ไม่มีของ", () => {
  let orderId: string

  test.beforeEach(async ({ request, context, baseURL }) => {
    test.setTimeout(180_000)
    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const customer = await createCustomer(request, pk)
    orderId = (await placeOrder(request, pk, customer)).id
    await fulfillAndShip(request, admin, orderId)
    await signInAs(context, baseURL!, customer)
  })

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" })
  })

  test("error location ไม่มีของ → เห็น return-contact-store (ไทย + ลิงก์ /contact) ไม่เห็น ลองใหม่", async ({
    page,
    step,
    evidence,
  }) => {
    await mockReturnAction(page, orderId, `"error":"${RETURN_NOT_STOCKED.text}","contactStore":true`)

    await step("เลือกจำนวนแล้วส่งคำขอคืน", async () => {
      await page.goto(`/${CC}/account/orders/details/${orderId}/return`)
      await chooseOption(page.getByTestId("return-item").first().getByTestId("return-item-quantity"), "1")
      await page.getByTestId("return-submit-button").click()
    })

    await step("เห็นข้อความติดต่อร้าน + ลิงก์ /contact และไม่มีข้อความ ลองใหม่", async () => {
      const contact = page.getByTestId("return-contact-store")
      await expect(contact).toBeVisible({ timeout: 30_000 })
      await expect(contact).toContainText(RETURN_NOT_STOCKED.text)
      await expectThai(page, ["return-contact-store"])
      await expect(page.getByTestId("return-contact-store-link")).toHaveAttribute("href", `/${CC}/contact`)
      await expect(page.getByTestId("return-error")).toHaveCount(0)
      await expect(page.getByTestId("return-request-container")).not.toContainText("ลองใหม่")
      await expectSelected(page.getByTestId("return-item").first().getByTestId("return-item-quantity"), "1")
      await evidence("01-return-contact-store")
    })

    await step("กดลิงก์ → หน้าติดต่อร้าน", async () => {
      await page.getByTestId("return-contact-store-link").click()
      await expect(page).toHaveURL(new RegExp(`/${CC}/contact$`))
    })
  })

  test("error อื่น → ข้อความเดิม (return-error) ไม่มี return-contact-store", async ({ page, step }) => {
    await mockReturnAction(page, orderId, '"error":"ส่งคำขอคืนสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"')

    await step("ส่งคำขอคืนแล้วเห็นข้อความเดิม", async () => {
      await page.goto(`/${CC}/account/orders/details/${orderId}/return`)
      await chooseOption(page.getByTestId("return-item").first().getByTestId("return-item-quantity"), "1")
      await page.getByTestId("return-submit-button").click()
      await expect(page.getByTestId("return-error")).toHaveText("ส่งคำขอคืนสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", {
        timeout: 30_000,
      })
      await expect(page.getByTestId("return-contact-store")).toHaveCount(0)
    })
  })
})
