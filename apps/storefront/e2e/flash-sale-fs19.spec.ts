import { APIResponse, Page, Route } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { gate, sleep } from "./support/gate"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { isAddToCartBody, isServerAction, waitForServerAction } from "./support/server-action"

// FS-19 (spec 03 กฎข้อ 24, AC-26) ที่ 375×812: (a) `mobile-cart-button` ของแถบล่างรอข้อมูล flash แบบเดียวกับปุ่มหลัก
// (disabled + aria-busy ระหว่างรอ, error แล้วกดได้) (b) เมื่อปุ่มหลักเข้าจอ แถบล่างซ่อนทันทีโดยไม่จางทับปุ่มหลัก
// สร้างสินค้า/collection/แคมเปญเฉพาะของ test นี้และลบทั้งหมดใน afterAll — หา element ด้วย data-testid (ADR-014)
test.use({ evidenceTarget: { feature: "flash-sale", taskId: "FS-19" }, viewport: { width: 375, height: 812 } })
test.describe.configure({ mode: "serial" })

const PRICE = 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin API ใน e2e
const ok = async (res: APIResponse, what: string): Promise<any> => {
  expect(res.ok(), `${what}: ${res.status()} ${await res.text()}`).toBe(true)
  return res.json()
}

let admin: Headers
let pk: string
let customer: Customer
let handle: string
let productId: string
let collectionId: string
let variantId: string
let campaignId: string
let promotionId: string

/** ข้อมูล flash บน PDP มาจาก server action — mock เฉพาะ POST ที่มี header next-action และ body มี variant ของสินค้านี้ */
async function mockFlashAction(page: Page, handler: (route: Route) => Promise<void>) {
  await page.route(`**/products/${handle}**`, async (route) => {
    const req = route.request()
    if (isServerAction(req, (body) => body.includes(variantId))) {
      return handler(route)
    }
    return route.fallback()
  })
}

test.beforeAll(async ({ request }) => {
  admin = await adminHeaders(request)
  pk = await publishableKey(request, admin)
  customer = await createCustomer(request, pk)
  const get = async (path: string) => ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  const post = async (path: string, data: object) =>
    ok(await request.post(`${BACKEND_URL}${path}`, { headers: admin, data }), path)
  // run id ไม่ซ้ำแม้หลาย worker เริ่ม beforeAll ใน ms เดียวกัน (--repeat-each)
  const run = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
  const { stock_locations } = await get("/admin/stock-locations?limit=1")

  const { collection } = await post("/admin/collections", { title: `FS-19 ${run}`, handle: `e2e-fs19-${run}` })
  collectionId = collection.id

  handle = `e2e-fs19-${run}`
  const { product } = await post("/admin/products?fields=id,*variants,*variants.inventory_items", {
    title: `E2E FS19 ${run}`,
    handle,
    status: "published",
    collection_id: collection.id,
    // รูปดันปุ่มหลักลงใต้ขอบจอ 375×812 → แถบล่างแสดงตั้งแต่โหลด (เหมือน FS-13)
    images: [{ url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png" }],
    shipping_profile_id: shipping_profiles[0].id,
    sales_channels: [{ id: sales_channels[0].id }],
    options: [{ title: "Size", values: ["M"] }],
    variants: [
      {
        title: "M",
        sku: `FS19-${run}`,
        options: { Size: "M" },
        manage_inventory: true,
        prices: [{ currency_code: "thb", amount: PRICE }],
      },
    ],
  })
  productId = product.id
  variantId = product.variants[0].id
  await post(
    `/admin/inventory-items/${product.variants[0].inventory_items[0].inventory_item_id}/location-levels`,
    { location_id: stock_locations[0].id, stocked_quantity: 100 }
  )

  const { campaign } = await post("/admin/campaigns", {
    name: `FS-19 ${run}`,
    campaign_identifier: `fs19-${run}`,
    starts_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  })
  campaignId = campaign.id
  const { promotion } = await post("/admin/promotions", {
    code: `FS19-FLASH-${run}`,
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
  })
  promotionId = promotion.id
  await post(`/admin/flash-sales/${campaignId}/config`, { total_cap: 100, show_countdown: true, show_remaining: true })
})

test.afterAll(async ({ request }) => {
  const del = async (path: string) => ok(await request.delete(`${BACKEND_URL}${path}`, { headers: admin }), `DELETE ${path}`)
  if (promotionId) await del(`/admin/promotions/${promotionId}`)
  if (campaignId) await del(`/admin/campaigns/${campaignId}`)
  if (productId) await del(`/admin/products/${productId}`)
  if (collectionId) await del(`/admin/collections/${collectionId}`)
})

test("AC-26: route ของ flash หน่วง 3 วินาที → mobile-cart-button รอ (aria-busy + disabled) แล้วกดได้หลังตอบ", async ({
  page,
  context,
  baseURL,
  step,
  evidence,
}) => {
  await signInAs(context, baseURL!, customer)
  let answered = false
  const checked = gate()
  await mockFlashAction(page, async (route) => {
    await Promise.all([sleep(3_000), checked.opened])
    await route.continue()
    answered = true
  })

  await step("ระหว่างรอ: แถบล่างแสดง และ mobile-cart-button มี aria-busy=true + disabled", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    await expect(page.getByTestId("add-product-button")).not.toBeInViewport()
    await expect(page.getByTestId("mobile-actions")).toBeVisible()
    const button = page.getByTestId("mobile-cart-button")
    await expect(button).toHaveAttribute("aria-busy", "true")
    await expect(button).toBeDisabled()
    expect(answered, "ต้องตรวจขณะ request flash ยังไม่ตอบ").toBe(false)
    await evidence("01-mobile-bar-waiting-flash")
    checked.open()
  })

  await step("หลังตอบ: ราคา flash บนแถบ ปุ่มกดได้ และกดแล้วเพิ่มลงตะกร้าสำเร็จ", async () => {
    const button = page.getByTestId("mobile-cart-button")
    await expect(page.getByTestId("mobile-actions").getByTestId("flash-price")).toHaveText("฿800", { timeout: 10_000 })
    await expect(button).toBeEnabled()
    await expect(button).not.toHaveAttribute("aria-busy", "true")
    await page.unroute(`**/products/${handle}**`)
    const done = waitForServerAction(page, isAddToCartBody)
    await button.click()
    await done
    await expect(button).toBeEnabled()
    await expect(page.getByTestId("mobile-add-to-cart-error")).toHaveCount(0)
  })
})

test("AC-26: route ของ flash ตอบ 500 → mobile-cart-button กดได้ภายใน 5 วินาที", async ({ page, context, baseURL, step }) => {
  await signInAs(context, baseURL!, customer)
  let served = false
  const checked = gate()
  await mockFlashAction(page, async (route) => {
    await Promise.all([sleep(1_000), checked.opened])
    await route.fulfill({ status: 500, body: "boom" })
    served = true
  })

  await step("ระหว่างรอปุ่มอยู่ในสถานะรอ หลัง 500 ปุ่มกดได้ภายใน 5 วินาที (ไม่ค้าง)", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    const button = page.getByTestId("mobile-cart-button")
    await expect(button).toHaveAttribute("aria-busy", "true")
    checked.open()
    await expect.poll(() => served, { timeout: 5_000 }).toBe(true)
    await expect(button).toBeEnabled({ timeout: 5_000 })
    await expect(button).not.toHaveAttribute("aria-busy", "true")
  })
})

type Sample = { t: number; inDom: boolean; opacity: number; overlap: boolean }

test("AC-26: เลื่อนให้ปุ่มหลักอยู่กลางจอแบบไม่ smooth → แถบล่างซ่อนภายใน 100ms และไม่มี frame ที่จางทับปุ่มหลัก", async ({
  page,
  step,
  evidence,
}) => {
  await step("แถบล่างแสดงเต็ม (opacity 1) ขณะปุ่มหลักอยู่ใต้ขอบจอ", async () => {
    await page.goto(`/${CC}/products/${handle}`)
    await expect(page.getByTestId("mobile-cart-button")).toBeEnabled()
    await expect(page.getByTestId("add-product-button")).not.toBeInViewport()
    await expect(page.getByTestId("mobile-actions")).toHaveCSS("opacity", "1")
  })

  await step("rAF sampler ทุก frame ตั้งแต่ก่อน scroll → scrollIntoView({block:center}) → แถบซ่อนภายใน 100ms ไม่จางทับ", async () => {
    await page.evaluate(() => {
      const w = window as unknown as { __fs19: { samples: Sample[]; scrolledAt: number | null; done: boolean } }
      const state = { samples: [] as Sample[], scrolledAt: null as number | null, done: false }
      w.__fs19 = state
      const started = performance.now()
      const tick = (t: number) => {
        const bar = document.querySelector('[data-testid="mobile-actions"]')
        const main = document.querySelector('[data-testid="add-product-button"]')!.getBoundingClientRect()
        let opacity = 0
        let overlap = false
        if (bar) {
          opacity = Number(getComputedStyle(bar).opacity)
          const b = bar.getBoundingClientRect()
          overlap = main.left < b.right && b.left < main.right && main.top < b.bottom && b.top < main.bottom
        }
        state.samples.push({ t, inDom: !!bar, opacity, overlap })
        const hidden = !bar || opacity === 0
        if ((state.scrolledAt !== null && hidden) || t - started > 3_000) {
          state.done = true
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    // ให้ sampler เก็บ frame ก่อน scroll อย่างน้อยหนึ่ง frame
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.evaluate(() => {
      const w = window as unknown as { __fs19: { scrolledAt: number | null } }
      w.__fs19.scrolledAt = performance.now()
      document.querySelector('[data-testid="add-product-button"]')!.scrollIntoView({ block: "center" })
    })

    const barHidden = () =>
      page.evaluate(() => {
        const bar = document.querySelector('[data-testid="mobile-actions"]')
        return !bar || getComputedStyle(bar).opacity === "0"
      })
    await expect.poll(barHidden, { timeout: 100, intervals: [5] }).toBe(true)

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __fs19: { done: boolean } }).__fs19.done))
      .toBe(true)
    const { samples, scrolledAt } = await page.evaluate(
      () => (window as unknown as { __fs19: { samples: Sample[]; scrolledAt: number } }).__fs19
    )
    const after = samples.filter((s) => s.t >= scrolledAt)
    expect(samples.length - after.length, "ต้องมี frame ก่อน scroll").toBeGreaterThan(0)
    expect(after.length, "ต้องมี frame หลัง scroll").toBeGreaterThan(0)
    const firstHidden = after.find((s) => !s.inDom || s.opacity === 0)
    expect(firstHidden, "แถบต้องซ่อนหลังปุ่มหลักเข้าจอ").toBeTruthy()
    expect(firstHidden!.t - scrolledAt, "เวลาจาก scroll ถึงแถบซ่อน (ms)").toBeLessThanOrEqual(100)
    const fadingOver = samples.filter((s) => s.inDom && s.overlap && s.opacity > 0 && s.opacity < 1)
    expect(fadingOver, "frame ที่แถบจางทับปุ่มหลัก").toEqual([])

    await expect(page.getByTestId("add-product-button")).toBeInViewport()
    await evidence("02-main-button-center-no-bar")
  })
})
