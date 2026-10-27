import { Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
  variantOf,
} from "./support/medusa"

// CORE-24: spec 01 AC-94 (กฎข้อ 59) — ตัวเลือกจำนวนบน PDP ทั้งโหมด JS และ no-JS; หา element ด้วย data-testid เท่านั้น
// ข้อมูลตั้งต้นจาก seed (CORE-2): region Thailand, t-shirt
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-24" } })

const PRODUCT = "t-shirt"

/** line ของ cart ปัจจุบันใน browser (cookie `_medusa_cart_id`) อ่านด้วย token ของเจ้าของ cart */
async function cartLines(page: Page, customer: Customer, pk: string) {
  const cartId = (await page.context().cookies()).find((c) => c.name === "_medusa_cart_id")?.value
  expect(cartId, "cart cookie").toBeTruthy()
  const res = await page.request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=id,*items`, {
    headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
  })
  expect(res.status()).toBe(200)
  const items = (await res.json()).cart.items as { variant_id: string; quantity: number }[]
  return items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity }))
}

test("AC-94: (JS) เลือก 3 ใน product-quantity-select แล้วกดเพิ่มลง cart → cart มี line qty 3", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const { variantId } = await variantOf(request, pk, PRODUCT)
  await signInAs(context, baseURL!, customer)

  await step("PDP มีตัวเลือกจำนวน 1..10 ค่าเริ่มต้น 1", async () => {
    await page.goto(`/${CC}/products/${PRODUCT}`)
    const select = page.getByTestId("product-quantity-select")
    await expect(select).toHaveValue("1")
    await expect(select.locator("option")).toHaveText(Array.from({ length: 10 }, (_, i) => String(i + 1)))
  })

  await step("เลือก 3 แล้วกดเพิ่มลงตะกร้า (server action)", async () => {
    await page.getByTestId("product-quantity-select").selectOption("3")
    const done = page.waitForResponse((r) => r.request().headers()["next-action"] !== undefined)
    await page.getByTestId("add-product-button").click()
    await done
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
    await evidence("01-js-quantity-3")
  })

  await step("cart มี line ของ variant นั้น quantity=3", async () => {
    expect(await cartLines(page, customer, pk)).toEqual([{ variant_id: variantId, quantity: 3 }])
  })
})

test.describe("ปิด JavaScript", () => {
  test.use({ javaScriptEnabled: false })

  test("AC-94: (no-JS, ไม่ล็อกอิน) เลือก 2 แล้ว submit และ login → cart มี qty 2", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    const pk = await publishableKey(request, await adminHeaders(request))
    const customer = await createCustomer(request, pk)
    const { variantId } = await variantOf(request, pk, PRODUCT)

    await step("PDP (ไม่มี JS) เลือก 2 แล้วกดเพิ่มลงตะกร้า → หน้า login คง variant และ quantity", async () => {
      await page.goto(`/${CC}/products/${PRODUCT}`)
      await page.getByTestId("product-quantity-select").selectOption("2")
      await page.getByTestId("add-product-button").click()
      await expect(page).toHaveURL(new RegExp(`/${CC}/account\\?add_variant=.+&add_quantity=2`))
      await expect(page.getByTestId("login-page")).toBeVisible()
      await evidence("02-nojs-login-quantity-2")
    })

    await step("ล็อกอิน (ไม่มี JS) → cart มี line ของ variant นั้น quantity=2", async () => {
      await page.getByTestId("email-input").fill(customer.email)
      await page.getByTestId("password-input").fill(customer.password)
      await page.getByTestId("sign-in-button").click()
      await expect(page).toHaveURL(new RegExp(`/${CC}/cart$`))
      expect(await cartLines(page, customer, pk)).toEqual([{ variant_id: variantId, quantity: 2 }])
    })
  })
})

// qa #134 D-1: เลือกจำนวนเกิน stock แล้ว addToCart ล้ม → ต้องเห็นข้อความไทยและปุ่ม/ตัวเลือกจำนวนกลับมาใช้ได้ (ไม่ค้าง isAdding)
// ข้อสังเกตเพิ่ม: variant ที่หมด → ตัวเลือกจำนวน disable พร้อมปุ่ม
test("qa D-1: (JS) เลือกจำนวนเกิน stock → add-to-cart-error ภาษาไทย ปุ่มและตัวเลือกจำนวนใช้ต่อได้", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(60_000) // สร้างสินค้าใหม่ + render PDP ครั้งแรก
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const handle = `e2e-core24-${Date.now()}`
  let inStockVariantId = ""

  await step("admin สร้างสินค้า: S มี stock 2, M stock 0", async () => {
    const get = async (path: string) => (await request.get(`${BACKEND_URL}${path}`, { headers: admin })).json()
    const { sales_channels } = await get("/admin/sales-channels?limit=1")
    const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
    const { stock_locations } = await get("/admin/stock-locations?limit=1")
    const res = await request.post(`${BACKEND_URL}/admin/products?fields=id,*variants,*variants.inventory_items`, {
      headers: admin,
      data: {
        title: `E2E CORE-24 ${handle}`,
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
    for (const variant of product.variants as { title: string; id: string; inventory_items: { inventory_item_id: string }[] }[]) {
      const level = await request.post(
        `${BACKEND_URL}/admin/inventory-items/${variant.inventory_items[0].inventory_item_id}/location-levels`,
        { headers: admin, data: { location_id: stock_locations[0].id, stocked_quantity: variant.title === "S" ? 2 : 0 } }
      )
      expect(level.status()).toBe(200)
      if (variant.title === "S") inStockVariantId = variant.id
    }
  })

  await signInAs(context, baseURL!, customer)

  await step("เลือก 5 (เกิน stock 2) แล้วกดเพิ่ม → เห็น add-to-cart-error ภาษาไทย ปุ่มและตัวเลือกจำนวนใช้ได้", async () => {
    await expect(async () => {
      await page.goto(`/${CC}/products/${handle}`)
      await expect(page.getByTestId("add-product-button")).toBeEnabled({ timeout: 2_000 })
    }).toPass({ timeout: 15_000 })
    await page.getByTestId("product-quantity-select").selectOption("5")
    await page.getByTestId("add-product-button").click()
    const error = page.getByTestId("add-to-cart-error")
    await expect(error).toBeVisible()
    await expect(error).toHaveText(/[฀-๿]/)
    await expect(error).not.toContainText("inventory")
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
    await expect(page.getByTestId("product-quantity-select")).toBeEnabled()
    await evidence("03-js-over-stock-error")
  })

  await step("เลือก M (หมด) → ปุ่มและตัวเลือกจำนวน disable", async () => {
    await page.getByTestId("product-options").getByTestId("option-button").filter({ hasText: "M" }).click()
    await expect(page.getByTestId("add-product-button")).toBeDisabled()
    await expect(page.getByTestId("product-quantity-select")).toBeDisabled()
  })

  await step("กลับไปเลือก S เลือก 2 แล้วกดเพิ่ม → ข้อความหาย และ cart มี qty 2", async () => {
    await page.getByTestId("product-options").getByTestId("option-button").filter({ hasText: "S" }).click()
    await page.getByTestId("product-quantity-select").selectOption("2")
    const done = page.waitForResponse((r) => r.request().headers()["next-action"] !== undefined)
    await page.getByTestId("add-product-button").click()
    await done
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
    await expect(page.getByTestId("add-to-cart-error")).toHaveCount(0)
    expect(await cartLines(page, customer, pk)).toEqual([{ variant_id: inStockVariantId, quantity: 2 }])
  })

})
