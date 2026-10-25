import { convertToLocale } from "../src/lib/util/money"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  shippingOptionId,
  signInAs,
  variantOf,
} from "./support/medusa"

// CORE-6: spec 01 AC-1, AC-2, AC-3, AC-4, AC-6 — หา element ด้วย data-testid เท่านั้น (ADR-008 ข้อ 3)
// ข้อมูลตั้งต้นจาก seed (CORE-2): region Thailand, t-shirt, shipping "Standard", manual payment provider
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-6" } })

const PRODUCT = "t-shirt"

test("AC-6: guest กด Add to cart → ไปหน้า login, API cart ตอบ 401, ล็อกอินแล้วสินค้าเข้า cart", async ({
  page,
  request,
  step,
  evidence,
}) => {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const { variantId } = await variantOf(request, pk, PRODUCT)

  await step("guest กด Add to cart บนหน้าสินค้า → ถูกส่งไปหน้า login", async () => {
    await page.goto(`/${CC}/products/${PRODUCT}`)
    await page.getByTestId("add-product-button").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/account\\?add_variant=`))
    await expect(page.getByTestId("login-page")).toBeVisible()
    await evidence("01-guest-add-to-cart-login")
  })

  await step("POST /store/carts และ /store/carts/:id/line-items โดยไม่มี session → 401", async () => {
    const guest = { "x-publishable-api-key": pk }
    const create = await request.post(`${BACKEND_URL}/store/carts`, { headers: guest, data: {} })
    expect(create.status()).toBe(401)
    const addItem = await request.post(`${BACKEND_URL}/store/carts/cart_any/line-items`, {
      headers: guest,
      data: { variant_id: variantId, quantity: 1 },
    })
    expect(addItem.status()).toBe(401)
  })

  await step("ล็อกอิน → สินค้าที่กดค้างไว้ถูกเพิ่มลง cart", async () => {
    await page.getByTestId("email-input").fill(customer.email)
    await page.getByTestId("password-input").fill(customer.password)
    await page.getByTestId("sign-in-button").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/cart$`))
    await expect(page.getByTestId("product-row")).toHaveCount(1)
    await evidence("02-cart-after-login")
  })
})

test("AC-1, AC-2, AC-3: checkout ด้วย manual payment → admin capture → shipped email → My orders", async ({
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
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  let orderId = ""

  await step("ลูกค้าเพิ่มสินค้าลง cart", async () => {
    await page.goto(`/${CC}/products/${PRODUCT}`)
    await page.getByTestId("add-product-button").click()
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
    await page.goto(`/${CC}/cart`)
    await expect(page.getByTestId("product-row")).toHaveCount(1)
  })

  await step("checkout: ที่อยู่จัดส่ง", async () => {
    await page.getByTestId("checkout-button").click()
    await expect(page.getByTestId("shipping-first-name-input")).toBeVisible()
    await page.getByTestId("shipping-first-name-input").fill("Somchai")
    await page.getByTestId("shipping-last-name-input").fill("Jaidee")
    await page.getByTestId("shipping-address-input").fill("1 Sukhumvit Rd")
    await page.getByTestId("shipping-postal-code-input").fill("10110")
    await page.getByTestId("shipping-city-input").fill("Bangkok")
    await page.getByTestId("shipping-country-select").selectOption(CC)
    await page.getByTestId("shipping-email-input").fill(customer.email)
    await page.getByTestId("submit-address-button").click()
  })

  await step("checkout: เลือก Standard delivery", async () => {
    // หา option ด้วย id จาก API (ชื่อ "Standard" ใน seed) ไม่ match ด้วยข้อความบนหน้า (ADR-008)
    const standardId = await shippingOptionId(request, context, pk, customer, "Standard")
    await page.locator(`[data-testid="delivery-option-radio"][data-option-id="${standardId}"]`).click()
    await page.getByTestId("submit-delivery-option-button").click()
  })

  await step("checkout: ชำระด้วย manual payment provider แล้วยืนยัน order", async () => {
    await page.getByTestId("payment-option-pp_system_default").click()
    await page.getByTestId("submit-payment-button").click()
    await page.getByTestId("submit-order-button").click()
    await expect(page.getByTestId("order-complete-container")).toBeVisible({ timeout: 30_000 })
    orderId = page.url().match(/\/order\/([^/]+)\/confirmed/)![1]
    await evidence("03-order-confirmed")
  })

  await step("AC-1: admin เห็น order เป็น authorized → capture → captured", async () => {
    const fields = "id,email,payment_status,*items,*payment_collections.payments"
    const before = await (await request.get(`${BACKEND_URL}/admin/orders/${orderId}?fields=${fields}`, { headers: admin })).json()
    expect(before.order.email).toBe(customer.email)
    expect(before.order.payment_status).toBe("authorized")

    const paymentId = before.order.payment_collections[0].payments[0].id
    const capture = await request.post(`${BACKEND_URL}/admin/payments/${paymentId}/capture`, { headers: admin, data: {} })
    expect(capture.status()).toBe(200)
    const after = await (await request.get(`${BACKEND_URL}/admin/orders/${orderId}?fields=${fields}`, { headers: admin })).json()
    expect(after.order.payment_status).toBe("captured")
  })

  await step("AC-2: admin สร้าง fulfillment + mark shipped → ลูกค้าได้อีเมล order-shipped", async () => {
    const { order } = await (await request.get(`${BACKEND_URL}/admin/orders/${orderId}?fields=id,*items`, { headers: admin })).json()
    const items = order.items.map((i: { id: string; quantity: number }) => ({ id: i.id, quantity: i.quantity }))
    const fulfilled = await request.post(`${BACKEND_URL}/admin/orders/${orderId}/fulfillments?fields=id,*fulfillments`, {
      headers: admin,
      data: { items },
    })
    expect(fulfilled.status()).toBe(200)
    const fulfillmentId = (await fulfilled.json()).order.fulfillments[0].id
    const shipped = await request.post(
      `${BACKEND_URL}/admin/orders/${orderId}/fulfillments/${fulfillmentId}/shipments`,
      { headers: admin, data: { items } }
    )
    expect(shipped.status()).toBe(200)

    // test inbox = notification ที่ provider local ของ Medusa บันทึก (dev/CI ไม่มี RESEND_API_KEY)
    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${BACKEND_URL}/admin/notifications?to=${encodeURIComponent(customer.email)}&channel=email&fields=template`,
            { headers: admin }
          )
          return (await res.json()).notifications.map((n: { template: string }) => n.template)
        },
        { timeout: 15_000 }
      )
      .toContain("order-shipped")
  })

  await step("AC-3: My orders แสดง order ของลูกค้าพร้อมยอดรวม THB", async () => {
    const { order } = await (await request.get(`${BACKEND_URL}/admin/orders/${orderId}?fields=id,display_id,total,currency_code`, { headers: admin })).json()
    await page.goto(`/${CC}/account`)
    await page.getByTestId("orders-link").filter({ visible: true }).click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/account/orders$`))
    const card = page.getByTestId("order-card")
    await expect(card).toHaveCount(1)
    await expect(card.getByTestId("order-display-id")).toHaveText(String(order.display_id))
    await expect(card.getByTestId("order-amount")).toHaveText(
      convertToLocale({ amount: order.total, currency_code: order.currency_code })
    )
    expect(order.currency_code).toBe("thb")
    await evidence("04-my-orders")
  })
})

test("AC-4: admin สร้างสินค้า 2 variant พร้อม stock → ขึ้นบน storefront ภายใน 5 วินาที", async ({
  page,
  request,
  step,
  evidence,
}) => {
  const admin = await adminHeaders(request)
  const handle = `e2e-core6-${Date.now()}`
  let createdAt = 0

  await step("admin สร้างสินค้า 2 variant (THB) และตั้ง stock", async () => {
    const get = async (path: string) => (await request.get(`${BACKEND_URL}${path}`, { headers: admin })).json()
    const { sales_channels } = await get("/admin/sales-channels?limit=1")
    const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
    const { stock_locations } = await get("/admin/stock-locations?limit=1")

    const res = await request.post(`${BACKEND_URL}/admin/products?fields=id,*variants,*variants.inventory_items`, {
      headers: admin,
      data: {
        title: `E2E Shirt ${handle}`,
        handle,
        status: "published",
        shipping_profile_id: shipping_profiles[0].id,
        sales_channels: [{ id: sales_channels[0].id }],
        options: [{ title: "Size", values: ["S", "M"] }],
        variants: ["S", "M"].map((size) => ({
          title: size,
          sku: `${handle}-${size}`.toUpperCase(),
          options: { Size: size },
          manage_inventory: true,
          prices: [{ currency_code: "thb", amount: 590 }],
        })),
      },
    })
    expect(res.status()).toBe(200)
    const { product } = await res.json()
    expect(product.variants).toHaveLength(2)

    for (const variant of product.variants) {
      const inventoryItemId = variant.inventory_items[0].inventory_item_id
      const level = await request.post(`${BACKEND_URL}/admin/inventory-items/${inventoryItemId}/location-levels`, {
        headers: admin,
        data: { location_id: stock_locations[0].id, stocked_quantity: 10 },
      })
      expect(level.status()).toBe(200)
    }
    createdAt = Date.now()
  })

  await step("หน้าสินค้าบน storefront แสดงสินค้าใหม่พร้อมสั่งได้ภายใน 5 วินาที", async () => {
    await expect(async () => {
      await page.goto(`/${CC}/products/${handle}`)
      await expect(page.getByTestId("product-container")).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 5_000 })
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
    expect(Date.now() - createdAt).toBeLessThanOrEqual(5_000)
    await evidence("05-new-product-on-storefront")
  })
})
