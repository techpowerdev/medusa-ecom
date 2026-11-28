import { Locator } from "@playwright/test"

import { deleteAllThenExpectOk } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, type Headers, adminHeaders, ok } from "./support/medusa"
import { readSource } from "./support/sfui-source"

// SFUI-19d (spec 09 กฎ 64, 67–68, AC-61 (2) — ADR-034 D4): ตัวกรองของ /store ใช้ component ของ shadcn ตามค่าเริ่มต้น —
// chip ตัวเลือก = `toggle-group` (36px), checkbox หมวด/ป้ายกำกับ/ลดราคา = `ui/checkbox` (16×16) + `Field`,
// chip ตัวกรองที่เลือก/ล้างทั้งหมด = `Button` (36px), AccordionTrigger = default (padding เท่ากับแท็บ PDP)
// ข้อมูล: สินค้า 2 ชิ้นของ run (tag + option ชื่อเฉพาะ run, A ลดราคาด้วย price list sale) → เปิด /store ที่กรอง tag ไว้ = 2 ชิ้นพอดี
test.use({
  evidenceTarget: { feature: "storefront-consistency", taskId: "SFUI-19d" },
  viewport: { width: 1280, height: 800 },
})

/** ข้อความ chip ของตัวกรองลดราคา = ค่าที่ `refinementLabel` คืนสำหรับ `on_sale` (อ่านจาก code — ไม่ hard-code ซ้ำ) */
const ON_SALE_CHIP_LABEL = (() => {
  const source = readSource("src/modules/store/components/store-refinements/current-refinements.tsx")
  const label = source.match(/priceAttribute\("on_sale",[^)]*\)\)\s*\{\s*return "([^"]+)"/)?.[1]
  if (!label) throw new Error("หา label ของ chip ลดราคาใน current-refinements.tsx ไม่พบ")
  return label
})()

const box = (locator: Locator) =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return { height: s.height, width: s.width }
  })

const padding = (locator: Locator) =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].join(" ")
  })

test("AC-61: chip ตัวเลือก, checkbox ตัวกรอง, chip ตัวกรองที่เลือก และหัวกลุ่มใช้ขนาด default ของ shadcn และกรองได้จริง", async ({
  page,
  request,
  step,
}) => {
  test.setTimeout(240_000)
  const admin: Headers = await adminHeaders(request)
  const run = `${Date.now()}`
  const get = async (path: string) => ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  const post = async (path: string, data: object) =>
    ok(await request.post(`${BACKEND_URL}${path}`, { headers: admin, data }), `POST ${path}`)
  const tag = `e2e-sfui19d-${run}`
  const option = `SFUI19d${run}`
  const cleanup: string[] = []
  try {
    const { sales_channels } = await get("/admin/sales-channels?limit=1")
    const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
    const { product_tag } = await post("/admin/product-tags", { value: tag })
    const products: Record<string, { id: string; variantId: string }> = {}
    for (const value of ["A", "B"]) {
      const { product } = await post("/admin/products", {
        title: `E2E SFUI19d ${run} ${value}`,
        handle: `e2e-sfui19d-${run}-${value.toLowerCase()}`,
        status: "published",
        shipping_profile_id: shipping_profiles[0].id,
        sales_channels: [{ id: sales_channels[0].id }],
        tags: [{ id: product_tag.id }],
        options: [{ title: option, values: [value] }],
        variants: [
          {
            title: value,
            sku: `SFUI19D-${run}-${value}`,
            options: { [option]: value },
            manage_inventory: false,
            prices: [{ currency_code: "thb", amount: 1000 }],
          },
        ],
      })
      products[value] = { id: product.id, variantId: product.variants[0].id }
      cleanup.unshift(`/admin/products/${product.id}`)
    }
    cleanup.push(`/admin/product-tags/${product_tag.id}`)
    const { price_list } = await post("/admin/price-lists", {
      title: `SFUI-19d ${run}`,
      description: "e2e SFUI-19d sale",
      type: "sale",
      status: "active",
      prices: [{ variant_id: products.A.variantId, currency_code: "thb", amount: 800 }],
    })
    cleanup.unshift(`/admin/price-lists/${price_list.id}`)
    // price list ไม่ส่ง event ให้ index (TODO ใน backend search/product.ts) → แก้สินค้า A ให้ index คำนวณ on_sale ใหม่
    await post(`/admin/products/${products.A.id}`, { description: `sale ${run}` })

    const url = `/${CC}/store?${new URLSearchParams({ "product[refinementList][labels][0]": tag })}`
    const cards = page.getByTestId("products-list").locator(`a[href^="/${CC}/products/"]`)
    const onSale = page.getByTestId("on-sale-toggle")
    const tagField = page.locator('[data-slot="field"]').filter({ hasText: tag })
    const tagBox = tagField.getByTestId("refinement-labels")
    const group = page.locator('[data-slot="accordion-item"]').filter({
      has: page.getByTestId("option-refinement-title").filter({ hasText: option }),
    })
    const chipA = group.getByTestId("option-refinement").filter({ hasText: /^A\s*\(1\)$/ })

    await step("Given /store กรอง tag ของ run: รอ index จนเห็น 2 ชิ้นและตัวกรองลดราคา", async () => {
      await expect(async () => {
        await page.goto(url)
        await expect(cards).toHaveCount(2, { timeout: 5_000 })
        await expect(onSale).toBeVisible({ timeout: 2_000 })
        await expect(chipA).toBeVisible({ timeout: 2_000 })
      }).toPass({ intervals: [1_000, 2_000], timeout: 90_000 })
    })

    await step("checkbox ป้ายกำกับ: role=checkbox 16×16 จาก URL ติ๊กอยู่, คลิก label → เอาออก (ผลมากกว่า 2), คลิกอีกครั้ง → กรองกลับ 2 ชิ้น", async () => {
      await expect(tagBox).toHaveAttribute("role", "checkbox")
      await expect(tagBox).toHaveAttribute("data-slot", "checkbox")
      expect(await box(tagBox)).toEqual({ height: "16px", width: "16px" })
      await expect(tagBox).toHaveAttribute("aria-checked", "true")
      await tagField.locator('[data-slot="field-label"]').click()
      await expect(tagBox).toHaveAttribute("aria-checked", "false")
      await expect.poll(() => cards.count()).toBeGreaterThan(2)
      await tagField.locator('[data-slot="field-label"]').click()
      await expect(tagBox).toHaveAttribute("aria-checked", "true")
      await expect(cards).toHaveCount(2)
    })

    await step("chip ตัวเลือก: toggle-group-item สูง 36px, กด → aria-pressed=true เหลือ 1 ชิ้น, กดซ้ำ → false กลับ 2 ชิ้น", async () => {
      await expect(chipA).toHaveAttribute("data-slot", "toggle-group-item")
      expect((await box(chipA)).height).toBe("36px")
      await expect(chipA).toHaveAttribute("aria-pressed", "false")
      await chipA.click()
      await expect(chipA).toHaveAttribute("aria-pressed", "true")
      await expect(cards).toHaveCount(1)
      await expect(cards).toHaveAttribute("href", `/${CC}/products/e2e-sfui19d-${run}-a`)
      await chipA.click()
      await expect(chipA).toHaveAttribute("aria-pressed", "false")
      await expect(cards).toHaveCount(2)
    })

    await step("ลดราคา: role=checkbox 16×16, คลิก label → aria-checked=true เหลือสินค้า A", async () => {
      await expect(onSale).toHaveAttribute("role", "checkbox")
      expect(await box(onSale)).toEqual({ height: "16px", width: "16px" })
      await expect(onSale).toHaveAttribute("aria-checked", "false")
      await page.locator('[data-slot="field"]').filter({ has: onSale }).locator('[data-slot="field-label"]').click()
      await expect(onSale).toHaveAttribute("aria-checked", "true")
      await expect(cards).toHaveCount(1)
      await expect(cards).toHaveAttribute("href", `/${CC}/products/e2e-sfui19d-${run}-a`)
    })

    await step("ตัวกรองที่เลือก: remove-refinement/clear-refinements เป็น Button สูง 36px; ลบ ลดราคา → 2 ชิ้น; ล้างทั้งหมด → ไม่มีตัวกรอง", async () => {
      const current = page.getByTestId("current-refinements")
      const chips = current.getByTestId("remove-refinement")
      await expect(chips).toHaveCount(2)
      for (const chip of await chips.all()) {
        await expect(chip).toHaveAttribute("data-slot", "button")
        await expect(chip).toHaveAttribute("data-variant", "outline")
        expect((await box(chip)).height).toBe("36px")
      }
      const clear = page.getByTestId("clear-refinements")
      await expect(clear).toHaveAttribute("data-slot", "button")
      await expect(clear).toHaveAttribute("data-variant", "link")
      expect((await box(clear)).height).toBe("36px")

      // chip ของลดราคาหาด้วย testid + title (= ข้อความของ chip จาก refinementLabel ใน current-refinements.tsx) — ไม่หาด้วยข้อความ (review 19d)
      await current.locator(`[data-testid="remove-refinement"][title="${ON_SALE_CHIP_LABEL}"]`).click()
      await expect(onSale).toHaveAttribute("aria-checked", "false")
      await expect(cards).toHaveCount(2)
      await clear.click()
      await expect(current).toHaveCount(0)
      await expect(page).not.toHaveURL(/labels/)
      await expect.poll(() => cards.count()).toBeGreaterThan(2)
    })

    await step("AccordionTrigger ของกลุ่มตัวเลือกใน store และแท็บ PDP มี computed padding เท่ากัน", async () => {
      await page.goto(url)
      const storeTrigger = group.locator('[data-slot="accordion-trigger"]')
      await expect(storeTrigger).toBeVisible()
      const storePadding = await padding(storeTrigger)
      await page.goto(`/${CC}/products/e2e-sfui19d-${run}-a`)
      const pdpTrigger = page.getByTestId("product-tab-information").locator('[data-slot="accordion-trigger"]')
      await expect(pdpTrigger).toBeVisible()
      expect(await padding(pdpTrigger)).toBe(storePadding)
    })
  } finally {
    await deleteAllThenExpectOk(request, admin, cleanup)
  }
})
