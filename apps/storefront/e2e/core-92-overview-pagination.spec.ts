import { expect, test } from "./support/fixtures"
import { groupBuyOrder, leaveGroup } from "./support/group-buy"
import { STOREFRONT_COUNTRY as CC, signInAs } from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-92: spec 01 AC-189 (กฎข้อ 148) — overview ที่มีแต่ membership กลุ่มไม่บอกว่า "ยังไม่มีคำสั่งซื้อ",
// และ `SearchPagination` ของ /store มี aria-label/aria-current ภาษาไทย
// GB-8 จาก overview ยิงฝั่ง server (Playwright มองไม่เห็น request) → `limit=1` พิสูจน์ใน unit `core-92-overview-pagination.test.ts`
// ปุ่มเลขหน้า (ไม่มี testid ต่อปุ่ม) หาด้วย role + ชื่อภายใน `product-pagination` แบบ AC-177
// SFUI-19c (spec 09 กฎ 66, 78 (iv)): เลขหน้าเป็นลิงก์ `PaginationLink` ของ shadcn → หาด้วย role link
test.use({
  evidenceTarget: { feature: "core", taskId: "CORE-92" },
  viewport: { width: 1280, height: 800 },
})

const SEARCH_ROUTE = "**/store/search**"

type SearchResult = { hits: unknown[]; metadata: { count?: number } }

// ให้ InstantSearch เห็นสินค้า 40 ชิ้น (หน้าละ 12 → 4 หน้า) โดยไม่ต้อง seed สินค้าเพิ่ม: แก้แค่ `metadata.count` ของผลจริง
const inflateCount = (body: unknown): unknown => {
  if (Array.isArray(body)) return body.map(inflateCount)
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>
    if ("hits" in obj && "metadata" in obj) {
      const result = obj as SearchResult
      return { ...result, metadata: { ...result.metadata, count: 40 } }
    }
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, inflateCount(v)])
    )
  }
  return body
}

test("AC-189: ลูกค้าที่มีแต่ membership กลุ่ม → overview ไม่มี ยังไม่มีคำสั่งซื้อ แต่มีลิงก์ ดูทั้งหมด", async ({
  page,
  context,
  request,
  baseURL,
  evidence,
}) => {
  test.setTimeout(120_000)
  const ctx = await groupBuyOrder(request, false)
  try {
    await signInAs(context, baseURL!, ctx.customer)
    await page.goto(`/${CC}/account`)
    await expect(page.getByTestId("overview-orders-view-all")).toBeVisible()
    await expect(page.getByTestId("no-orders-message")).toHaveCount(0)
    await evidence("overview-group-only-1280")
  } finally {
    await leaveGroup(request, ctx)
  }
})

test("AC-189: /store ที่มี ≥ 2 หน้า → nav ของ SearchPagination มี aria-label ไทย และปุ่มหน้าปัจจุบัน aria-current=page", async ({
  page,
  step,
  evidence,
}) => {
  await page.route(SEARCH_ROUTE, async (route) => {
    const response = await route.fetch()
    if (!response.ok()) return route.fulfill({ response })
    return route.fulfill({
      response,
      json: inflateCount(await response.json()),
    })
  })
  const pagination = page.getByTestId("product-pagination")

  await step(
    "หน้า 1: nav aria-label ไทย, ปุ่มทุกปุ่มมี aria-label ไทย, aria-current อยู่ที่หน้า 1",
    async () => {
      await page.goto(`/${CC}/store`)
      await expect(pagination).toBeVisible()
      await expect(pagination).toHaveJSProperty("tagName", "NAV")
      expect((await pagination.getAttribute("aria-label")) ?? "").toMatch(THAI)
      const buttons = pagination.getByRole("link")
      await expect(buttons).toHaveCount(4)
      for (const label of await buttons.evaluateAll((els) =>
        els.map((e) => e.getAttribute("aria-label") ?? "")
      )) {
        expect(label, label).toMatch(THAI)
      }
      await expect(pagination.locator('[aria-current="page"]')).toHaveCount(1)
      await expect(
        pagination.getByRole("link", { name: "หน้า 1", exact: true })
      ).toHaveAttribute("aria-current", "page")
      await pagination.scrollIntoViewIfNeeded()
      await evidence("store-pagination-page-1-1280")
    }
  )

  await step("กดหน้า 2 → aria-current ย้ายไปหน้า 2", async () => {
    await pagination
      .getByRole("link", { name: "หน้า 2", exact: true })
      .click()
    await expect(
      pagination.getByRole("link", { name: "หน้า 2", exact: true })
    ).toHaveAttribute("aria-current", "page")
    await expect(pagination.locator('[aria-current="page"]')).toHaveCount(1)
  })
})
