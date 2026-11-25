import type { Locator, Page } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"
import { THAI } from "./support/thai-text"

// SFUI-3b: spec 09 AC-10 (กฎ 4, 4c, 11) — แผงเต็มจอเป็น `Sheet` ของ shadcn (Radix Dialog):
// side menu (`nav-menu-button`), search drawer (`nav-search-button`) และ `mobile-actions-modal` บน PDP ที่ 390px
// แต่ละตัว role="dialog" มีชื่อ/คำอธิบายภาษาไทย, Tab วนอยู่ใน sheet, Escape ปิด, focus กลับปุ่มที่เปิด, ไม่มี console warning ของ Radix
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-3b" } })

const PRODUCT = "t-shirt"

/** เก็บ console message ที่ Radix เตือนเรื่อง DialogTitle / aria-describedby (AC-9/AC-10) */
function radixWarnings(page: Page): string[] {
  const found: string[] = []
  page.on("console", (msg) => {
    const text = msg.text()
    if (/DialogTitle|aria-describedby/.test(text)) found.push(text)
  })
  return found
}

/** dialog ที่เปิด: testid อยู่บน element role="dialog" ชื่อและคำอธิบายเป็นภาษาไทย; Tab 20 ครั้งแล้ว focus ยังอยู่ใน dialog */
async function expectThaiSheet(page: Page, testId: string): Promise<Locator> {
  const dialog = page.getByRole("dialog")
  await expect(dialog).toHaveCount(1)
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute("data-testid", testId)
  await expect(dialog).toHaveAccessibleName(THAI)
  await expect(dialog).toHaveAccessibleDescription(THAI)
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab")
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
      `Tab ครั้งที่ ${i + 1} focus ยังอยู่ใน ${testId}`
    ).toBe(true)
  }
  return dialog
}

/** Escape ปิด sheet แล้ว focus กลับไปที่ปุ่มที่เปิด */
async function expectEscapeReturnsFocus(page: Page, trigger: Locator) {
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(trigger).toBeFocused()
}

test("AC-10: side menu และ search drawer เป็น Sheet ที่มีชื่อไทย, Tab วนใน sheet, Escape ปิดแล้ว focus กลับปุ่มที่เปิด", async ({
  page,
  step,
  evidence,
}) => {
  const warnings = radixWarnings(page)
  await page.goto(`/${CC}`)

  await step(
    "side menu: กด nav-menu-button → dialog ชื่อไทย มีลิงก์เมนูภาษาไทย",
    async () => {
      await page.getByTestId("nav-menu-button").click()
      const dialog = await expectThaiSheet(page, "nav-menu-popup")
      await expect(dialog.getByTestId("store-link")).toHaveText(THAI)
      await expect(
        dialog.getByTestId("close-menu-button")
      ).toHaveAccessibleName(THAI)
      await evidence("01-side-menu-sheet")
    }
  )

  await step(
    "side menu: Escape ปิดและ focus กลับ nav-menu-button",
    async () => {
      await expectEscapeReturnsFocus(page, page.getByTestId("nav-menu-button"))
    }
  )

  await step(
    "side menu: ปุ่ม close-menu-button ปิดได้และ focus กลับ nav-menu-button",
    async () => {
      await page.getByTestId("nav-menu-button").click()
      await expect(page.getByTestId("nav-menu-popup")).toBeVisible()
      await page.getByTestId("close-menu-button").click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(page.getByTestId("nav-menu-button")).toBeFocused()
    }
  )

  await step(
    "search drawer: กดปุ่มค้นหา → dialog ชื่อไทย และ focus อยู่ที่ช่องค้นหา",
    async () => {
      await page.getByTestId("nav-search-button").click()
      await expect(page.getByTestId("search-input")).toBeFocused()
      const dialog = await expectThaiSheet(page, "search-drawer")
      await expect(
        dialog.getByTestId("close-search-drawer")
      ).toHaveAccessibleName(THAI)
      await evidence("02-search-sheet")
    }
  )

  await step(
    "search drawer: Escape ปิดและ focus กลับ nav-search-button",
    async () => {
      await expectEscapeReturnsFocus(
        page,
        page.getByTestId("nav-search-button")
      )
    }
  )

  await step(
    "search drawer: ปุ่ม close-search-drawer ปิดได้และ focus กลับ nav-search-button",
    async () => {
      await page.getByTestId("nav-search-button").click()
      await expect(page.getByTestId("search-drawer")).toBeVisible()
      await page.getByTestId("close-search-drawer").click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(page.getByTestId("nav-search-button")).toBeFocused()
    }
  )

  expect(
    warnings,
    "console warning ของ Radix (DialogTitle / aria-describedby)"
  ).toEqual([])
})

test.describe("viewport 390×844", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("AC-10: mobile-actions-modal เป็น Sheet ชื่อไทย, Escape ปิดแล้ว focus กลับ mobile-actions-button; แถบ mobile-actions ยัง opacity 1", async ({
    page,
    step,
    evidence,
  }) => {
    const warnings = radixWarnings(page)
    const opener = page.getByTestId("mobile-actions-button")

    await step(
      "เลื่อนพ้นปุ่มหลักบน PDP → แถบ mobile-actions แสดงเต็ม (ไม่ใช่ overlay)",
      async () => {
        await page.goto(`/${CC}/products/${PRODUCT}`)
        // hydrate แล้ว = effect เขียน v_id ของตัวเลือกตั้งต้นลง URL
        await expect(page).toHaveURL(/[?&]v_id=/)
        const top = await page.evaluate(
          () =>
            document
              .querySelector('[data-testid="add-product-button"]')!
              .getBoundingClientRect().top + window.scrollY
        )
        await page.evaluate((y) => window.scrollTo(0, y), top + 300)
        await expect(
          page.getByTestId("add-product-button")
        ).not.toBeInViewport()
        const bar = page.getByTestId("mobile-actions")
        await expect(bar).toBeVisible()
        await expect(bar).toHaveCSS("opacity", "1")
        await expect(bar).not.toHaveAttribute("role", "dialog")
        await expect(page.getByRole("dialog")).toHaveCount(0)
      }
    )

    await step(
      "กด mobile-actions-button → Sheet ตัวเลือกสินค้า ชื่อไทย มีปุ่มตัวเลือก",
      async () => {
        await opener.click()
        const dialog = await expectThaiSheet(page, "mobile-actions-modal")
        await expect(dialog.getByTestId("option-button").first()).toBeVisible()
        await expect(
          dialog.getByTestId("close-modal-button")
        ).toHaveAccessibleName(THAI)
        await evidence("03-mobile-actions-sheet")
      }
    )

    await step("Escape ปิดและ focus กลับ mobile-actions-button", async () => {
      await expectEscapeReturnsFocus(page, opener)
    })

    await step(
      "ปุ่ม close-modal-button ปิดได้และ focus กลับ mobile-actions-button; แถบยัง opacity 1",
      async () => {
        await opener.click()
        await expect(page.getByTestId("mobile-actions-modal")).toBeVisible()
        await page.getByTestId("close-modal-button").click()
        await expect(page.getByRole("dialog")).toHaveCount(0)
        await expect(opener).toBeFocused()
        await expect(page.getByTestId("mobile-actions")).toHaveCSS(
          "opacity",
          "1"
        )
      }
    )

    expect(
      warnings,
      "console warning ของ Radix (DialogTitle / aria-describedby)"
    ).toEqual([])
  })
})
