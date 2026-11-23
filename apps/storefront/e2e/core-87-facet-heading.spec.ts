import { APIResponse } from "@playwright/test"

import { deleteAllThenExpectOk, expectNoneLeft } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, Headers, adminHeaders } from "./support/medusa"

// CORE-87 (spec 01 กฎข้อ 143, AC-184): หน้า `/store` หัว facet ของ option ("ขนาด") ไม่แสดงจำนวนที่ขัดกับค่าย่อย
// สินค้า 2 ชิ้นที่มี tag เฉพาะของ run และ option "ขนาด" ค่า F/L → กรองด้วย tag แล้วหัว "ขนาด" ไม่มี "(0)";
// ตัวเลขที่หัว (ถ้ามี) ต้อง = 2
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-87" } })
test.describe.configure({ mode: "serial" })

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin API ใน e2e
const ok = async (res: APIResponse, what: string): Promise<any> => {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}

const OPTION = "ขนาด"

let admin: Headers
let run: string
let tag: string
let tagId: string | undefined
const productIds: string[] = []

test.beforeAll(async ({ request }) => {
  admin = await adminHeaders(request)
  const get = async (path: string) =>
    ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  run = `${Date.now()}`
  tag = `e2e-core87-${run}`

  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
  const { product_tag } = await ok(
    await request.post(`${BACKEND_URL}/admin/product-tags`, {
      headers: admin,
      data: { value: tag },
    }),
    "สร้าง tag"
  )
  tagId = product_tag.id

  for (const key of ["a", "b"]) {
    const { product } = await ok(
      await request.post(`${BACKEND_URL}/admin/products`, {
        headers: admin,
        data: {
          title: `เสื้อ CORE87 ${key} ${run}`,
          handle: `e2e-core87-${key}-${run}`,
          status: "published",
          shipping_profile_id: shipping_profiles[0].id,
          sales_channels: [{ id: sales_channels[0].id }],
          tags: [{ id: tagId }],
          options: [{ title: OPTION, values: ["F", "L"] }],
          variants: ["F", "L"].map((size) => ({
            title: size,
            sku: `CORE87-${key}-${size}-${run}`,
            options: { [OPTION]: size },
            manage_inventory: false,
            prices: [{ currency_code: "thb", amount: 500 }],
          })),
        },
      }),
      `สร้างสินค้า ${key}`
    )
    productIds.push(product.id)
  }
})

test.afterAll(async ({ request }) => {
  await deleteAllThenExpectOk(request, admin, [
    ...productIds.map((id) => `/admin/products/${id}`),
    tagId && `/admin/product-tags/${tagId}`,
  ])
  if (run) await expectNoneLeft(request, admin, run, "e2e-core87-")
})

test('AC-184: หัว facet "ขนาด" ไม่มี "(0)" และตัวเลข (ถ้ามี) = 2', async ({
  page,
  step,
  evidence,
}) => {
  const url = `/${CC}/store?${new URLSearchParams({
    "product[refinementList][labels][0]": tag,
  })}`
  const list = page.getByTestId("products-list")

  await step("กรองด้วย tag ของ run: รอ index อัปเดตจนเห็น 2 ชิ้น", async () => {
    await expect(async () => {
      await page.goto(url)
      await expect(list.locator(`a[href^="/${CC}/products/"]`)).toHaveCount(2, {
        timeout: 5_000,
      })
    }).toPass({ intervals: [1_000, 2_000], timeout: 60_000 })
  })

  await step('หัว "ขนาด" ไม่มี "(0)" — ค่าย่อย F/L แสดงจำนวนตามผล', async () => {
    const heading = page
      .getByTestId("option-refinement-title")
      .filter({ hasText: OPTION })
    await expect(heading).toHaveCount(1)
    const text = (await heading.innerText()).replace(/\s+/g, "")
    expect(text).toMatch(new RegExp(`^${OPTION}(\\(2\\))?$`))
    expect(text).not.toContain("(0)")

    const values = page.getByTestId("option-refinement")
    await expect(values.filter({ hasText: /^F\s*\(2\)$/ })).toHaveCount(1)
    await expect(values.filter({ hasText: /^L\s*\(2\)$/ })).toHaveCount(1)
    await evidence("01-store-facet-heading")
  })
})
