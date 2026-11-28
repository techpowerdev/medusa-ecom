import type { Locator, Page } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { addToCartFromPdp } from "./support/server-action"
import { expectThai } from "./support/thai-text"

// SFUI-11a (spec 09 กฎ 28–30, 35, AC-28): ช่องกรอกของ login / register / checkout step=address เป็น `field` ของ shadcn —
// label อยู่เหนือ control ชิดซ้ายเดียวกัน, labels[0] ชี้ label ของช่อง, ช่องบังคับมี * (aria-hidden), ช่องสูงตาม default (36px)
test.use({ evidenceTarget: { feature: "storefront-forms", taskId: "SFUI-11a" } })

/** testid ของ control → บังคับกรอกหรือไม่ (ตาราง inventory ของ spec 09 รอบ 48) */
type Fields = Record<string, boolean>
const LOGIN: Fields = { "email-input": true, "password-input": true }
const REGISTER: Fields = {
  "first-name-input": true,
  "last-name-input": true,
  "email-input": true,
  "phone-input": false,
  "password-input": true,
}
const SHIPPING: Fields = {
  "shipping-first-name-input": true,
  "shipping-last-name-input": true,
  "shipping-address-input": true,
  "shipping-company-input": false,
  "shipping-postal-code-input": true,
  "shipping-city-input": true,
  "shipping-country-select": true,
  "shipping-province-input": true, // SFUI-20a (spec 09 กฎ 69): จังหวัดบังคับ
  "shipping-email-input": true,
  "shipping-phone-input": false,
}

/** กล่องของ control — ช่องรหัสผ่านใช้กล่อง InputGroup ที่ครอบ <input> (กฎ 28) */
const boxOf = (control: Locator) =>
  control.evaluate((el) => {
    const box = (el.closest('[data-slot="input-group"]') ?? el).getBoundingClientRect()
    return { top: box.top, left: box.left, right: box.right }
  })

const labelText = (label: Locator) =>
  label.evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
    return (clone.textContent ?? "").trim()
  })

async function expectLabelAbove(scope: Locator, fields: Fields) {
  for (const [id, required] of Object.entries(fields)) {
    const control = scope.getByTestId(id)
    const label = scope.getByTestId(`${id}-label`)
    await expect(label, id).toBeVisible()
    const box = await boxOf(control)
    const l = (await label.boundingBox())!
    expect(l.y + l.height, `${id}: label อยู่เหนือช่อง`).toBeLessThanOrEqual(box.top + 0.5)
    expect(Math.abs(l.x - box.left), `${id}: label ชิดซ้ายเดียวกับช่อง`).toBeLessThanOrEqual(1)
    expect(
      await control.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.getAttribute("data-testid") ?? null),
      `${id}: labels[0]`
    ).toBe(`${id}-label`)
    // ชื่อที่เข้าถึงได้ = ข้อความ label ใน DOM โดยไม่รวม * (aria-hidden — กฎ 30)
    await expect(control, id).toHaveAccessibleName(await labelText(label))
    if (required) {
      // SFUI-16b (spec 09 กฎ 44): trigger ของ select (Radix) บังคับด้วย aria-required — required อยู่ที่ select ซ่อน
      await expect(control, id).toHaveAttribute(...(id.endsWith("-select") ? ["aria-required", "true"] : ["required", ""]) as [string, string])
      await expect(label.locator('[aria-hidden="true"]'), id).toHaveText("*")
    } else {
      await expect(control, id).not.toHaveAttribute("required")
      await expect(label.locator('[aria-hidden="true"]'), id).toHaveCount(0)
    }
  }
}

/** label ที่เลื่อนด้วย translate (floating label เดิม) ต้องไม่มีเหลือในขอบเขต */
const translatedLabels = (scope: Locator) =>
  scope.locator("label").evaluateAll((labels) =>
    labels.filter((l) => !["none", ""].includes(getComputedStyle(l).translate)).map((l) => l.outerHTML.slice(0, 80))
  )

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

const labelIds = (fields: Fields) => Object.keys(fields).map((id) => `${id}-label`)

test("AC-28: login และ register — label เหนือช่อง, * เฉพาะช่องบังคับ, สูง 36px, 390px ไม่ล้น", async ({ page, step, evidence }) => {
  await page.goto(`/${CC}/account`)

  await step("login", async () => {
    const login = page.getByTestId("login-page")
    await expectLabelAbove(login, LOGIN)
    await expectThai(page, labelIds(LOGIN))
    expect(await login.getByTestId("email-input").evaluate((el) => getComputedStyle(el).height)).toBe("36px")
    await expect(login.getByTestId("email-input")).toHaveAccessibleName("อีเมล")
    // ชื่อของปุ่มตามสถานะ (กฎ 34) — ค่าจากโค้ดของ common/components/input
    const toggle = login.getByTestId("password-input-toggle")
    await expect(toggle).toHaveAccessibleName("แสดงรหัสผ่าน")
    await expect(toggle).toHaveAttribute("aria-pressed", "false")
    await toggle.click()
    await expect(toggle).toHaveAccessibleName("ซ่อนรหัสผ่าน")
    await expect(login.getByTestId("password-input")).toHaveAttribute("type", "text")
    await toggle.click()
    expect(await translatedLabels(login)).toEqual([])
    await evidence("01-login-1280")
  })

  await step("register", async () => {
    await page.getByTestId("login-page").getByTestId("login-to-register-button").click()
    const register = page.getByTestId("register-page")
    await expect(register).toBeVisible()
    await expectLabelAbove(register, REGISTER)
    await expectThai(page, labelIds(REGISTER))
    expect(await translatedLabels(register)).toEqual([])
  })

  await step("390px ไม่ล้นแนวนอน", async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expectLabelAbove(page.getByTestId("register-page"), REGISTER)
    await expectNoOverflow(page)
  })
})

test("AC-28: checkout step=address — label เหนือช่อง, checkbox แนวนอน, ประเทศสูงเท่าเขต/อำเภอ, 390px ไม่ล้น", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  await page.goto(`/${CC}/products/t-shirt`)
  await addToCartFromPdp(page, { request, pk, customer })
  await page.goto(`/${CC}/checkout?step=address`)
  await expect(page.getByTestId("shipping-email-input")).toHaveValue(customer.email)

  for (const width of [1280, 390]) {
    await step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 })
      const main = page.locator("main")
      await expectLabelAbove(main, SHIPPING)
      await expectThai(page, [...labelIds(SHIPPING), "billing-address-checkbox-label"])

      await expect(page.getByTestId("billing-address-checkbox")).toHaveAccessibleName(
        await labelText(page.getByTestId("billing-address-checkbox-label"))
      )
      const checkbox = (await page.getByTestId("billing-address-checkbox").boundingBox())!
      const checkboxLabel = (await page.getByTestId("billing-address-checkbox-label").boundingBox())!
      expect(checkboxLabel.x, "label ของ checkbox อยู่ขวาของ checkbox").toBeGreaterThanOrEqual(checkbox.x + checkbox.width)

      const height = (id: string) => page.getByTestId(id).evaluate((el) => el.getBoundingClientRect().height)
      expect(Math.abs((await height("shipping-country-select")) - (await height("shipping-city-input")))).toBeLessThanOrEqual(1)
      expect(await translatedLabels(main)).toEqual([])
      await expectNoOverflow(page)
      await evidence(width === 1280 ? "02-checkout-address-1280" : "03-checkout-address-390")
    })
  }
})
