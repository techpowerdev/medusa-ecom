import { APIRequestContext, APIResponse, Locator } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { isAddToCartBody, waitForServerAction } from "./support/server-action"

// CORE-26: spec 01 AC-117 (กฎข้อ 81, qa #199) — ยอดรวมใน dropdown ของตะกร้า = `item_total` ที่ Medusa คำนวณ
// (หลังส่วนลด flash รวม VAT) ตรงกับราคาต่อ line, แถว `cart-totals` รวมได้ยอดสุทธิ และ dropdown ที่เปิดเองปิดเองใน 5 วินาที
// สร้างสินค้า/แคมเปญเฉพาะของ test นี้ (promotion มี target rule เฉพาะสินค้านี้) และปิดแคมเปญเมื่อจบ
// หา element ด้วย data-testid เท่านั้น
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-26" } })
test.describe.configure({ mode: "serial" })

const PRICE = 2950 // ราคาร้านรวม VAT (seed: THB is_tax_inclusive)
const QTY = 2

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin/store API ใน e2e
const ok = async (res: APIResponse, what: string): Promise<any> => {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}

let admin: Headers
let pk: string
let handle: string
let variantId: string
let campaignId: string

/** ตัวเลขจากข้อความเงินที่แสดง เช่น "฿4,720.00" → 4720 */
const shownAmount = async (el: Locator) => Number((await el.innerText()).replace(/[^\d.]/g, ""))
const dataValue = async (el: Locator) => Number(await el.getAttribute("data-value"))

async function storeCart(request: APIRequestContext, customer: Customer, cartId: string) {
  const { cart } = await ok(
    await request.get(`${BACKEND_URL}/store/carts/${cartId}`, {
      headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
    }),
    "get cart"
  )
  return cart
}

test.beforeAll(async ({ request }) => {
  admin = await adminHeaders(request)
  pk = await publishableKey(request, admin)
  const get = async (path: string) => ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  const run = `${Date.now()}`

  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
  const { stock_locations } = await get("/admin/stock-locations?limit=1")

  handle = `e2e-core26-${run}`
  const { product } = await ok(
    await request.post(`${BACKEND_URL}/admin/products?fields=id,*variants,*variants.inventory_items`, {
      headers: admin,
      data: {
        title: `E2E CORE-26 ${run}`,
        handle,
        status: "published",
        shipping_profile_id: shipping_profiles[0].id,
        sales_channels: [{ id: sales_channels[0].id }],
        options: [{ title: "Size", values: ["M"] }],
        variants: [
          {
            title: "M",
            sku: `CORE26-${run}`,
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

  const { campaign } = await ok(
    await request.post(`${BACKEND_URL}/admin/campaigns`, {
      headers: admin,
      data: {
        name: `CORE-26 ${run}`,
        campaign_identifier: `core26-${run}`,
        starts_at: new Date(Date.now() - 60 * 60_000).toISOString(),
        ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      },
    }),
    "create campaign"
  )
  campaignId = campaign.id
  // flash −20% แบบ automatic (Promotion module ของ Medusa คำนวณ — test แค่เทียบผล)
  await ok(
    await request.post(`${BACKEND_URL}/admin/promotions`, {
      headers: admin,
      data: {
        code: `CORE26-FLASH-${run}`,
        type: "standard",
        status: "active",
        is_automatic: true,
        campaign_id: campaignId,
        application_method: {
          type: "percentage",
          target_type: "items",
          allocation: "across",
          value: 20,
          target_rules: [{ attribute: "items.product.id", operator: "in", values: [product.id] }],
        },
      },
    }),
    "create flash promotion"
  )
  await ok(
    await request.post(`${BACKEND_URL}/admin/flash-sales/${campaignId}/config`, {
      headers: admin,
      data: { total_cap: 50, show_countdown: true, show_remaining: true },
    }),
    "flash sale config"
  )
})

test.afterAll(async ({ request }) => {
  if (!campaignId) return
  await ok(
    await request.post(`${BACKEND_URL}/admin/campaigns/${campaignId}`, {
      headers: admin,
      data: { ends_at: new Date(Date.now() - 60_000).toISOString() },
    }),
    "end campaign"
  )
})

test("AC-117: dropdown แสดง item_total หลังส่วนลด flash ป้าย 'รวม VAT' และแถว cart-totals รวมได้ยอดสุทธิ", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const customer = await createCustomer(request, pk)
  const cartId = await cartReadyForPayment(request, pk, customer, { quantity: QTY, variant: variantId })
  await signInAs(context, baseURL!, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
  const cart = await storeCart(request, customer, cartId)
  // ยืนยันว่าส่วนลด flash ทำงานจริง (ไม่งั้น test ผ่านโดยไม่ได้ตรวจเคสของ qa)
  expect(cart.discount_total, "flash discount").toBeGreaterThan(0)
  expect(cart.item_total).toBeCloseTo(PRICE * QTY * 0.8, 2)

  await step("ชี้ nav-cart-link → cart-subtotal = item_total = ผลรวมราคา line ที่แสดง", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    await page.getByTestId("nav-cart-link").hover()
    const dropdown = page.getByTestId("nav-cart-dropdown")
    await expect(dropdown).toBeVisible()
    const total = dropdown.getByTestId("cart-subtotal")
    expect(await dataValue(total)).toBeCloseTo(cart.item_total, 2)
    expect(await shownAmount(total)).toBeCloseTo(cart.item_total, 2)

    const linePrices = await dropdown.getByTestId("cart-item").getByTestId("product-price").all()
    let sum = 0
    for (const price of linePrices) sum += await shownAmount(price)
    expect(sum).toBeCloseTo(await dataValue(total), 2)

    const label = dropdown.getByTestId("cart-subtotal-label")
    await expect(label).toHaveText("ยอดรวมสินค้า (รวม VAT)")
    await expect(dropdown).not.toContainText("ไม่รวมภาษี")
    await evidence("01-dropdown-item-total")
  })

  // CORE-57 (กฎข้อ 115b): แถวรวม VAT ทั้งชุด — แถว "รวม VAT แล้ว" (cart-taxes) เป็นข้อมูลไม่บวกซ้ำ
  await step("/th/cart: ยอดก่อนส่วนลด − ส่วนลด + ค่าจัดส่ง = ยอดรวมทั้งสิ้น (±0.01)", async () => {
    await page.goto(`/${CC}/cart`)
    const totals = page.getByTestId("cart-totals")
    await expect(totals).toBeVisible()
    const discount = totals.getByTestId("cart-discount")
    await expect(discount).toBeVisible()
    const rows =
      (await dataValue(totals.getByTestId("cart-subtotal"))) -
      (await dataValue(discount)) +
      (await dataValue(totals.getByTestId("cart-shipping")))
    const grand = await dataValue(totals.getByTestId("cart-total"))
    expect(Math.abs(rows - grand), `rows=${rows} total=${grand}`).toBeLessThanOrEqual(0.01)
    expect(grand).toBeCloseTo(cart.total, 2)
    await evidence("02-cart-totals-sum")
  })
})

test("AC-117: กดเพิ่มบน PDP แล้ว mouse ค้างใต้ panel → dropdown หายภายใน 6 วินาที กดซ้ำด้วย click() ได้ และชี้ nav-cart-link ยังเปิดค้าง", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(60_000)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  await page.goto(`/${CC}/products/${handle}`)
  await expect(page).toHaveURL(/[?&]v_id=/)
  const button = page.getByTestId("add-product-button")
  const dropdown = page.getByTestId("nav-cart-dropdown")

  /** กดเพิ่มด้วย `click()` ปกติแล้วรอ server action ตอบ (timeout สั้นกว่า test — dropdown ที่ค้างเปิดทับปุ่ม = ล้มเร็ว) */
  const add = async () => {
    const done = waitForServerAction(page, isAddToCartBody)
    await button.click({ timeout: 10_000 })
    await done
  }

  /**
   * mouse ที่ค้างอยู่ใต้ panel (review #199: panel เปิดทับคอลัมน์ขวาของ PDP ตรงที่ลูกค้าเพิ่งกด) — วาง mouse ในกรอบ panel
   * ให้แน่นอนทุกขนาดของ panel (จำนวน line ต่างกันทำให้ panel สูงไม่เท่ากัน) แล้วไม่ขยับอีก
   */
  const mouseUnderPanel = async () => {
    const box = (await dropdown.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 10)
  }

  await step("กดเพิ่ม → dropdown เปิดเอง, mouse อยู่ใต้ panel → หายภายใน 6 วินาที", async () => {
    await add()
    await expect(dropdown).toBeVisible()
    await mouseUnderPanel()
    await evidence("03-dropdown-auto-open")
    await expect(dropdown).toBeHidden({ timeout: 6_000 })
  })

  await step("กดเพิ่มซ้ำด้วย click() ปกติ → เปิดเองอีกครั้งใต้ mouse แล้วปิดเอง และกดครั้งถัดไปได้", async () => {
    await expect(button).toBeEnabled()
    await add()
    await expect(page.getByTestId("nav-cart-link")).toContainText("2")
    await expect(dropdown).toBeVisible()
    await mouseUnderPanel()
    // click() ของ Playwright รอจน panel ไม่ทับปุ่ม — ถ้า panel ค้างเปิดเพราะ hover จะ timeout
    await add()
    await expect(page.getByTestId("nav-cart-link")).toContainText("3")
    await expect(dropdown).toBeHidden({ timeout: 6_000 })
  })

  await step("ชี้ nav-cart-link → dropdown เปิดค้าง (เกิน 5 วินาที)", async () => {
    await page.getByTestId("nav-cart-link").hover()
    await expect(dropdown).toBeVisible()
    await page.waitForTimeout(6_000)
    await expect(dropdown).toBeVisible()
  })
})
