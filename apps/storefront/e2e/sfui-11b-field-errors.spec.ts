import type { Locator } from "@playwright/test"

import { fieldErrorMessage } from "../src/lib/util/field-validation"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, publishableKey, signInAs } from "./support/medusa"
import { expectSelected } from "./support/select"
import { addToCartFromPdp } from "./support/server-action"
import { expectThai } from "./support/thai-text"

// SFUI-11b (spec 09 กฎ 32, AC-32): error ระดับช่องจาก validation native — ข้อความไทยใต้ช่อง, focus ช่องแรกที่ผิด, ไม่ส่ง server action,
// ล้างเมื่อค่าเปลี่ยนจน valid; ค่าที่คาดคำนวณจาก label จริงใน DOM ด้วย fieldErrorMessage (ไม่ hard-code)
test.use({ evidenceTarget: { feature: "storefront-forms", taskId: "SFUI-11b" } })

const MISSING = { valid: false, valueMissing: true, typeMismatch: false, patternMismatch: false }

/** ข้อความ label ของช่องโดยไม่รวม * (aria-hidden) */
const labelText = (scope: Locator, id: string) =>
  scope.getByTestId(`${id}-label`).evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
    return (clone.textContent ?? "").trim()
  })

const missingMessage = async (scope: Locator, id: string, control: "input" | "select" = "input") => {
  const message = fieldErrorMessage(MISSING, { label: await labelText(scope, id), control })
  expect(message, id).not.toBeNull()
  return message!
}

async function expectDescribedByError(control: Locator, error: Locator) {
  await expect(control).toHaveAttribute("aria-invalid", "true")
  const errorId = await error.getAttribute("id")
  expect(errorId, "FieldError มี id").toBeTruthy()
  expect(((await control.getAttribute("aria-describedby")) ?? "").split(/\s+/)).toContain(errorId)
}

test("AC-32: login — ช่องว่างแสดง error ใต้ช่อง ไม่ส่งฟอร์ม, อีเมลผิดรูปแบบใช้ title, กรอกถูกแล้ว error หาย", async ({
  page,
  step,
  evidence,
}) => {
  await page.goto(`/${CC}/account`)
  const login = page.getByTestId("login-page")
  const email = login.getByTestId("email-input")
  const emailError = login.getByTestId("email-input-error")

  await step("กด sign-in-button โดยช่องว่าง", async () => {
    const url = page.url()
    await login.getByTestId("sign-in-button").click()
    await expect(emailError).toBeVisible()
    await expect(login.getByTestId("password-input-error")).toBeVisible()
    await expectThai(page, ["email-input-error", "password-input-error"])
    await expect(emailError).toHaveText(await missingMessage(login, "email-input"))
    await expect(login.getByTestId("password-input-error")).toHaveText(await missingMessage(login, "password-input"))
    await expect(email).toBeFocused()
    await expectDescribedByError(email, emailError)
    expect(page.url()).toBe(url)
    await expect(page.getByTestId("login-error-message")).toHaveCount(0)
    await evidence("01-login-field-errors")
  })

  await step("กรอก abc แล้วส่ง → error = title ของช่อง", async () => {
    await email.fill("abc")
    await login.getByTestId("sign-in-button").click()
    const title = await email.getAttribute("title")
    expect(title, "email-input มี title").toBeTruthy()
    await expect(emailError).toHaveText(title!)
  })

  await step("กรอกอีเมลถูก → error หายและไม่มี aria-invalid", async () => {
    await email.fill("somchai@example.com")
    await expect(emailError).toHaveCount(0)
    await expect(email).not.toHaveAttribute("aria-invalid")
  })
})

test("AC-32: checkout step=address — ช่องว่างแสดง error, focus ช่องแรก; เลือกที่อยู่ที่บันทึกไว้แล้ว error ของช่องที่เติมหาย", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const saved = await request.post(`${BACKEND_URL}/store/customers/me/addresses`, {
    headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
    data: {
      first_name: "สมชาย",
      last_name: "ใจดี",
      address_1: "11 ถนนพระราม 4",
      address_2: "คลองเตยเหนือ",
      postal_code: "10110",
      city: "วัฒนา",
      province: "กรุงเทพมหานคร",
      country_code: CC,
      phone: "0812345678",
    },
  })
  expect(saved.status(), "saved address").toBe(200)
  await signInAs(context, baseURL!, customer)
  await page.goto(`/${CC}/products/t-shirt`)
  await addToCartFromPdp(page, { request, pk, customer })
  await page.goto(`/${CC}/checkout?step=address`)
  const main = page.locator("main")
  const firstName = page.getByTestId("shipping-first-name-input")
  const firstNameError = page.getByTestId("shipping-first-name-input-error")
  const countryError = page.getByTestId("shipping-country-select-error")
  // จำลองช่องประเทศว่าง (ผู้ใช้เลือกค่าว่างเองไม่ได้): ตั้ง select ซ่อนของ Radix (ข้าง trigger) เป็น "" แล้วส่ง change → onValueChange("") ให้ state ของฟอร์มเป็น ""
  const emptyCountry = () =>
    page.getByTestId("shipping-country-select").evaluate((trigger) => {
      const select = trigger.parentElement!.querySelector("select")!
      select.value = ""
      select.dispatchEvent(new Event("change", { bubbles: true }))
    })

  await step("กด submit-address-button โดยช่องว่าง", async () => {
    await expect(firstName).toHaveValue("")
    // region th มีประเทศเดียว → Medusa สร้าง cart พร้อม shipping_address.country_code = th (ฟอร์มเติมประเทศไว้แล้ว)
    await emptyCountry()
    await expectSelected(page.getByTestId("shipping-country-select"), "")
    await page.getByTestId("submit-address-button").click()
    await expect(firstNameError).toBeVisible()
    await expect(countryError).toBeVisible()
    await expect(firstNameError).toHaveText(await missingMessage(main, "shipping-first-name-input"))
    await expect(countryError).toHaveText(await missingMessage(main, "shipping-country-select", "select"))
    await expect(countryError).toHaveText("กรุณาเลือกประเทศ")
    await expectThai(page, ["shipping-first-name-input-error", "shipping-country-select-error"])
    await expect(firstName).toBeFocused()
    await expectDescribedByError(firstName, firstNameError)
    await expectDescribedByError(page.getByTestId("shipping-country-select"), countryError)
    await evidence("02-checkout-field-errors")
  })

  await step("เลือกที่อยู่ที่บันทึกไว้ → error ของช่องที่ถูกเติมหาย", async () => {
    await page.getByTestId("shipping-address-select").click()
    await page.getByTestId("shipping-address-option").first().click()
    await expect(firstName).toHaveValue("สมชาย")
    await expect(firstNameError).toHaveCount(0)
    await expect(countryError).toHaveCount(0)
    await expect(firstName).not.toHaveAttribute("aria-invalid")
    await expect(page.getByTestId("shipping-country-select")).not.toHaveAttribute("aria-invalid")
  })

  // SFUI-16b (spec 09 AC-44, กฎ 43): ช่องอื่นครบ ประเทศว่าง → error ของ select และ focus อยู่ที่ trigger
  await step("ประเทศว่างช่องเดียว → shipping-country-select-error และ focus ที่ trigger", async () => {
    await emptyCountry()
    await expectSelected(page.getByTestId("shipping-country-select"), "")
    await page.getByTestId("submit-address-button").click()
    await expect(countryError).toHaveText("กรุณาเลือกประเทศ")
    await expect(firstNameError).toHaveCount(0)
    await expect(page.getByTestId("shipping-country-select")).toBeFocused()
    await expectDescribedByError(page.getByTestId("shipping-country-select"), countryError)
  })
})

test("AC-32: affiliate สมัคร — รหัสแนะนำผิด pattern → error = title ของช่อง", async ({ page }) => {
  await page.goto(`/${CC}/affiliate/login`)
  const code = page.getByTestId("affiliate-register-code")
  await code.fill("AB")
  await page.getByTestId("affiliate-register-submit").click()
  const title = await code.getAttribute("title")
  expect(title, "affiliate-register-code มี title").toBeTruthy()
  await expect(page.getByTestId("affiliate-register-code-error")).toHaveText(title!)
  await expectDescribedByError(code, page.getByTestId("affiliate-register-code-error"))
  await expect(page.getByTestId("affiliate-register-error")).toHaveCount(0)
})
