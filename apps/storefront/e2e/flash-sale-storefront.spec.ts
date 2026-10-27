import { APIRequestContext, APIResponse, BrowserContext, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { expectThai } from "./support/thai-text"

// FS-6 (spec 03): ราคา flash + countdown + "เหลือ N ชิ้น"/"สินค้าหมด" บน PDP และข้อความ "code ชนะ" ใน cart
// AC-1, AC-4, AC-8 (g), AC-13 (e) — สร้างสินค้า/แคมเปญเฉพาะของ test นี้ (promotion มี target rule เฉพาะสินค้านี้
// จึงไม่กระทบ e2e อื่นที่ใช้สินค้า seed) และปิดแคมเปญเมื่อจบ
// หา element ด้วย data-testid เท่านั้น ตรวจความเป็นไทยด้วย regex อักษรไทย (ADR-014)
test.use({ evidenceTarget: { feature: "flash-sale", taskId: "FS-6" } })
test.describe.configure({ mode: "serial" })

const PRICE = 1000
const FLASH_PRICE = 800 // -20% (Promotion module ของ Medusa คำนวณ — test แค่เทียบผล)
const CAP = 10
const ENDS_IN_MS = 30 * 60_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin/store API ใน e2e
const ok = async (res: APIResponse, what: string): Promise<any> => {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}

let admin: Headers
let pk: string
let regionId: string
let handle: string
let variantId: string
let campaignId: string
let code: string
let endsAt: number

const storeHeaders = (customer: Customer) => ({
  authorization: `Bearer ${customer.token}`,
  "x-publishable-api-key": pk,
})

/** cart ของ customer ที่มีสินค้า flash `quantity` ชิ้น (store API ด้วย token ของเจ้าของ cart — CORE-6/CORE-12) */
async function flashCart(request: APIRequestContext, customer: Customer, quantity = 1): Promise<string> {
  const headers = storeHeaders(customer)
  const { cart } = await ok(
    await request.post(`${BACKEND_URL}/store/carts`, { headers, data: { region_id: regionId } }),
    "create cart"
  )
  await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cart.id}/line-items`, {
      headers,
      data: { variant_id: variantId, quantity },
    }),
    "add flash item"
  )
  return cart.id
}

async function openCart(page: Page, context: BrowserContext, baseURL: string, cartId: string) {
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL }])
  await page.goto(`/${CC}/cart`)
  await expect(page.getByTestId("cart-totals")).toBeVisible()
}

async function setConfig(request: APIRequestContext, data: object) {
  await ok(
    await request.post(`${BACKEND_URL}/admin/flash-sales/${campaignId}/config`, { headers: admin, data }),
    "flash sale config"
  )
}

async function endCampaign(request: APIRequestContext) {
  await ok(
    await request.post(`${BACKEND_URL}/admin/campaigns/${campaignId}`, {
      headers: admin,
      data: { ends_at: new Date(Date.now() - 60_000).toISOString() },
    }),
    "end campaign"
  )
}

test.beforeAll(async ({ request }) => {
  admin = await adminHeaders(request)
  pk = await publishableKey(request, admin)
  const get = async (path: string) => ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  const run = `${Date.now()}`

  const { regions } = await get("/admin/regions?fields=id,*countries")
  regionId = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === CC)).id
  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
  const { stock_locations } = await get("/admin/stock-locations?limit=1")

  handle = `e2e-fs6-${run}`
  const { product } = await ok(
    await request.post(`${BACKEND_URL}/admin/products?fields=id,*variants,*variants.inventory_items`, {
      headers: admin,
      data: {
        title: `E2E Flash ${run}`,
        handle,
        status: "published",
        shipping_profile_id: shipping_profiles[0].id,
        sales_channels: [{ id: sales_channels[0].id }],
        options: [{ title: "Size", values: ["M"] }],
        variants: [
          {
            title: "M",
            sku: `FS6-${run}`,
            options: { Size: "M" },
            manage_inventory: true,
            prices: [{ currency_code: "thb", amount: PRICE }],
          },
        ],
      },
    }),
    "create product"
  )
  variantId = product.variants[0].id
  await ok(
    await request.post(
      `${BACKEND_URL}/admin/inventory-items/${product.variants[0].inventory_items[0].inventory_item_id}/location-levels`,
      { headers: admin, data: { location_id: stock_locations[0].id, stocked_quantity: 100 } }
    ),
    "stock"
  )

  endsAt = Date.now() + ENDS_IN_MS
  const { campaign } = await ok(
    await request.post(`${BACKEND_URL}/admin/campaigns`, {
      headers: admin,
      data: {
        name: `FS-6 ${run}`,
        campaign_identifier: `fs6-${run}`,
        starts_at: new Date(Date.now() - 60 * 60_000).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
      },
    }),
    "create campaign"
  )
  campaignId = campaign.id

  const promotion = async (promoCode: string, value: number, extra: object) =>
    ok(
      await request.post(`${BACKEND_URL}/admin/promotions`, {
        headers: admin,
        data: {
          code: promoCode,
          type: "standard",
          status: "active",
          ...extra,
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "across",
            value,
            target_rules: [{ attribute: "items.product.id", operator: "in", values: [product.id] }],
          },
        },
      }),
      `create promotion ${promoCode}`
    )
  // AC-1: automatic −20% ในแคมเปญ; FS-5 ใส่ exclusivity rule ให้ตอนบันทึก config (กฎข้อ 7)
  await promotion(`FS6-FLASH-${run}`, 20, { is_automatic: true, campaign_id: campaignId })
  code = `FS6-SAVE10-${run}`
  await promotion(code, 10, { is_automatic: false })
  await setConfig(request, {
    total_cap: CAP,
    show_countdown: true,
    show_remaining: true,
    banner_text: "แฟลชเซลทดสอบ ลด 20%",
  })
})

test.afterAll(async ({ request }) => {
  if (campaignId) await endCampaign(request)
})

test("AC-4, AC-13: PDP แสดง banner, countdown, ราคา flash + ราคาขีดฆ่า, เหลือ N ชิ้น และหายเมื่อเลย ends_at (T−1min / T+1min)", async ({
  page,
  step,
  evidence,
}) => {
  // นาฬิกาของ browser = 1 นาทีก่อน ends_at (backend ใช้เวลาจริง แคมเปญยังทำงาน)
  await page.clock.install({ time: endsAt - 60_000 })

  await step("T−1min: ราคา flash, ราคาขีดฆ่า, countdown และจำนวนที่เหลือ", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    await expect(page.getByTestId("flash-sale")).toBeVisible()
    await expect(page.getByTestId("flash-banner")).toHaveText("แฟลชเซลทดสอบ ลด 20%")
    await expect(page.getByTestId("flash-price")).toHaveText("฿800")
    await expect(page.getByTestId("flash-original-price")).toHaveText("฿1,000")
    await expect(page.getByTestId("flash-original-price")).toHaveCSS("text-decoration-line", "line-through")
    await expect(page.getByTestId("flash-countdown")).toContainText(/00:0[01]:\d\d/)
    await expect(page.getByTestId("flash-remaining")).toContainText(`${CAP}`)
    await expectThai(page, ["flash-countdown", "flash-remaining"])
    await evidence("01-pdp-flash-t-minus-1min")
  })

  await step("T+1min: countdown หมด → ไม่แสดงราคา flash เหลือราคาปกติ", async () => {
    await page.clock.fastForward("02:00")
    await expect(page.getByTestId("flash-sale")).toHaveCount(0)
    await expect(page.getByTestId("product-price")).toHaveText("฿1,000")
    await evidence("02-pdp-flash-t-plus-1min")
  })
})

test("AC-1, AC-8 (g): cart ได้ส่วนลด flash; ใส่ code แล้วแสดงข้อความว่าใช้ร่วมกันไม่ได้", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const cartId = await flashCart(request, customer)

  await step("AC-1: cart แสดงยอดหลังส่วนลด flash", async () => {
    await openCart(page, context, baseURL!, cartId)
    // ยอดรวมรวมภาษี (ราคา THB รวม VAT) — ส่วนลด flash −20% คำนวณโดย Medusa
    await expect(page.getByTestId("cart-discount")).toBeVisible()
    await expect(page.getByTestId("cart-total")).toHaveAttribute("data-value", `${FLASH_PRICE}`)
    await expect(page.getByTestId("flash-not-combinable")).toHaveCount(0)
    await evidence("03-cart-flash-discount")
  })

  await step("AC-8 (g): ใส่ code → ส่วนลด flash หลุด (code ชนะ) และแสดงข้อความภาษาไทย", async () => {
    // ใส่ code ผ่านฟอร์มของ storefront (server action revalidate cart ให้)
    await page.getByTestId("add-discount-button").click()
    await page.getByTestId("discount-input").fill(code)
    await page.getByTestId("discount-apply-button").click()
    await expect(page.getByTestId("discount-code")).toContainText(code)
    await expect(page.getByTestId("cart-total")).toHaveAttribute("data-value", `${PRICE * 0.9}`)
    await expectThai(page, ["flash-not-combinable"])
    await evidence("04-cart-code-not-combinable")
  })
})

test("AC-13 (e): units_sold ถึง total_cap → PDP แสดง 'สินค้าหมด'", async ({ page, request, step, evidence }) => {
  await step("ลด total_cap เป็น 1 แล้ว complete cart flash 1 ชิ้น (units_sold = 1)", async () => {
    await setConfig(request, { total_cap: 1 })
    const customer = await createCustomer(request, pk)
    const headers = storeHeaders(customer)
    const cartId = await flashCart(request, customer)
    const address = {
      first_name: "Somchai",
      last_name: "Jaidee",
      address_1: "1 Sukhumvit Rd",
      city: "Bangkok",
      postal_code: "10110",
      country_code: CC,
    }
    const post = async (path: string, data: object) =>
      ok(await request.post(`${BACKEND_URL}${path}`, { headers, data }), path)
    await post(`/store/carts/${cartId}`, { email: customer.email, shipping_address: address, billing_address: address })
    const { shipping_options } = await ok(
      await request.get(`${BACKEND_URL}/store/shipping-options?cart_id=${cartId}`, { headers }),
      "shipping options"
    )
    const standard = shipping_options.find((o: { name: string }) => o.name === "Standard")
    await post(`/store/carts/${cartId}/shipping-methods`, { option_id: standard.id })
    const { payment_collection } = await post("/store/payment-collections", { cart_id: cartId })
    await post(`/store/payment-collections/${payment_collection.id}/payment-sessions`, {
      provider_id: "pp_system_default",
    })
    const completed = await post(`/store/carts/${cartId}/complete`, {})
    expect(completed.type, JSON.stringify(completed)).toBe("order")
  })

  await step("PDP: flash-sold-out มองเห็นได้และเป็นภาษาไทย ไม่มีราคา flash", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    await expectThai(page, ["flash-sold-out"])
    await expect(page.getByTestId("flash-price")).toHaveCount(0)
    await expect(page.getByTestId("flash-remaining")).toHaveCount(0)
    await evidence("05-pdp-flash-sold-out")
  })
})

test("AC-1: หลัง ends_at cart ใหม่แสดงราคาเต็ม", async ({ page, context, request, baseURL, step }) => {
  await endCampaign(request)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const cartId = await flashCart(request, customer)

  await step("cart ใหม่ไม่มีส่วนลด flash", async () => {
    await openCart(page, context, baseURL!, cartId)
    await expect(page.getByTestId("cart-total")).toHaveAttribute("data-value", `${PRICE}`)
    await expect(page.getByTestId("cart-discount")).toHaveCount(0)
  })

  await step("PDP ไม่แสดง flash แล้ว", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    await expect(page.getByTestId("product-price")).toHaveText("฿1,000")
    await expect(page.getByTestId("flash-sale")).toHaveCount(0)
  })
})
