import type { Locator } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"

// SFUI-5b (spec 09 กฎ 19–21, AC-15): หน้า catalog ย้ายจาก class ของ preset / shim ไป utility + token ของ shadcn
// ค่าที่เสี่ยงเปลี่ยนจากการ map ต้องคงเดิม: ขนาด/ระยะบรรทัดของ `txt-xlarge` (18px/28.8px) และ `<Text>` ที่ไม่ระบุขนาด
// (14px/22.4px), Heading ของหน้าแรก/PDP, มุมของ thumbnail, และ icon ของ lucide ขนาดเท่า @medusajs/icons (15px) — ข้อมูลจาก seed (CORE-2)
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
  await step("หน้าแรก: hero 32px/40px น้ำหนัก 600 และชื่อ collection ของ product rail 18px/28.8px", async () => {
    await page.goto(`/${CC}`)
    // น้ำหนัก 600 = ค่าที่ render จริงบน develop (Heading ของ shim ใช้ clsx: font-semibold อยู่หลัง font-normal ใน CSS ของ v3
    // จึงชนะ) — SFUI-2 ทำให้เป็น 400 โดยไม่ตั้งใจ; session หลักตัดสินให้คงหน้าตาเดิม (review SFUI-5b nit 1)
    expect(await font(page.getByTestId("hero-title"))).toEqual({ size: "32px", lineHeight: "40px", weight: "600" })
    expect(await font(page.getByTestId("hero-subtitle"))).toEqual({ size: "32px", lineHeight: "40px", weight: "600" })
    const railTitle = page.getByTestId("product-rail-view-all").first().locator("xpath=preceding-sibling::*[1]")
    expect(await font(railTitle)).toEqual({ size: "18px", lineHeight: "28.8px", weight: "400" })
    await evidence("01-home")
  })

  await step("store: ชื่อและราคาบนการ์ด 14px/22.4px, มุม thumbnail 10px, ช่องค้นหา 14px/20px และ icon ค้นหาของ lucide 16px", async () => {
    await page.goto(`/${CC}/store`)
    const card = page.getByTestId("products-list").getByTestId("product-wrapper").first()
    await expect(card).toBeVisible()
    expect(await font(card.getByTestId("product-title"))).toEqual({ size: "14px", lineHeight: "22.4px", weight: "400" })
    expect(await font(card.getByTestId("price").first())).toEqual({ size: "14px", lineHeight: "22.4px", weight: "400" })
    // Thumbnail: rounded-lg ตามกฎ 20 (Container → rounded-lg) = --radius 0.625rem (review SFUI-5b blocker)
    expect(await card.locator("div").first().evaluate((el) => getComputedStyle(el).borderRadius)).toBe("10px")
    // SFUI-19c (spec 09 กฎ 58, 65b, 78 (i)): ช่องค้นหาเป็น `input-group` ของ shadcn — ค่าที่ component render (`md:text-sm` 14px/20px,
    // icon ใน addon ใช้ default `size-4` = 16px)
    const input = page.getByTestId("store-search-input")
    expect(await font(input)).toEqual({ size: "14px", lineHeight: "20px", weight: "400" })
    const icon = input.locator("xpath=following-sibling::*[@data-slot='input-group-addon'][1]/*[local-name()='svg']")
    await expect(icon).toHaveClass(/lucide/)
    expect(await icon.evaluate((el) => el.getBoundingClientRect().width)).toBe(16)
    await evidence("02-store")
  })

  await step("PDP: ชื่อสินค้า (h1) 32px/48px ตัวหนา 600 (กฎ 77 — SFUI-21b) และคำอธิบาย 14px/22.4px", async () => {
    await page.goto(`/${CC}/products/t-shirt`)
    expect(await font(page.locator("#product-info").getByTestId("product-title"))).toEqual({
      size: "32px",
      lineHeight: "48px",
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
