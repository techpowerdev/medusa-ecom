import { APIResponse } from "@playwright/test"

import { deleteAllThenExpectOk, expectNoneLeft } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
} from "./support/medusa"

// CORE-93 (spec 01 กฎข้อ 149, AC-190 — owner Q-C17 = ก 2026-11-24): chip "ป้ายกำกับ" ของตัวกรองที่เลือกบน `/store`
// ชื่อ tag ยาว 80 ตัว → ข้อความใน chip อยู่บรรทัดเดียว (truncate) และ `title` = ข้อความเต็มของ chip (มีชื่อ tag เต็ม)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-93" } })
test.describe.configure({ mode: "serial" })

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin API ใน e2e
const ok = async (res: APIResponse, what: string): Promise<any> => {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}

const TAG_LENGTH = 80

let admin: Headers
let run: string
let tag: string
let tagId: string | undefined
let productId: string | undefined

test.beforeAll(async ({ request }) => {
  admin = await adminHeaders(request)
  const get = async (path: string) =>
    ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  run = `${Date.now()}`
  // ชื่อ tag 80 code point: prefix ของ run + คำไทยต่อกัน (มีขีดให้ตัดบรรทัดได้ ถ้าไม่ truncate จะขึ้นหลายบรรทัด)
  tag = Array.from(`e2e-core93-${run}-${"ป้ายกำกับยาวมาก-".repeat(10)}`)
    .slice(0, TAG_LENGTH)
    .join("")

  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get(
    "/admin/shipping-profiles?type=default"
  )
  const { product_tag } = await ok(
    await request.post(`${BACKEND_URL}/admin/product-tags`, {
      headers: admin,
      data: { value: tag },
    }),
    "สร้าง tag"
  )
  tagId = product_tag.id

  const { product } = await ok(
    await request.post(`${BACKEND_URL}/admin/products`, {
      headers: admin,
      data: {
        title: `เสื้อ CORE93 ${run}`,
        handle: `e2e-core93-a-${run}`,
        status: "published",
        shipping_profile_id: shipping_profiles[0].id,
        sales_channels: [{ id: sales_channels[0].id }],
        tags: [{ id: tagId }],
        options: [{ title: "ขนาด", values: ["F"] }],
        variants: [
          {
            title: "F",
            sku: `CORE93-F-${run}`,
            options: { ขนาด: "F" },
            manage_inventory: false,
            prices: [{ currency_code: "thb", amount: 500 }],
          },
        ],
      },
    }),
    "สร้างสินค้า"
  )
  productId = product.id
})

test.afterAll(async ({ request }) => {
  await deleteAllThenExpectOk(request, admin, [
    productId && `/admin/products/${productId}`,
    tagId && `/admin/product-tags/${tagId}`,
  ])
  if (run) await expectNoneLeft(request, admin, run, "e2e-core93-")
})

test("AC-190: chip ป้ายกำกับชื่อยาว 80 ตัว อยู่บรรทัดเดียวและมี title = ข้อความเต็ม", async ({
  page,
  step,
  evidence,
}) => {
  expect(Array.from(tag)).toHaveLength(TAG_LENGTH)
  const url = `/${CC}/store?${new URLSearchParams({
    "product[refinementList][labels][0]": tag,
  })}`
  const chip = page
    .getByTestId("current-refinements")
    .getByTestId("remove-refinement")

  await step(
    "กรองด้วย tag ของ run: รอ index อัปเดตจนเห็นสินค้า 1 ชิ้นและ chip 1 อัน",
    async () => {
      await expect(async () => {
        await page.goto(url)
        await expect(
          page
            .getByTestId("products-list")
            .locator(`a[href^="/${CC}/products/"]`)
        ).toHaveCount(1, { timeout: 5_000 })
      }).toPass({ intervals: [1_000, 2_000], timeout: 60_000 })
      await expect(chip).toHaveCount(1)
    }
  )

  await step(
    "chip มี title = ข้อความเต็ม และข้อความอยู่บรรทัดเดียว",
    async () => {
      await expect.soft(chip).toHaveAttribute("title", `ป้ายกำกับ: ${tag}`)

      // นับบรรทัดจริงของข้อความใน chip จาก rect ของ text node (ความสูงของปุ่มคงที่ h-8 จึงวัดจากปุ่มไม่ได้)
      const lines = await chip.evaluate((button) => {
        const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT)
        const tops = new Set<number>()
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim()) continue
          const range = document.createRange()
          range.selectNodeContents(node)
          for (const rect of Array.from(range.getClientRects())) {
            if (rect.width > 0) tops.add(Math.round(rect.top))
          }
        }
        return tops.size
      })
      expect.soft(lines, "จำนวนบรรทัดของข้อความใน chip").toBe(1)

      // chip ไม่ล้นกรอบของรายการตัวกรอง
      const list = page.getByTestId("current-refinements").locator("ul")
      const [chipBox, listBox] = [
        await chip.boundingBox(),
        await list.boundingBox(),
      ]
      expect(chipBox!.x + chipBox!.width).toBeLessThanOrEqual(
        listBox!.x + listBox!.width + 1
      )
      await evidence("01-label-chip-truncate")
    }
  )
})
