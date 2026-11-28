import { Locator, Page } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import { addAddresses } from "./support/group-buy"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, publishableKey, signInAs } from "./support/medusa"
import { addToCartFromPdp } from "./support/server-action"

// SFUI-21a (spec 09 กฎ 73, 75, 76; AC-66 (2) — owner: gap ฟอร์มค่าเดียว 16px): container ของช่องในทุกฟอร์มของตาราง inventory รอบ 48
// row-gap = 16px (และ column-gap = 16px สำหรับคู่ที่ ≥ 768px); shipping-address-select สูง 36px; ปุ่มปิด overlay 36×36, aria-label ไทย,
// Escape ยังปิด (และคลิกปุ่มปิดของ modal เพิ่มที่อยู่ปิดได้ — SFUI-22) และ focus กลับ trigger (กฎ 11)
test.use({ evidenceTarget: { feature: "storefront-consistency", taskId: "SFUI-21a" } })

const THAI = /[฀-๿]/

/** container ของช่อง = parent ของ `[data-slot="field"]` ที่ครอบ control → row-gap/column-gap */
async function containerGaps(scope: Locator, testId: string) {
  return scope.getByTestId(testId).evaluate((el) => {
    const field = el.closest('[data-slot="field"]')!
    const box = field.parentElement!
    const s = getComputedStyle(box)
    const columns = s.display === "grid" ? s.gridTemplateColumns.split(" ").filter(Boolean).length : 1
    return { rowGap: s.rowGap, columnGap: s.columnGap, columns }
  })
}

/** ทุกช่องในรายการ: container row-gap 16px; container ที่วางคู่ (≥ 2 คอลัมน์) column-gap 16px */
async function expectGaps(scope: Locator, ids: string[], where: string) {
  for (const id of ids) {
    const g = await containerGaps(scope, id)
    expect.soft(g.rowGap, `${where} ${id} row-gap`).toBe("16px")
    if (g.columns > 1) expect.soft(g.columnGap, `${where} ${id} column-gap`).toBe("16px")
  }
}

/** `close`: ปิดด้วย Escape (ค่าเริ่มต้น) หรือคลิกปุ่มปิดจริง (review 21a — ปุ่มที่ผ่าน wrapper `@/components/button` ภายใต้ `DialogClose asChild`) */
async function expectCloseButton(page: Page, button: Locator, trigger: Locator, where: string, close: "escape" | "click" = "escape") {
  await expect(button, where).toBeVisible()
  const box = await button.evaluate((el) => ({ h: getComputedStyle(el).height, w: getComputedStyle(el).width }))
  expect(box, `${where} ขนาด`).toEqual({ h: "36px", w: "36px" })
  expect(await button.getAttribute("aria-label"), `${where} aria-label`).toMatch(THAI)
  await expect(button).toHaveAttribute("data-variant", "ghost")
  if (close === "click") await button.click()
  else await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(trigger, `${where} focus กลับ trigger`).toBeFocused()
}

const ADDRESS_FIELDS = ["first-name-input", "last-name-input", "company-input", "address-1-input", "address-2-input", "city-input", "state-input", "postal-code-input", "phone-input"]

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`AC-66 (2) ${viewport.width}: gap ของฟอร์ม 16px, shipping-address-select 36px และปุ่มปิด overlay 36×36`, async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(240_000)
    await page.setViewportSize(viewport)
    const pk = await publishableKey(request, await adminHeaders(request))

    await step("login + register", async () => {
      await page.goto(`/${CC}/account`)
      const login = page.getByTestId("login-page")
      await expectGaps(login, ["email-input", "password-input"], "login")
      await page.getByTestId("login-to-register-button").click()
      const register = page.getByTestId("register-page")
      await expectGaps(register, ["first-name-input", "last-name-input", "email-input", "phone-input", "password-input"], "register")
    })

    const customer = await createCustomer(request, pk)
    await addAddresses(request, pk, customer, [
      { first_name: "สมศรี", last_name: "มีสุข", address_1: "55 ถนนเพชรบุรี", address_2: "มักกะสัน", city: "ราชเทวี", province: "กรุงเทพมหานคร", postal_code: "10400", phone: "0812345678" },
    ])
    await signInAs(context, baseURL!, customer)

    await step("โปรไฟล์: ชื่อ, เบอร์โทร, ที่อยู่ใบเสร็จ (เปิด edit-panel)", async () => {
      await page.goto(`/${CC}/account/profile`)
      for (const [editor, ids] of [
        ["account-name-editor", ["first-name-input", "last-name-input"]],
        ["account-phone-editor", ["phone-input"]],
        ["account-billing-address-editor", ["billing-first-name-input", "billing-last-name-input", "billing-address-1-input", "billing-address-2-input", "billing-city-input", "billing-province-input", "billing-postcal-code-input", "billing-phone-input"]],
      ] as const) {
        const scope = page.getByTestId(editor)
        await scope.getByTestId("edit-button").click()
        await expect(scope.getByTestId("edit-panel")).toHaveAttribute("data-open", "true")
        await expectGaps(scope, [...ids], editor)
        await scope.getByTestId("edit-button").click()
      }
    })

    await step("modal เพิ่ม/แก้ที่อยู่: gap + ปุ่มปิด close-modal-button", async () => {
      await page.goto(`/${CC}/account/addresses`)
      const addTrigger = page.getByTestId("add-address-button")
      await addTrigger.click()
      const add = page.getByTestId("add-address-modal")
      await expectGaps(add, ADDRESS_FIELDS, "add-address")
      // add-address: คลิก close-modal-button จริง (Button จาก `@/components/button` ใน DialogClose asChild); edit-address: Escape
      await expectCloseButton(page, add.getByTestId("close-modal-button"), addTrigger, "add-address", "click")
      const editTrigger = page.getByTestId("address-edit-button").first()
      await editTrigger.click()
      const edit = page.getByTestId("edit-address-modal")
      await expectGaps(edit, ADDRESS_FIELDS, "edit-address")
      await expectCloseButton(page, edit.getByTestId("close-modal-button"), editTrigger, "edit-address")
    })

    await step("checkout ที่อยู่ (จัดส่ง + ใบเสร็จ) + โค้ดส่วนลด + shipping-address-select 36px", async () => {
      await page.goto(`/${CC}/products/t-shirt`)
      await addToCartFromPdp(page, { request, pk, customer })
      await page.goto(`/${CC}/checkout?step=address`)
      const main = page.locator("main")
      await expect(page.getByTestId("shipping-address-select")).toBeVisible()
      expect(await page.getByTestId("shipping-address-select").evaluate((el) => getComputedStyle(el).height)).toBe("36px")
      await page.getByTestId("billing-address-checkbox").click()
      await expectGaps(
        main,
        ["shipping-first-name-input", "shipping-last-name-input", "shipping-address-input", "shipping-address-2-input", "shipping-city-input", "shipping-province-input", "shipping-postal-code-input", "shipping-email-input", "shipping-phone-input"],
        "checkout shipping"
      )
      await expectGaps(
        main,
        ["billing-first-name-input", "billing-last-name-input", "billing-address-input", "billing-address-2-input", "billing-city-input", "billing-province-input", "billing-postal-input", "billing-phone-input"],
        "checkout billing"
      )
      await page.getByTestId("add-discount-button").click()
      // แถวโค้ดส่วนลด (ช่อง + ปุ่มใช้โค้ด) — กล่องของช่องใน shim (SFUI-5c) ครออีกชั้น จึงวัดที่แถวที่ครอบทั้งคู่
      const row = await page.getByTestId("discount-input").evaluate((el) => getComputedStyle(el.closest('[data-slot="field"]')!.parentElement!.parentElement!).columnGap)
      expect.soft(row, "discount row column-gap").toBe("16px")
      if (viewport.width === 1280) await evidence("01-checkout-address-gap-1280")
    })

    await step("เมนูข้าง + search drawer: ปุ่มปิด 36×36", async () => {
      await page.goto(`/${CC}`)
      const menu = page.getByTestId("nav-menu-button")
      await menu.click()
      await expectCloseButton(page, page.getByTestId("close-menu-button"), menu, "side menu")
      const search = page.getByTestId("nav-search-button")
      await search.click()
      await expect(page.getByTestId("search-drawer")).toBeVisible()
      await expectCloseButton(page, page.getByTestId("close-search-drawer"), search, "search drawer")
    })

    if (viewport.width === 390) {
      await step("PDP มือถือ: ปุ่มปิดของ mobile-actions 36×36", async () => {
        await page.goto(`/${CC}/products/t-shirt`)
        await expect(page).toHaveURL(/[?&]v_id=/)
        const top = await page.evaluate(
          () => document.querySelector('[data-testid="add-product-button"]')!.getBoundingClientRect().top + window.scrollY
        )
        await page.evaluate((y) => window.scrollTo(0, y), top + 300)
        const opener = page.getByTestId("mobile-actions-button")
        await expect(page.getByTestId("mobile-actions")).toHaveCSS("opacity", "1")
        await opener.click()
        const sheet = page.getByTestId("mobile-actions-modal")
        await expect(sheet).toBeVisible()
        await expectCloseButton(page, sheet.getByTestId("close-modal-button"), opener, "mobile actions")
        await evidence("02-mobile-actions-close-390")
      })
    }
  })
}
