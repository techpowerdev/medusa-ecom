import type { Locator } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"

// SFUI-5b (spec 09 กฎ 19–21, AC-15): หน้า catalog ย้ายจาก class ของ preset / shim ไป utility + token ของ shadcn
// ค่าที่เสี่ยงเปลี่ยนจากการ map ต้องคงเดิม: ขนาด/ระยะบรรทัดของ `txt-xlarge` (18px/28.8px) และ `<Text>` ที่ไม่ระบุขนาด
// (14px/22.4px), Heading ของหน้าแรก/PDP, และ icon ของ lucide ขนาดเท่า @medusajs/icons (15px) — ข้อมูลจาก seed (CORE-2)
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-5b" } })

const font = (locator: Locator) =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return { size: s.fontSize, lineHeight: s.lineHeight, weight: s.fontWeight }
  })

test("AC-15: หน้าแรก, store, PDP และหน้าค้นหาคงขนาดตัวอักษร/ระยะบรรทัดเดิมหลังย้ายไป shadcn", async ({
  page,
  step,
  evidence,
}) => {
  await step("หน้าแรก: hero 32px/40px ตัวปกติ และชื่อ collection ของ product rail 18px/28.8px", async () => {
    await page.goto(`/${CC}`)
    expect(await font(page.getByTestId("hero-title"))).toEqual({ size: "32px", lineHeight: "40px", weight: "400" })
    expect(await font(page.getByTestId("hero-subtitle"))).toEqual({ size: "32px", lineHeight: "40px", weight: "400" })
    const railTitle = page.getByTestId("product-rail-view-all").first().locator("xpath=preceding-sibling::*[1]")
    expect(await font(railTitle)).toEqual({ size: "18px", lineHeight: "28.8px", weight: "400" })
    await evidence("01-home")
  })

  await step("store: ชื่อและราคาบนการ์ด 14px/22.4px, ช่องค้นหา 14px/22.4px และ icon ค้นหาของ lucide 15px", async () => {
    await page.goto(`/${CC}/store`)
    const card = page.getByTestId("products-list").getByTestId("product-wrapper").first()
    await expect(card).toBeVisible()
    expect(await font(card.getByTestId("product-title"))).toEqual({ size: "14px", lineHeight: "22.4px", weight: "400" })
    expect(await font(card.getByTestId("price").first())).toEqual({ size: "14px", lineHeight: "22.4px", weight: "400" })
    const input = page.getByTestId("store-search-input")
    expect(await font(input)).toEqual({ size: "14px", lineHeight: "22.4px", weight: "400" })
    const icon = input.locator("xpath=preceding-sibling::*[local-name()='svg'][1]")
    await expect(icon).toHaveClass(/lucide/)
    expect(await icon.evaluate((el) => el.getBoundingClientRect().width)).toBe(15)
    await evidence("02-store")
  })

  await step("PDP: ชื่อสินค้า 32px/40px ตัวหนา 600 และคำอธิบาย 14px/22.4px", async () => {
    await page.goto(`/${CC}/products/t-shirt`)
    expect(await font(page.locator("#product-info").getByTestId("product-title"))).toEqual({
      size: "32px",
      lineHeight: "40px",
      weight: "600",
    })
    expect(await font(page.getByTestId("product-description"))).toEqual({
      size: "14px",
      lineHeight: "22.4px",
      weight: "400",
    })
    await evidence("03-pdp")
  })

  await step("หน้าค้นหา: ช่องค้นหา 14px/20px (txt-compact-medium)", async () => {
    await page.goto(`/${CC}/search?q=shirt`)
    expect(await font(page.getByTestId("search-query-input"))).toEqual({ size: "14px", lineHeight: "20px", weight: "400" })
  })
})
