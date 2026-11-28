import { Locator, Page } from "@playwright/test"

import { MISSING_ADDRESS_MESSAGE } from "../src/lib/util/address-required"
import { fieldErrorMessage } from "../src/lib/util/field-validation"

import { expect, test } from "./support/fixtures"
import { addAddresses } from "./support/group-buy"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, publishableKey, signInAs } from "./support/medusa"
import { chooseOption } from "./support/select"
import { addToCartFromPdp, isServerAction, waitForServerAction } from "./support/server-action"

// SFUI-20a (spec 09 กฎ 69, AC-62 — owner 2026-11-28: จังหวัดบังคับกรอก): ช่องจังหวัดทั้ง 5 ฟอร์ม `required` + `*`;
// ว่าง → error ระดับช่อง (กฎ 32b) จาก label จริง ไม่ส่ง server action; ช่องว่างล้วน → MISSING_ADDRESS_MESSAGE ของ server (ค่าจาก import)
test.use({ evidenceTarget: { feature: "storefront-consistency", taskId: "SFUI-20a" } })

const VALUE_MISSING = { valid: false, valueMissing: true, typeMismatch: false, patternMismatch: false }
/** ข้อความ fallback ของ action ที่อยู่ (lib/data/cart.ts setAddresses) — ข้อความ server ต้องไม่ใช่ตัวนี้ (บทเรียน CORE-83) */
const ADDRESS_FALLBACK = "บันทึกที่อยู่ไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง"

/** ข้อความ label ที่มองเห็น (ไม่รวม `*` แบบ aria-hidden) */
const labelText = (scope: Locator, id: string) =>
  scope.getByTestId(`${id}-label`).evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
    return (clone.textContent ?? "").trim()
  })

const fill = async (scope: Locator, values: Record<string, string>) => {
  for (const [id, value] of Object.entries(values)) await scope.getByTestId(id).fill(value)
}

/** ช่องจังหวัด required + label มี `*`; ส่งตอนว่าง → `<id>-error` = fieldErrorMessage จาก label จริง และไม่มี server action */
async function expectRequiredProvince(page: Page, scope: Locator, id: string, submit: Locator) {
  const input = scope.getByTestId(id)
  await expect(input, id).toHaveAttribute("required", "")
  await expect(scope.getByTestId(`${id}-label`).locator('[aria-hidden="true"]'), `${id} label *`).toHaveText("*")
  await input.fill("")
  const expected = fieldErrorMessage(VALUE_MISSING, { label: await labelText(scope, id), control: "input" })
  expect(expected, `${id} มีข้อความ error`).toBeTruthy()
  // นับ server action ตั้งแต่คลิกจน error ใต้ช่องขึ้น (submit ที่ผ่าน validation จะยิง request ทันทีที่คลิก)
  let actions = 0
  const onRequest = (request: Parameters<typeof isServerAction>[0]) => {
    if (isServerAction(request)) actions++
  }
  page.on("request", onRequest)
  await submit.click()
  await expect(scope.getByTestId(`${id}-error`)).toHaveText(expected!)
  await expect(input).toBeFocused()
  page.off("request", onRequest)
  expect(actions, `${id}: ไม่ส่ง server action`).toBe(0)
}

const SHIPPING = {
  "shipping-first-name-input": "สมหญิง",
  "shipping-last-name-input": "รักไทย",
  "shipping-address-input": "99/1 หมู่ 2",
  "shipping-address-2-input": "คลองเตยเหนือ",
  "shipping-city-input": "วัฒนา",
  "shipping-postal-code-input": "10110",
}
const BILLING = {
  "billing-first-name-input": "สมหญิง",
  "billing-last-name-input": "รักไทย",
  "billing-address-input": "7 ถนนสีลม",
  "billing-address-2-input": "สุริยวงศ์",
  "billing-city-input": "บางรัก",
  "billing-postal-input": "10500",
}
const ACCOUNT = {
  "first-name-input": "สมหญิง",
  "last-name-input": "รักไทย",
  "address-1-input": "99/1 หมู่ 2",
  "address-2-input": "คลองเตยเหนือ",
  "city-input": "วัฒนา",
  "postal-code-input": "10110",
}

test("AC-62: checkout — จังหวัดว่าง → error ใต้ช่อง (จัดส่ง/ใบเสร็จ/ที่อยู่ที่บันทึกไว้ที่ไม่มีจังหวัด), ช่องว่างล้วน → MISSING_ADDRESS_MESSAGE", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(150_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  // ที่อยู่ที่บันทึกไว้ก่อนรอบ 50 (ไม่มีจังหวัด) — แสดง/เลือกได้ แต่ส่งไม่ได้จนกรอกจังหวัด (กฎ 69)
  await addAddresses(request, pk, customer, [
    { first_name: "สมชาย", last_name: "ใจดี", address_1: "11 ถนนพระราม 4", address_2: "คลองเตย", city: "คลองเตย", postal_code: "10110", phone: "0812345678" },
  ])
  await signInAs(context, baseURL!, customer)
  await page.goto(`/${CC}/products/t-shirt`)
  await addToCartFromPdp(page, { request, pk, customer })
  await page.goto(`/${CC}/checkout?step=address`)
  const main = page.locator("main")
  const submit = page.getByTestId("submit-address-button")

  await step("ที่อยู่ที่บันทึกไว้ไม่มีจังหวัด → เลือกแล้วส่ง → error ใต้ shipping-province-input", async () => {
    await page.getByTestId("shipping-address-select").click()
    await page.getByTestId("shipping-address-option").first().click()
    await expect(page.getByTestId("shipping-first-name-input")).toHaveValue("สมชาย")
    await expect(page.getByTestId("shipping-province-input")).toHaveValue("")
    await expectRequiredProvince(page, main, "shipping-province-input", submit)
    await expect(page).toHaveURL(/step=address/)
  })

  await step("ที่อยู่ใบเสร็จแยก: billing-province-input ว่าง → error ใต้ช่อง", async () => {
    await fill(main, SHIPPING)
    await page.getByTestId("shipping-province-input").fill("กรุงเทพมหานคร")
    await page.getByTestId("shipping-email-input").fill(customer.email)
    await page.getByTestId("billing-address-checkbox").click()
    await fill(main, BILLING)
    await chooseOption(page.getByTestId("billing-country-select"), CC)
    await expectRequiredProvince(page, main, "billing-province-input", submit)
  })

  await step("จังหวัดเป็นช่องว่างล้วน → address-error-message = MISSING_ADDRESS_MESSAGE (≠ fallback)", async () => {
    await page.getByTestId("billing-province-input").fill("   ")
    const saved = waitForServerAction(page, (body) => body.includes(customer.email))
    await submit.click()
    await saved
    expect(MISSING_ADDRESS_MESSAGE).not.toBe(ADDRESS_FALLBACK)
    await expect(page.getByTestId("address-error-message")).toHaveText(MISSING_ADDRESS_MESSAGE)
    await expect(page).toHaveURL(/step=address/)
  })

  await step("กรอกจังหวัดแล้วส่ง → ไปขั้นจัดส่ง", async () => {
    await page.getByTestId("billing-province-input").fill("กรุงเทพมหานคร")
    await submit.click()
    await expect(page).toHaveURL(/step=delivery/, { timeout: 30_000 })
  })
})

test("AC-62: บัญชี — modal เพิ่ม/แก้ที่อยู่ และที่อยู่ใบเสร็จของโปรไฟล์: จังหวัดบังคับ; ช่องว่างล้วนใน modal → address-error = MISSING_ADDRESS_MESSAGE", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(150_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await addAddresses(request, pk, customer, [
    { first_name: "สมชาย", last_name: "ใจดี", address_1: "11 ถนนพระราม 4", address_2: "คลองเตย", city: "คลองเตย", postal_code: "10110", phone: "0812345678" },
  ])
  await signInAs(context, baseURL!, customer)

  await step("modal เพิ่มที่อยู่: state-input ว่าง → error ใต้ช่อง; ช่องว่างล้วน → address-error", async () => {
    await page.goto(`/${CC}/account/addresses`)
    await page.getByTestId("add-address-button").click()
    const modal = page.getByTestId("add-address-modal")
    await expect(modal).toBeVisible()
    await fill(modal, ACCOUNT)
    await chooseOption(modal.getByTestId("country-select"), CC)
    await expectRequiredProvince(page, modal, "state-input", modal.getByTestId("save-button"))
    await modal.getByTestId("state-input").fill("   ")
    const saved = waitForServerAction(page)
    await modal.getByTestId("save-button").click()
    await saved
    await expect(modal.getByTestId("address-error")).toHaveText(MISSING_ADDRESS_MESSAGE)
    await modal.getByTestId("cancel-button").click()
    await expect(modal).toBeHidden()
  })

  await step("modal แก้ที่อยู่ (ที่อยู่เดิมไม่มีจังหวัด): state-input ว่าง → error ใต้ช่อง", async () => {
    await page.getByTestId("address-edit-button").first().click()
    const modal = page.getByTestId("edit-address-modal")
    await expect(modal).toBeVisible()
    await expect(modal.getByTestId("state-input")).toHaveValue("")
    await expectRequiredProvince(page, modal, "state-input", modal.getByTestId("save-button"))
    await modal.getByTestId("cancel-button").click()
  })

  await step("ที่อยู่ใบเสร็จของโปรไฟล์: billing-province-input ว่าง → error ใต้ช่อง", async () => {
    await page.goto(`/${CC}/account/profile`)
    const billing = page.getByTestId("account-billing-address-editor")
    await billing.getByTestId("edit-button").click()
    await expect(billing.getByTestId("edit-panel")).toHaveAttribute("data-open", "true")
    await fill(billing, {
      "billing-first-name-input": "สมหญิง",
      "billing-last-name-input": "รักไทย",
      "billing-address-1-input": "7 ถนนสีลม",
      "billing-address-2-input": "สุริยวงศ์",
      "billing-city-input": "บางรัก",
      "billing-postcal-code-input": "10500",
      "billing-phone-input": "0812345678",
    })
    await chooseOption(billing.getByTestId("billing-country-code-select"), CC)
    await expectRequiredProvince(page, billing, "billing-province-input", billing.getByTestId("save-button"))
  })
})
