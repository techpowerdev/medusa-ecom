import { APIResponse, Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
} from "./support/medusa"

// FS-14 (spec 03 กฎข้อ 19, AC-20): ราคา flash บนการ์ดของ `/store` (search hit), `/search` และ rail หน้าแรก
// สินค้า X อยู่ในแคมเปญ (−20%: ฿800 จาก ฿1,000), สินค้า Y อยู่ collection เดียวกันแต่นอกแคมเปญ; ปิดแคมเปญเมื่อจบ
// หาการ์ดจาก href ของลิงก์สินค้า + data-testid (ADR-014)
test.use({ evidenceTarget: { feature: "flash-sale", taskId: "FS-14" } })
test.describe.configure({ mode: "serial" })

const PRICE = 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin API ใน e2e
const ok = async (res: APIResponse, what: string): Promise<any> => {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}

let admin: Headers
let campaignId: string
let titleX: string
let handleX: string
let handleY: string
let collectionHandle: string
let collectionId: string
const productIds: string[] = []
// FS-17 (spec 03 กฎข้อ 22, AC-24): เวลาที่สร้างข้อมูลเสร็จ — หน้าแรกต้องแสดงภายใน 90 วินาทีนับจากนี้
let createdAt = 0
const FRESH_WITHIN_MS = 90_000

const card = (page: Page, handle: string): Locator =>
  page
    .locator(`a[href="/${CC}/products/${handle}"]`)
    .getByTestId("product-wrapper")

async function expectFlashOnXOnly(page: Page) {
  const x = card(page, handleX)
  const y = card(page, handleY)
  await expect(x.getByTestId("flash-price")).toHaveText("฿800", {
    timeout: 15_000,
  })
  await expect(x.getByTestId("flash-original-price")).toHaveText("฿1,000")
  await expect(x.getByTestId("flash-original-price")).toHaveCSS(
    "text-decoration-line",
    "line-through"
  )
  await expect(y.getByTestId("price")).toHaveText("฿1,000")
  await expect(y.getByTestId("flash-price")).toHaveCount(0)
  await expect(y.getByTestId("flash-original-price")).toHaveCount(0)
}

test.beforeAll(async ({ request }) => {
  admin = await adminHeaders(request)
  const get = async (path: string) =>
    ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  const post = async (path: string, data: object) =>
    ok(
      await request.post(`${BACKEND_URL}${path}`, { headers: admin, data }),
      path
    )
  const run = `${Date.now()}`

  // FS-17 (AC-24): ให้หน้าแรกถูก render/cache ก่อนสร้างข้อมูล — พิสูจน์ว่าข้อมูลใหม่ขึ้นด้วย revalidate ไม่ใช่เพราะเพิ่ง render ครั้งแรก
  expect((await request.get(`/${CC}`)).ok(), "warm หน้าแรก").toBe(true)

  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get(
    "/admin/shipping-profiles?type=default"
  )
  const { collection } = await post("/admin/collections", {
    title: `FS-14 ${run}`,
    handle: `e2e-fs14-${run}`,
  })
  collectionHandle = collection.handle
  collectionId = collection.id

  const createProduct = async (title: string, handle: string, sku: string) => {
    const { product } = await post("/admin/products", {
      title,
      handle,
      status: "published",
      collection_id: collection.id,
      shipping_profile_id: shipping_profiles[0].id,
      sales_channels: [{ id: sales_channels[0].id }],
      options: [{ title: "Size", values: ["M"] }],
      variants: [
        {
          title: "M",
          sku,
          options: { Size: "M" },
          manage_inventory: false,
          prices: [{ currency_code: "thb", amount: PRICE }],
        },
      ],
    })
    productIds.push(product.id)
    return product
  }

  // ชื่อ X เป็นส่วนหนึ่งของชื่อ Y → ค้นด้วยชื่อ X แล้วเห็นทั้งสองการ์ด
  // ชื่อยาว ~27 ตัวอักษร (มีตัวเลขยาวที่ตัดคำไม่ได้) เพื่อตรวจ layout ราคาบนการ์ดที่ 375px (qa D-1 #148)
  titleX = `E2E FS14 Rail ${run}`
  handleX = `e2e-fs14-x-${run}`
  handleY = `e2e-fs14-y-${run}`
  const x = await createProduct(titleX, handleX, `FS14-X-${run}`)
  await createProduct(`${titleX} ราคาปกติ`, handleY, `FS14-Y-${run}`)

  const { campaign } = await post("/admin/campaigns", {
    name: `FS-14 ${run}`,
    campaign_identifier: `fs14-${run}`,
    starts_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  })
  campaignId = campaign.id
  await post("/admin/promotions", {
    code: `FS14-FLASH-${run}`,
    type: "standard",
    status: "active",
    is_automatic: true,
    campaign_id: campaignId,
    application_method: {
      type: "percentage",
      target_type: "items",
      allocation: "across",
      value: 20,
      target_rules: [
        { attribute: "items.product.id", operator: "in", values: [x.id] },
      ],
    },
  })
  await post(`/admin/flash-sales/${campaignId}/config`, {
    show_countdown: true,
    show_remaining: false,
  })
  createdAt = Date.now()
})

test.afterAll(async ({ request }) => {
  if (campaignId) {
    await ok(
      await request.post(`${BACKEND_URL}/admin/campaigns/${campaignId}`, {
        headers: admin,
        data: { ends_at: new Date(Date.now() - 60_000).toISOString() },
      }),
      "end campaign"
    )
  }
  // FS-17 (AC-24): ลบสินค้าและ collection ที่ test สร้าง (ไม่ให้ rail ค้างบนหน้าแรกของ run ถัดไป)
  for (const id of productIds) {
    const res = await request.delete(`${BACKEND_URL}/admin/products/${id}`, {
      headers: admin,
    })
    expect(res.ok(), `delete product ${id}: ${await res.text()}`).toBe(true)
  }
  if (collectionId) {
    const res = await request.delete(
      `${BACKEND_URL}/admin/collections/${collectionId}`,
      { headers: admin }
    )
    expect(res.ok(), `delete collection: ${await res.text()}`).toBe(true)
  }
})

test("AC-20: /store (search hit) การ์ด X แสดงราคา flash, การ์ด Y ไม่แสดง", async ({
  page,
  step,
  evidence,
}) => {
  await step(
    "ค้นชื่อ X ในหน้า /store (index อัปเดตตาม event สร้างสินค้า → รอจนเห็นทั้งสองการ์ด)",
    async () => {
      await page.goto(`/${CC}/store`)
      await page.getByTestId("store-search-input").fill(titleX)
      await expect(async () => {
        await expect(card(page, handleX)).toHaveCount(1, { timeout: 2_000 })
        await expect(card(page, handleY)).toHaveCount(1, { timeout: 2_000 })
      }).toPass({ timeout: 60_000 })
    }
  )

  await step("การ์ด X: ฿800 + ฿1,000 ขีดฆ่า; การ์ด Y: ราคาปกติ", async () => {
    await expectFlashOnXOnly(page)
    await evidence("01-store-hits-flash-price")
  })
})

test("AC-20: /search?q=<ชื่อ X> การ์ด X แสดงราคา flash, การ์ด Y ไม่แสดง", async ({
  page,
  step,
  evidence,
}) => {
  await step("เปิดผลค้นหา", async () => {
    await page.goto(`/${CC}/search?q=${encodeURIComponent(titleX)}`)
    await expect(card(page, handleX)).toHaveCount(1)
    await expect(card(page, handleY)).toHaveCount(1)
    await expectFlashOnXOnly(page)
    await evidence("02-search-flash-price")
  })
})

// qa D-1 (#148): ที่ 375×812 ราคา flash + ราคาขีดฆ่าต้องอยู่ในกรอบการ์ด (เดิมล้นทับการ์ดข้างๆ) — ครอบ /store, /search และ PLP ของ FS-13
test("AC-20: 375×812 ราคา flash อยู่ในกรอบการ์ดบน /store, /search และ PLP", async ({
  page,
  step,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })

  const expectPricesInsideCard = async () => {
    const x = card(page, handleX)
    await expect(x.getByTestId("flash-original-price")).toBeVisible({
      timeout: 15_000,
    })
    // วัดการ์ดและราคาในจังหวะเดียวกัน (ผลค้นหาของ /store อาจ render ใหม่และสลับตำแหน่งการ์ดระหว่างวัดแยกครั้ง)
    // ไม่มี element = ล้มเพราะ toBeVisible ด้านบนแล้ว
    const overflow = await x.evaluate((el) => {
      const c = el.getBoundingClientRect()
      return ["flash-price", "flash-original-price"].flatMap((id) => {
        const b = el
          .querySelector(`[data-testid="${id}"]`)!
          .getBoundingClientRect()
        return b.left < c.left - 0.5 || b.right > c.right + 0.5
          ? [`${id} [${b.left}-${b.right}] นอกการ์ด [${c.left}-${c.right}]`]
          : []
      })
    })
    expect(overflow).toEqual([])
  }

  await step("/store", async () => {
    await page.goto(`/${CC}/store`)
    await page.getByTestId("store-search-input").fill(titleX)
    await expect(card(page, handleX)).toHaveCount(1, { timeout: 30_000 })
    await expect(card(page, handleY)).toHaveCount(1, { timeout: 30_000 })
    await expectPricesInsideCard()
  })

  await step("/search", async () => {
    await page.goto(`/${CC}/search?q=${encodeURIComponent(titleX)}`)
    await expectPricesInsideCard()
  })

  await step("PLP collection (การ์ดของ FS-13)", async () => {
    await page.goto(`/${CC}/collections/${collectionHandle}`)
    await expectPricesInsideCard()
  })
})

// FS-17 (spec 03 กฎข้อ 22, AC-24): fetch ของ collection/สินค้าตั้ง revalidate 60 วินาที → บน `next build && next start`
// rail ของ collection ที่ test สร้างหลัง storefront เริ่มทำงานต้องขึ้นหน้าแรกภายใน 90 วินาทีนับจากสร้างข้อมูล (reload ซ้ำ)
test("AC-20: rail หน้าแรก การ์ด X แสดงราคา flash, การ์ด Y ไม่แสดง", async ({
  page,
  step,
  evidence,
}) => {
  test.setTimeout(FRESH_WITHIN_MS + 60_000)

  await step(
    "เปิดหน้าแรกซ้ำจนเห็น rail ของ collection ใหม่ (≤ 90 วินาทีนับจากสร้างข้อมูล)",
    async () => {
      await expect(async () => {
        await page.goto(`/${CC}`)
        await expect(card(page, handleX)).toHaveCount(1, { timeout: 2_000 })
      }).toPass({
        intervals: [5_000],
        timeout: Math.max(createdAt + FRESH_WITHIN_MS - Date.now(), 5_000),
      })
      await expect(
        page.getByTestId("product-rail-view-all").and(
          page.locator(`a[href="/${CC}/collections/${collectionHandle}"]`)
        )
      ).toHaveCount(1)
    }
  )

  await step("การ์ด X: ฿800 + ฿1,000 ขีดฆ่า; การ์ด Y: ราคาปกติ", async () => {
    await card(page, handleX).scrollIntoViewIfNeeded()
    await expectFlashOnXOnly(page)
    await evidence("03-home-rail-flash-price")
  })
})
