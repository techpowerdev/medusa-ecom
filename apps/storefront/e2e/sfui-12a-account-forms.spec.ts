import type { Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, publishableKey, signInAs } from "./support/medusa"
import { expectThai } from "./support/thai-text"

// SFUI-12a (spec 09 กฎ 28–31, 33b, 37; AC-34, AC-37): ฟอร์มของบัญชี — label เหนือช่อง, placeholder ตามตาราง inventory,
// ช่องเบอร์โทร type/autocomplete="tel", label ประเทศของที่อยู่ใบเสร็จ, และการจัดวาง: < 768px แถวละช่อง / ≥ 768px คู่ตามตารางกฎ 37b
// (profile-password ไม่ได้ render ในหน้า profile — ถูก comment ไว้ใน page.tsx ของ starter — จึงตรวจได้เฉพาะ static ใน SFUI-13)
test.use({ evidenceTarget: { feature: "storefront-forms", taskId: "SFUI-12a" } })

const PHONE = "เช่น 0812345678"
const POSTAL = "เช่น 10110"
// SFUI-18b (spec 09 กฎ 53–54): ช่องที่อยู่เรียงแบบไทย, placeholder ของบ้านเลขที่…, คู่ ตำบล/แขวง–เขต/อำเภอ และ จังหวัด–รหัสไปรษณีย์
const ADDRESS_1 = "เช่น 99/1 หมู่ 2 ซ.สุขุมวิท 3 ถ.สุขุมวิท"

/** testid → [บังคับ, placeholder] ตามลำดับ DOM (ตาราง inventory 12a) */
type Fields = [string, boolean, string?][]
const REGISTER: Fields = [
  ["first-name-input", true],
  ["last-name-input", true],
  ["email-input", true],
  ["phone-input", false, PHONE],
  ["password-input", true],
]
const NAME: Fields = [
  ["first-name-input", true],
  ["last-name-input", true],
]
const PHONE_FORM: Fields = [["phone-input", false, PHONE]]
const BILLING: Fields = [
  ["billing-first-name-input", true],
  ["billing-last-name-input", true],
  ["billing-company-input", false],
  ["billing-address-1-input", true, ADDRESS_1],
  ["billing-address-2-input", true], // SFUI-18c (กฎ 55): ตำบลบังคับ
  ["billing-city-input", true],
  ["billing-province-input", true], // SFUI-20a (กฎ 69): จังหวัดบังคับ
  ["billing-postcal-code-input", true, POSTAL],
  ["billing-phone-input", true, PHONE],
]
const ADDRESS: Fields = [
  ["first-name-input", true],
  ["last-name-input", true],
  ["company-input", false],
  ["address-1-input", true, ADDRESS_1],
  ["address-2-input", true], // SFUI-18c (กฎ 55): ตำบลบังคับ
  ["city-input", true],
  ["state-input", true], // SFUI-20a (กฎ 69): จังหวัดบังคับ
  ["postal-code-input", true, POSTAL],
  ["phone-input", false, PHONE],
]
const NAME_PAIRS = [["first-name-input", "last-name-input"]]
const BILLING_PAIRS = [
  ["billing-first-name-input", "billing-last-name-input"],
  ["billing-address-2-input", "billing-city-input"],
  ["billing-province-input", "billing-postcal-code-input"],
]
const ADDRESS_PAIRS = [
  ["first-name-input", "last-name-input"],
  ["address-2-input", "city-input"],
  ["state-input", "postal-code-input"],
]

const labelText = (label: Locator) =>
  label.evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
    return (clone.textContent ?? "").trim()
  })

/** กล่องของ control — ช่องรหัสผ่านใช้กล่อง InputGroup (กฎ 28) */
const controlBox = (control: Locator) =>
  control.evaluate((el) => {
    const r = (el.closest('[data-slot="input-group"]') ?? el).getBoundingClientRect()
    return { x: r.left, y: r.top, width: r.width, height: r.height }
  })
const fieldOf = (scope: Locator, id: string) => scope.getByTestId(id).locator("xpath=ancestor::*[@data-slot='field'][1]")

/** AC-34: เกณฑ์เดียวกับ AC-28 + placeholder ตามตาราง */
async function expectFields(page: Page, scope: Locator, fields: Fields) {
  for (const [id, required, placeholder] of fields) {
    const control = scope.getByTestId(id)
    const label = scope.getByTestId(`${id}-label`)
    await expect(label, id).toBeVisible()
    const box = await controlBox(control)
    const l = (await label.boundingBox())!
    expect(l.y + l.height, `${id}: label อยู่เหนือช่อง`).toBeLessThanOrEqual(box.y + 0.5)
    expect(Math.abs(l.x - box.x), `${id}: label ชิดซ้ายเดียวกับช่อง`).toBeLessThanOrEqual(1)
    expect(await control.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.getAttribute("data-testid"))).toBe(`${id}-label`)
    await expect(control, id).toHaveAccessibleName(await labelText(label))
    await expect(label.locator('[aria-hidden="true"]'), id).toHaveCount(required ? 1 : 0)
    // SFUI-16b (spec 09 กฎ 44): trigger ของ select (Radix) บังคับด้วย aria-required — required อยู่ที่ select ซ่อน
    if (required) await expect(control, id).toHaveAttribute(...(id.endsWith("-select") ? ["aria-required", "true"] : ["required", ""]) as [string, string])
    else await expect(control, id).not.toHaveAttribute("required")
    if (placeholder) await expect(control, id).toHaveAttribute("placeholder", placeholder)
    else await expect(control, id).not.toHaveAttribute("placeholder")
  }
  await expectThai(page, fields.map(([id]) => `${id}-label`))
}

async function expectTel(scope: Locator, id: string) {
  await expect(scope.getByTestId(id)).toHaveAttribute("type", "tel")
  await expect(scope.getByTestId(id)).toHaveAttribute("autocomplete", "tel")
}

/** AC-37 (1)(3): แถวละช่อง ตามลำดับ DOM, left/width เท่ากัน, ไม่ล้นแนวนอน */
async function expectStacked(page: Page, scope: Locator, fields: Fields) {
  let previous: { y: number; height: number } | null = null
  let first: { x: number; width: number } | null = null
  for (const [id] of fields) {
    const box = (await fieldOf(scope, id).boundingBox())!
    if (previous) expect(box.y, `${id}: อยู่ใต้ช่องก่อนหน้า`).toBeGreaterThanOrEqual(previous.y + previous.height - 0.5)
    first ??= box
    expect(Math.abs(box.x - first.x), `${id}: left เท่ากัน`).toBeLessThanOrEqual(1)
    expect(Math.abs(box.width - first.width), `${id}: กว้างเท่ากัน`).toBeLessThanOrEqual(1)
    previous = box
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

/** AC-37 (2): คู่ในตารางกฎ 37b แถวเดียวกัน; ช่องอื่นไม่มี control ที่ top เท่ากัน */
async function expectPairs(scope: Locator, fields: Fields, pairs: string[][]) {
  for (const [a, b] of pairs) {
    const [fa, fb] = [(await fieldOf(scope, a).boundingBox())!, (await fieldOf(scope, b).boundingBox())!]
    expect(Math.abs(fa.y - fb.y), `${a}–${b}: top เท่ากัน`).toBeLessThanOrEqual(1)
    expect(fb.x, `${a}–${b}: ช่องที่สองอยู่ขวา`).toBeGreaterThanOrEqual(fa.x + fa.width - 0.5)
    const [ca, cb] = [await controlBox(scope.getByTestId(a)), await controlBox(scope.getByTestId(b))]
    expect(Math.abs(ca.height - cb.height), `${a}–${b}: ความสูง control`).toBeLessThanOrEqual(1)
    const [la, lb] = [(await scope.getByTestId(`${a}-label`).boundingBox())!, (await scope.getByTestId(`${b}-label`).boundingBox())!]
    expect(Math.abs(la.y - lb.y), `${a}–${b}: label top เท่ากัน`).toBeLessThanOrEqual(1)
    expect(Math.abs(la.height - lb.height), `${a}–${b}: label บรรทัดเดียวเท่ากัน`).toBeLessThanOrEqual(1)
  }
  const paired = new Set(pairs.flat())
  const tops = await Promise.all(fields.map(async ([id]) => ({ id, y: (await controlBox(scope.getByTestId(id))).y })))
  for (const { id, y } of tops.filter(({ id }) => !paired.has(id))) {
    expect(tops.filter((t) => t.id !== id && Math.abs(t.y - y) <= 1).map((t) => t.id), `${id}: แถวละช่อง`).toEqual([])
  }
}

async function expectLayout(page: Page, open: () => Promise<Locator>, fields: Fields, pairs: string[][]) {
  for (const width of [375, 767, 768, 1280]) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : width === 768 ? 1024 : 800 })
    const scope = await open()
    if (width < 768) await expectStacked(page, scope, fields)
    else await expectPairs(scope, fields, pairs)
  }
}

async function signedIn(page: Page, context: import("@playwright/test").BrowserContext, request: import("@playwright/test").APIRequestContext, baseURL: string) {
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL, customer)
  return { pk, customer }
}

test("AC-34: register — label เหนือช่อง, placeholder ของเบอร์โทร, type/autocomplete tel", async ({ page, step }) => {
  await page.goto(`/${CC}/account`)
  await page.getByTestId("login-page").getByTestId("login-to-register-button").click()
  const register = page.getByTestId("register-page")
  await expect(register).toBeVisible()
  await step("ช่องของ register", async () => {
    await expectFields(page, register, REGISTER)
    await expectTel(register, "phone-input")
  })
  await step("390px แถวละช่องไม่ล้น", async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expectStacked(page, register, REGISTER)
  })
})

test("AC-34 + AC-37: profile — ชื่อ, เบอร์โทร, ที่อยู่ใบเสร็จ (label ประเทศ, tel, placeholder, คู่ช่องที่ ≥ 768px)", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  await signedIn(page, context, request, baseURL!)
  await page.goto(`/${CC}/account/profile`)
  const editor = (id: string) => async () => {
    const scope = page.getByTestId(id)
    const panel = scope.getByTestId("edit-panel")
    if ((await panel.getAttribute("data-open")) !== "true") await scope.getByTestId("edit-button").click()
    await expect(panel).toHaveAttribute("data-open", "true")
    return scope
  }

  await step("account-name-editor", async () => {
    const scope = await editor("account-name-editor")()
    await expectFields(page, scope, NAME)
    await expectLayout(page, editor("account-name-editor"), NAME, NAME_PAIRS)
  })

  await step("account-phone-editor", async () => {
    const scope = await editor("account-phone-editor")()
    await expectFields(page, scope, PHONE_FORM)
    await expectTel(scope, "phone-input")
  })

  await step("account-billing-address-editor", async () => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const scope = await editor("account-billing-address-editor")()
    await expectFields(page, scope, BILLING)
    await expectTel(scope, "billing-phone-input")
    await expectLayout(page, editor("account-billing-address-editor"), BILLING, BILLING_PAIRS)
    await page.setViewportSize({ width: 1280, height: 800 })
    await evidence("01-profile-billing-1280")
  })
})

test("AC-34 + AC-37: address book — dialog เพิ่ม/แก้ที่อยู่ (tel, placeholder, label ประเทศ, คู่ช่องที่ ≥ 768px)", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const { pk, customer } = await signedIn(page, context, request, baseURL!)
  const saved = await request.post(`${BACKEND_URL}/store/customers/me/addresses`, {
    headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
    data: { first_name: "สมชาย", last_name: "ใจดี", address_1: "11 ถนนพระราม 4", postal_code: "10110", city: "วัฒนา", country_code: CC },
  })
  expect(saved.status(), "saved address").toBe(200)
  await page.goto(`/${CC}/account/addresses`)

  const dialog = (opener: string, modal: string) => async () => {
    const scope = page.getByTestId(modal)
    if (!(await scope.isVisible())) await page.getByTestId(opener).first().click()
    await expect(scope).toBeVisible()
    // รอ animation เปิดของ Dialog (zoom) จบก่อนวัดกล่อง
    await scope.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
    return scope
  }

  for (const [opener, modal] of [
    ["add-address-button", "add-address-modal"],
    ["address-edit-button", "edit-address-modal"],
  ]) {
    await step(modal, async () => {
      await page.setViewportSize({ width: 1280, height: 800 })
      const scope = await dialog(opener, modal)()
      await expectFields(page, scope, ADDRESS)
      await expectTel(scope, "phone-input")
      await expectLayout(page, dialog(opener, modal), ADDRESS, ADDRESS_PAIRS)
      if (modal === "add-address-modal") await evidence("02-add-address-1280")
      await page.keyboard.press("Escape")
      await expect(scope).toHaveCount(0)
    })
  }
})

// SFUI-20b (spec 09 กฎ 70): ไม่มีช่องประเทศแล้ว — test AC-34 (กฎ 31a) "option ของ select ประเทศเท่า commit ฐาน" ถูกแทน
