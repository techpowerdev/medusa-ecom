import { Locator, Page } from "@playwright/test"

import { MISSING_ADDRESS_MESSAGE } from "../src/lib/util/address-required"
import { INSUFFICIENT_INVENTORY_MESSAGE } from "../src/lib/util/insufficient-inventory"
import { deleteAllThenExpectOk } from "./support/cleanup"
import { expect, test } from "./support/fixtures"
import { createFlashCampaign, createFlashProduct, endFlashCampaign } from "./support/flash-sale"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { chooseOption } from "./support/select"
import { addToCartFromPdp, isServerAction, waitForServerAction } from "./support/server-action"
import { THAI } from "./support/thai-text"

// SFUI-21d (spec 09 กฎ 74, AC-70 (3) — owner Q-R50-2 ทาง (ข)): error ระดับฟอร์ม/การกระทำ/ขั้น = `Alert variant="destructive"` ของ shadcn
// (ผ่าน ErrorMessage — testid อยู่บน root `[data-slot="alert"]`, role="alert"); error ในแถว (inline) = `FieldError` (`[data-slot="field-error"]`
// 14px สี destructive ไม่มีกรอบ) — trigger error จริงทุกจุด ข้อความไทยตามเดิม
test.use({ evidenceTarget: { feature: "storefront-consistency", taskId: "SFUI-21d" } })

const MANUAL = "pp_system_default"

async function expectAlert(el: Locator, text?: string) {
  await expect(el).toBeVisible()
  await expect(el).toHaveAttribute("data-slot", "alert")
  await expect(el).toHaveAttribute("role", "alert")
  await expect(el.locator('[data-slot="alert-description"]')).toHaveCount(1)
  if (text) await expect(el).toHaveText(text)
  expect((await el.textContent()) ?? "").toMatch(THAI)
}

async function expectInline(el: Locator) {
  await expect(el).toBeVisible()
  await expect(el).toHaveAttribute("data-slot", "field-error")
  await expect(el.locator('[data-slot="alert"]')).toHaveCount(0)
  await expect(el).toHaveCSS("font-size", "14px")
  expect((await el.textContent()) ?? "").toMatch(THAI)
  return el.evaluate((e) => getComputedStyle(e).color)
}

type Box = { x: number; y: number; width: number; height: number }
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/** error อยู่ในแถว ไม่ทับ element ที่ระบุ และหน้าไม่ล้นแนวนอน */
async function expectInRow(page: Page, row: Locator, error: Locator, neighbours: string[]) {
  const box = (await error.boundingBox())!
  for (const id of neighbours) expect(overlaps(box, (await row.getByTestId(id).boundingBox())!), `error ทับ ${id}`).toBe(false)
  const width = page.viewportSize()!.width
  expect(box.x + box.width).toBeLessThanOrEqual(width)
  expect(await page.evaluate(() => document.documentElement.scrollWidth), "หน้าไม่ล้นแนวนอน").toBeLessThanOrEqual(width)
}

test("AC-70 (3) login/register: login-error-message และ register-email-exists เป็น Alert", async ({ page, request, step }) => {
  const customer = await createCustomer(request, await publishableKey(request, await adminHeaders(request)))
  await step("login รหัสผ่านผิด → login-error-message", async () => {
    await page.goto(`/${CC}/account`)
    await page.getByTestId("email-input").fill(customer.email)
    await page.getByTestId("password-input").fill(`${customer.password}-wrong`)
    await page.getByTestId("sign-in-button").click()
    await expectAlert(page.getByTestId("login-error-message"))
  })
  await step("สมัครด้วยอีเมลที่มีบัญชีแล้ว → register-email-exists (มีลิงก์ไปเข้าสู่ระบบในข้อความ)", async () => {
    await page.getByTestId("login-to-register-button").click()
    const form = page.getByTestId("register-page")
    await form.getByTestId("first-name-input").fill("สมชาย")
    await form.getByTestId("last-name-input").fill("ใจดี")
    await form.getByTestId("email-input").fill(customer.email)
    await form.getByTestId("password-input").fill(`${customer.password}-other`)
    await form.getByTestId("register-button").click()
    const error = page.getByTestId("register-email-exists")
    await expectAlert(error)
    await expect(error.getByTestId("register-login-link")).toBeVisible()
  })
})

test("AC-70 (3) checkout: address-error-message (จังหวัดช่องว่างล้วน) และ promotion-error (aria-describedby) เป็น Alert", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(150_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  await page.goto(`/${CC}/products/t-shirt`)
  await addToCartFromPdp(page, { request, pk, customer })
  await page.goto(`/${CC}/checkout?step=address`)

  await step("จังหวัดช่องว่างล้วน → address-error-message = MISSING_ADDRESS_MESSAGE", async () => {
    for (const [id, value] of [
      ["shipping-first-name-input", "สมชาย"],
      ["shipping-last-name-input", "ใจดี"],
      ["shipping-address-input", "1 ถนนสุขุมวิท"],
      ["shipping-address-2-input", "คลองเตยเหนือ"],
      ["shipping-postal-code-input", "10110"],
      ["shipping-city-input", "คลองเตย"],
      ["shipping-province-input", "   "],
      ["shipping-email-input", customer.email],
    ]) {
      await page.getByTestId(id).fill(value)
    }
    const saved = waitForServerAction(page, (body) => body.includes(customer.email))
    await page.getByTestId("submit-address-button").click()
    await saved
    await expectAlert(page.getByTestId("address-error-message"), MISSING_ADDRESS_MESSAGE)
    await evidence("01-checkout-address-alert")
  })

  await step("โค้ดส่วนลดที่ไม่มี → promotion-error เป็น Alert และ discount-input อ้าง id ของมัน (กฎ 32d)", async () => {
    await page.getByTestId("add-discount-button").click()
    const input = page.getByTestId("discount-input")
    await input.fill(`NOPE-SFUI21D-${Date.now()}`)
    await page.getByTestId("discount-apply-button").click()
    const error = page.getByTestId("promotion-error")
    await expectAlert(error)
    const id = await error.getAttribute("id")
    expect(id).toBeTruthy()
    await expect(input).toHaveAttribute("aria-describedby", id!)
  })
})

test("AC-70 (3) บัญชี: address-error ใน modal และ error-message ของ account-info เป็น Alert", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  await signInAs(context, baseURL!, await createCustomer(request, pk))

  await step("modal เพิ่มที่อยู่ จังหวัดช่องว่างล้วน → address-error", async () => {
    await page.goto(`/${CC}/account/addresses`)
    await page.getByTestId("add-address-button").click()
    const modal = page.getByTestId("add-address-modal")
    for (const [id, value] of [
      ["first-name-input", "สมหญิง"],
      ["last-name-input", "รักดี"],
      ["address-1-input", "99 ถนนสุขุมวิท"],
      ["address-2-input", "คลองเตยเหนือ"],
      ["postal-code-input", "10110"],
      ["city-input", "วัฒนา"],
      ["state-input", "   "],
    ]) {
      await modal.getByTestId(id).fill(value)
    }
    const saved = waitForServerAction(page)
    await modal.getByTestId("save-button").click()
    await saved
    await expectAlert(modal.getByTestId("address-error"), MISSING_ADDRESS_MESSAGE)
    await modal.getByTestId("cancel-button").click()
  })

  await step("editor เบอร์โทร: ลบ _medusa_jwt แล้วบันทึก → error-message (wrapper) ครอบ Alert", async () => {
    await page.goto(`/${CC}/account/profile`)
    const phone = page.getByTestId("account-phone-editor")
    await phone.getByTestId("edit-button").click()
    await expect(phone.getByTestId("edit-panel")).toHaveAttribute("data-open", "true")
    await phone.getByTestId("phone-input").fill("0899999999")
    await context.clearCookies({ name: "_medusa_jwt" })
    await phone.getByTestId("save-button").click()
    const wrapper = phone.getByTestId("error-message")
    await expect(wrapper).toHaveCSS("opacity", "1")
    await expectAlert(wrapper.locator('[data-slot="alert"]'))
  })
})

test("AC-70 (3) add-variant-error (variant ที่ไม่มีอยู่ — แนว core-14d) เป็น Alert", async ({ page }) => {
  await page.goto(`/${CC}/account?add_variant=variant_sfui21d_missing`)
  await expect(page.getByTestId("login-page")).toBeVisible()
  await expectAlert(page.getByTestId("add-variant-error"))
})

test("AC-70 (3) review-flash-exceeds-customer-limit (แนว fs-21) เป็น Alert", async ({ page, context, request, baseURL }) => {
  test.setTimeout(150_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const { productId, variantId } = await createFlashProduct(request, admin, "SFUI21D", 100)
  let campaignId: string | undefined
  try {
    campaignId = await createFlashCampaign(request, admin, "SFUI21D", productId, { per_customer_limit: 1, show_remaining: false })
    const customer = await createCustomer(request, pk)
    await signInAs(context, baseURL!, customer)
    const cartId = await cartReadyForPayment(request, pk, customer, { variant: variantId, quantity: 2 })
    await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
    await page.goto(`/${CC}/checkout?step=payment`)
    await page.getByTestId(`payment-option-${MANUAL}`).click()
    await expect(page.getByTestId("submit-payment-button")).toBeEnabled()
    await page.getByTestId("submit-payment-button").click()
    await expect(page).toHaveURL(/step=review/)
    await expectAlert(page.getByTestId("review-flash-exceeds-customer-limit"))
  } finally {
    if (campaignId) await endFlashCampaign(request, admin, campaignId)
    await deleteAllThenExpectOk(request, admin, [`/admin/products/${productId}`])
  }
})

test("AC-70 (3) 390: product-error-message (stock ไม่พอ) และ cart-item-remove-error (ลบไม่สำเร็จ) เป็น FieldError ในแถว", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(150_000)
  await page.setViewportSize({ width: 390, height: 844 })
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const { productId, variantId } = await createFlashProduct(request, admin, "SFUI21D-STOCK", 5)
  try {
    const customer = await createCustomer(request, pk)
    await signInAs(context, baseURL!, customer)
    const cartId = await cartReadyForPayment(request, pk, customer, { variant: variantId, quantity: 1 })
    await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
    await page.goto(`/${CC}/cart`)
    const row = page.getByTestId("product-row")
    await expect(row).toHaveCount(1)
    let color = ""

    await step("เลือก 10 (stock 5) → product-error-message = INSUFFICIENT_INVENTORY_MESSAGE เป็น FieldError", async () => {
      const updated = page.waitForResponse((res) => isServerAction(res.request(), (b) => b.includes('"quantity":10')))
      await chooseOption(row.getByTestId("product-select-button"), "10", { waitValue: false })
      expect((await updated).status()).toBe(200)
      const error = row.getByTestId("product-error-message")
      color = await expectInline(error)
      await expect(error).toHaveText(INSUFFICIENT_INVENTORY_MESSAGE)
      await expectInRow(page, row, error, ["product-select-button", "product-delete-button"])
    })

    await step("ลบโดย server action ตอบ 500 → cart-item-remove-error เป็น FieldError สีเดียวกัน", async () => {
      let failed = 0
      await page.route("**/*", async (route) => {
        const req = route.request()
        if (failed === 0 && req.method() === "POST" && req.headers()["next-action"] !== undefined) {
          failed++
          await route.fulfill({ status: 500, contentType: "text/plain", body: "Internal Server Error" })
          return
        }
        await route.fallback()
      })
      await row.getByTestId("product-delete-button").click()
      await expect.poll(() => failed).toBe(1)
      const error = row.getByTestId("cart-item-remove-error")
      expect(await expectInline(error), "สีเท่า FieldError ของ product-error-message").toBe(color)
      await expectInRow(page, row, error, ["product-delete-button", "product-select-button"])
      await evidence("02-cart-inline-field-error-390")
    })
  } finally {
    await deleteAllThenExpectOk(request, admin, [`/admin/products/${productId}`])
  }
})
