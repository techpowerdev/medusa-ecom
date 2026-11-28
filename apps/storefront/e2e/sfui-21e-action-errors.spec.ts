import { APIRequestContext, Locator, Page } from "@playwright/test"

import { groupJoinActionMessage } from "../src/lib/util/group-join-error"
import { deleteAllThenExpectOk } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { createFlashCampaign, createFlashProduct, endFlashCampaign } from "./support/flash-sale"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  ok,
  publishableKey,
  signInAs,
  variantOf,
} from "./support/medusa"
import { chooseOption } from "./support/select"
import { THAI } from "./support/thai-text"

// SFUI-21e (spec 09 กฎ 74, AC-71 (2) — นอก checkout): error ของการกระทำ = Alert destructive ผ่าน ErrorMessage
// (`add-to-cart-error`, `group-create-team-error`), `cart-error-notice` = Alert variant default (สีข้อความปกติ),
// ข้อความผูกตัวเลือก/แถว = FieldError (`flash-qty-exceeds-remaining`, `cart-flash-exceeds-remaining`) — trigger จริงทุกจุด
test.use({ evidenceTarget: { feature: "storefront-consistency", taskId: "SFUI-21e" } })

async function expectAlert(el: Locator) {
  await expect(el).toBeVisible()
  await expect(el).toHaveAttribute("data-slot", "alert")
  await expect(el).toHaveAttribute("role", "alert")
  expect((await el.textContent()) ?? "").toMatch(THAI)
}

async function expectFieldError(el: Locator) {
  await expect(el).toBeVisible()
  await expect(el).toHaveAttribute("data-slot", "field-error")
  await expect(el).toHaveAttribute("role", "alert")
  expect((await el.textContent()) ?? "").toMatch(THAI)
}

const noHorizontalOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth), "หน้าไม่ล้นแนวนอน").toBeLessThanOrEqual(page.viewportSize()!.width)

test("AC-71 (2): PDP เลือกจำนวนเกิน stock แล้วกดเพิ่ม (แนว core-24 qa D-1) → add-to-cart-error เป็น Alert", async ({
  page,
  context,
  request,
  baseURL,
  evidence,
}) => {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const { productId } = await createFlashProduct(request, admin, "SFUI21E-STOCK", 2)
  try {
    const { product } = await ok(await request.get(`${BACKEND_URL}/admin/products/${productId}?fields=handle`, { headers: admin }), "product")
    await signInAs(context, baseURL!, await createCustomer(request, pk))
    await expect(async () => {
      await page.goto(`/${CC}/products/${product.handle}`)
      await expect(page.getByTestId("add-product-button")).toBeEnabled({ timeout: 2_000 })
    }).toPass({ timeout: 15_000 })
    await chooseOption(page.getByTestId("product-quantity-select"), "5")
    await page.getByTestId("add-product-button").click()
    const error = page.getByTestId("add-to-cart-error")
    await expectAlert(error)
    await expect(error).not.toContainText("inventory")
    await evidence("01-pdp-add-to-cart-alert")
  } finally {
    await deleteAllThenExpectOk(request, admin, [`/admin/products/${productId}`])
  }
})

/** แคมเปญ team (สินค้าเดียว = t-shirt) ที่ active */
async function teamCampaign(request: APIRequestContext, admin: Headers, productId: string) {
  const { campaign } = await ok(
    await request.post(`${BACKEND_URL}/admin/group-buy/campaigns`, {
      headers: admin,
      data: {
        name: `SFUI-21e ทีม ${Date.now()}`,
        target_type: "orders",
        target_value: 5,
        group_mode: "team",
        team_duration_hours: 24,
        ends_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
        application_method: {
          type: "percentage",
          target_type: "items",
          allocation: "each",
          max_quantity: 10,
          value: 10,
          target_rules: [{ attribute: "items.product.id", operator: "in", values: [productId] }],
        },
        rules: [{ attribute: "currency_code", operator: "in", values: ["thb"] }],
      },
    }),
    "create campaign"
  )
  await ok(
    await request.post(`${BACKEND_URL}/admin/group-buy/campaigns/${campaign.id}/status`, { headers: admin, data: { status: "active" } }),
    "activate"
  )
  return campaign as { id: string; template_promotion_id: string }
}

/** แก้ต้นแบบเป็น 2 สินค้าระหว่าง active (หลังหน้าแรกแสดงการ์ดแล้ว) → createGroupWorkflow 400 GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED (แนว AC-48) */
async function breakTemplate(request: APIRequestContext, admin: Headers, pk: string, productId: string, templateId: string) {
  const { products } = await ok(await request.get(`${BACKEND_URL}/store/products?limit=2&fields=id`, { headers: { "x-publishable-api-key": pk } }), "products")
  const other = (products as { id: string }[]).find((p) => p.id !== productId)!.id
  const { promotion } = await ok(
    await request.get(`${BACKEND_URL}/admin/promotions/${templateId}?fields=*application_method.target_rules`, { headers: admin }),
    "template"
  )
  await ok(
    await request.post(`${BACKEND_URL}/admin/promotions/${templateId}/target-rules/batch`, {
      headers: admin,
      data: { update: [{ id: promotion.application_method.target_rules[0].id, values: [productId, other] }] },
    }),
    "edit template"
  )
}

test("AC-71 (2): POST สร้างทีมตอบ 400 (แนว group-buy-home-campaigns AC-48) → group-create-team-error เป็น Alert", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const productId = (await variantOf(request, pk, "t-shirt")).productId
  const { id: campaignId, template_promotion_id } = await teamCampaign(request, admin, productId)
  try {
    await signInAs(context, baseURL!, await createCustomer(request, pk))
    const card = page.locator(`[data-testid="group-campaign-card"][data-campaign-id="${campaignId}"]`)
    // หน้าแรก static (revalidate 60, ADR-017) → reload จนเห็นการ์ด
    await expect(async () => {
      await page.goto(`/${CC}`)
      await expect(card).toBeVisible({ timeout: 1_000 })
    }).toPass({ intervals: [2_000, 5_000], timeout: 100_000 })
    await breakTemplate(request, admin, pk, productId, template_promotion_id)
    await card.getByTestId("group-create-team-button").click()
    const error = page.getByTestId("group-create-team-error")
    await expectAlert(error)
    await expect(error).toHaveText(groupJoinActionMessage("GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED"))
  } finally {
    await ok(
      await request.post(`${BACKEND_URL}/admin/group-buy/campaigns/${campaignId}/status`, { headers: admin, data: { status: "ended" } }),
      "end campaign"
    )
  }
})

test("AC-71 (2): /cart?error=refunded → cart-error-notice เป็น Alert variant default สีเท่าข้อความปกติของหน้า", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const cartId = await cartReadyForPayment(request, pk, customer)
  await signInAs(context, baseURL!, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
  await page.goto(`/${CC}/cart?error=refunded`)
  const notice = page.getByTestId("cart-error-notice")
  await expectAlert(notice)
  const [color, body] = await Promise.all([
    notice.evaluate((el) => getComputedStyle(el).color),
    page.evaluate(() => getComputedStyle(document.body).color),
  ])
  expect(color, "สีของ cart-error-notice = สีข้อความปกติของหน้า (ไม่ใช่ destructive)").toBe(body)
})

test("AC-71 (2) 390: PDP flash เลือกเกิน remaining (แนว flash-sale-fs15) → flash-qty-exceeds-remaining เป็น FieldError; PDP และแถวตะกร้าไม่ล้นแนวนอน", async ({
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
  const { productId, variantId } = await createFlashProduct(request, admin, "SFUI21E-FLASH", 100)
  let campaignId: string | undefined
  try {
    campaignId = await createFlashCampaign(request, admin, "SFUI21E", productId, { total_cap: 2, show_countdown: true, show_remaining: true })
    const { product } = await ok(await request.get(`${BACKEND_URL}/admin/products/${productId}?fields=handle`, { headers: admin }), "product")
    const customer = await createCustomer(request, pk)
    await signInAs(context, baseURL!, customer)

    await step("PDP เลือก 3 (เหลือ 2) → flash-qty-exceeds-remaining เป็น FieldError, หน้าไม่ล้น", async () => {
      await page.goto(`/${CC}/products/${product.handle}`)
      await expect(page.getByTestId("flash-remaining")).toContainText("2")
      await chooseOption(page.getByTestId("product-quantity-select"), "3")
      await expectFieldError(page.getByTestId("flash-qty-exceeds-remaining"))
      await expect(page.getByTestId("add-product-button")).toBeDisabled()
      await noHorizontalOverflow(page)
      await evidence("02-pdp-flash-field-error-390")
    })

    await step("ตะกร้ามี line flash จำนวน 3 → cart-flash-exceeds-remaining เป็น FieldError, แถวไม่ล้น", async () => {
      const cartId = await cartReadyForPayment(request, pk, customer, { variant: variantId, quantity: 3 })
      await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
      await page.goto(`/${CC}/cart`)
      const row = page.getByTestId("product-row")
      await expectFieldError(row.getByTestId("cart-flash-exceeds-remaining"))
      const [rowBox, warnBox] = [await row.boundingBox(), await row.getByTestId("cart-flash-exceeds-remaining").boundingBox()]
      expect(warnBox!.x + warnBox!.width, "คำเตือนอยู่ในแถว").toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 0.5)
      await noHorizontalOverflow(page)
    })
  } finally {
    if (campaignId) await endFlashCampaign(request, admin, campaignId)
    await deleteAllThenExpectOk(request, admin, [`/admin/products/${productId}`])
  }
})
