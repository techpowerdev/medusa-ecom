import type { Locator } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { addToCartFromPdp } from "./support/server-action"

// SFUI-24b (spec 09 รอบ 51 กฎ 86–87, AC-76–77): ข้อค้นพบจากการทดสอบด้วยมือก่อน v0.4.0
// AC-76: กล่อง `saved-address-greeting` ไม่มีพื้น/padding (เดิม `rounded-lg bg-card p-5` เยื้อง 20px) และชิดซ้ายเดียวกับช่องชื่อ
// AC-77: ตัวกรอง option ของ /store ข้ามคู่ "Default option" / "Default option value" ที่ Medusa admin สร้างให้สินค้าไม่มี variant
test.use({ evidenceTarget: { feature: "r51", taskId: "SFUI-24b" } })

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
]

const savedAddress = {
  first_name: "สมชาย",
  last_name: "ใจดี",
  address_1: "11 ถนนพระราม 4",
  postal_code: "10110",
  city: "วัฒนา",
  province: "กรุงเทพมหานคร",
  country_code: CC,
  phone: "0812345678",
}

const boxStyle = (locator: Locator) =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft],
      backgroundColor: s.backgroundColor,
    }
  })

const left = (locator: Locator) => locator.evaluate((el) => el.getBoundingClientRect().left)

test("AC-76: กล่องทักทายที่อยู่ที่บันทึกไว้ไม่มี padding/พื้น และชิดซ้ายเดียวกับช่องชื่อ (1280 + 375)", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const store = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const saved = await request.post(`${BACKEND_URL}/store/customers/me/addresses`, {
    headers: store,
    data: savedAddress,
  })
  expect(saved.status(), "saved address").toBe(200)
  await signInAs(context, baseURL!, customer)

  await step("Given ลูกค้ามีที่อยู่ที่บันทึกไว้และมีสินค้าใน cart", async () => {
    await page.goto(`/${CC}/products/t-shirt`)
    await addToCartFromPdp(page, { request, pk, customer })
  })

  for (const viewport of VIEWPORTS) {
    await step(`${viewport.width}px: greeting padding 0px ทุกด้าน พื้นโปร่งใส และ left = ช่องชื่อ (±1px)`, async () => {
      await page.setViewportSize(viewport)
      await page.goto(`/${CC}/checkout?step=address`)
      const greeting = page.getByTestId("saved-address-greeting")
      const firstName = page.getByTestId("shipping-first-name-input")
      await expect(greeting).toBeVisible()
      await expect(firstName).toBeVisible()
      expect(await boxStyle(greeting)).toEqual({
        padding: ["0px", "0px", "0px", "0px"],
        backgroundColor: "rgba(0, 0, 0, 0)",
      })
      expect(Math.abs((await left(greeting)) - (await left(firstName)))).toBeLessThanOrEqual(1)
      await evidence(`checkout-greeting-${viewport.width}`)
    })
  }
})

const SEARCH_ROUTE = "**/store/search**"
const DEFAULT_FACET = "Default option:Default option value"

type Facet = { type: string; values?: { value: string; count: number }[] }
type SearchResult = { hits: unknown[]; metadata: unknown; facets?: Record<string, Facet> }

test("AC-77: /store ไม่มีกลุ่มหรือปุ่ม Default option และจำนวนปุ่ม = facet ที่ไม่ใช่คู่ default", async ({
  page,
  step,
  evidence,
}) => {
  // facet `option_values` ล่าสุดที่ส่งให้ browser (หลังเติมคู่ default) — ใช้คำนวณจำนวนปุ่มที่คาด
  let lastValues: string[] = []
  const addDefaultFacet = (body: unknown): unknown => {
    if (Array.isArray(body)) return body.map(addDefaultFacet)
    if (body && typeof body === "object") {
      const obj = body as Record<string, unknown>
      if ("hits" in obj && "metadata" in obj) {
        const result = obj as SearchResult
        const options = result.facets?.option_values
        if (!options || options.type !== "value") return result
        const values = [...(options.values ?? []), { value: DEFAULT_FACET, count: 1 }]
        lastValues = values.map((v) => v.value)
        return { ...result, facets: { ...result.facets, option_values: { ...options, values } } }
      }
      return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, addDefaultFacet(v)]))
    }
    return body
  }
  await page.route(SEARCH_ROUTE, async (route) => {
    const response = await route.fetch()
    if (!response.ok()) return route.fulfill({ response })
    return route.fulfill({ response, json: addDefaultFacet(await response.json()) })
  })

  await step("/th/store ที่ search response มี facet Default option:Default option value", async () => {
    await page.goto(`/${CC}/store`)
    await expect(page.getByTestId("option-refinement").first()).toBeVisible()
    expect(lastValues, "mock ต้องเติมคู่ default ลงใน facet").toContain(DEFAULT_FACET)
  })

  await step("ไม่มีหัวกลุ่ม Default option และจำนวนปุ่ม = facet ที่ไม่ใช่คู่ default", async () => {
    const titles = await page.getByTestId("option-refinement-title").allTextContents()
    expect(titles.map((t) => t.trim())).not.toContain("Default option")
    const expected = lastValues.filter((v) => v !== DEFAULT_FACET && v.indexOf(":") > 0).length
    await expect(page.getByTestId("option-refinement")).toHaveCount(expected)
    await evidence("store-no-default-option")
  })
})
