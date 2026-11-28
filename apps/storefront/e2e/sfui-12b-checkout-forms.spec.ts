import type { BrowserContext, Locator, Page } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import { createVoucher } from "./support/evoucher"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { addToCartFromPdp } from "./support/server-action"
import { expectThai } from "./support/thai-text"

// SFUI-12b (spec 09 กฎ 28–31, 32d, 33, 37; AC-34, AC-37): ฟอร์มของ checkout — ที่อยู่จัดส่ง, ที่อยู่ใบเสร็จ, อีเมลของ cart digital-only
// และโค้ดส่วนลด เป็น `field` ของ shadcn (label เหนือช่อง, * เฉพาะช่องบังคับ, placeholder ตามตาราง inventory)
// และจัดวางด้วย breakpoint มาตรฐานของ Tailwind: < 768px แถวละช่อง, ≥ 768px คู่ตามตารางกฎ 37b
test.use({ evidenceTarget: { feature: "storefront-forms", taskId: "SFUI-12b" } })

/** testid ของ control → [บังคับกรอก, placeholder (null = ไม่มี attribute)] — ตาราง inventory 12b */
type Fields = Record<string, [required: boolean, placeholder: string | null]>
const PHONE = "เช่น 0812345678"
const POSTAL = "เช่น 10110"
// SFUI-18b (spec 09 กฎ 52–54): ช่องตำบล/แขวงใหม่, ลำดับแบบที่อยู่ไทย, placeholder ของบ้านเลขที่…, คู่ใหม่
const ADDRESS_1 = "เช่น 99/1 หมู่ 2 ซ.สุขุมวิท 3 ถ.สุขุมวิท"
const SHIPPING: Fields = {
  "shipping-first-name-input": [true, null],
  "shipping-last-name-input": [true, null],
  "shipping-company-input": [false, null],
  "shipping-address-input": [true, ADDRESS_1],
  "shipping-address-2-input": [true, null], // SFUI-18c (กฎ 55): ตำบลบังคับ
  "shipping-city-input": [true, null],
  "shipping-province-input": [true, null], // SFUI-20a (กฎ 69): จังหวัดบังคับ
  "shipping-postal-code-input": [true, POSTAL],
  "shipping-email-input": [true, null],
  "shipping-phone-input": [false, PHONE],
}
const BILLING: Fields = {
  "billing-first-name-input": [true, null],
  "billing-last-name-input": [true, null],
  "billing-company-input": [false, null],
  "billing-address-input": [true, ADDRESS_1],
  "billing-address-2-input": [true, null],
  "billing-city-input": [true, null],
  "billing-province-input": [true, null], // SFUI-20a (กฎ 69): จังหวัดบังคับ
  "billing-postal-input": [true, POSTAL],
  "billing-phone-input": [false, PHONE],
}
const DIGITAL_EMAIL: Fields = { "billing-email-input": [true, null] }
const DISCOUNT: Fields = { "discount-input": [false, null] }

/** ลำดับ DOM ของช่อง (กฎ 37a) และคู่ที่วางแถวเดียวกันที่ ≥ 768px (ตารางกฎ 37b) */
const SHIPPING_ORDER = [
  ...Object.keys(SHIPPING).slice(0, 8), // SFUI-20b (กฎ 70): ไม่มี shipping-country-select แล้ว (เดิม 9 ช่องก่อนอีเมล)
  "billing-address-checkbox",
  "shipping-email-input",
  "shipping-phone-input",
]
const SHIPPING_PAIRS: [string, string][] = [
  ["shipping-first-name-input", "shipping-last-name-input"],
  ["shipping-address-2-input", "shipping-city-input"],
  ["shipping-province-input", "shipping-postal-code-input"],
  ["shipping-email-input", "shipping-phone-input"],
]
const BILLING_PAIRS: [string, string][] = [
  ["billing-first-name-input", "billing-last-name-input"],
  ["billing-address-2-input", "billing-city-input"],
  ["billing-province-input", "billing-postal-input"],
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
    const b = (el.closest('[data-slot="input-group"]') ?? el).getBoundingClientRect()
    return { top: b.top, left: b.left, right: b.right, bottom: b.bottom, height: b.height }
  })

/** กล่อง `[data-slot="field"]` ที่ครอบ control (AC-37 ข้อ 1) */
const fieldBox = async (page: Page, id: string) =>
  (await page.getByTestId(id).locator("xpath=ancestor::*[@data-slot='field'][1]").boundingBox())!

/** เกณฑ์ของ AC-28 + placeholder ของ AC-34 */
async function expectFields(page: Page, fields: Fields) {
  for (const [id, [required, placeholder]] of Object.entries(fields)) {
    const control = page.getByTestId(id)
    const label = page.getByTestId(`${id}-label`)
    await expect(label, id).toBeVisible()
    const box = await controlBox(control)
    const l = (await label.boundingBox())!
    expect(l.y + l.height, `${id}: label อยู่เหนือช่อง`).toBeLessThanOrEqual(box.top + 0.5)
    expect(Math.abs(l.x - box.left), `${id}: label ชิดซ้ายเดียวกับช่อง`).toBeLessThanOrEqual(1)
    expect(
      await control.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.getAttribute("data-testid") ?? null),
      `${id}: labels[0]`
    ).toBe(`${id}-label`)
    await expect(control, id).toHaveAccessibleName(await labelText(label))
    if (required) {
      // SFUI-16b (spec 09 กฎ 44): trigger ของ select (Radix) บังคับด้วย aria-required — required อยู่ที่ select ซ่อน
      await expect(control, id).toHaveAttribute(...(id.endsWith("-select") ? ["aria-required", "true"] : ["required", ""]) as [string, string])
      await expect(label.locator('[aria-hidden="true"]'), id).toHaveText("*")
    } else {
      await expect(control, id).not.toHaveAttribute("required")
      await expect(label.locator('[aria-hidden="true"]'), id).toHaveCount(0)
    }
    if (placeholder === null) {
      await expect(control, `${id}: ไม่มี placeholder`).not.toHaveAttribute("placeholder")
    } else {
      await expect(control, `${id}: placeholder`).toHaveAttribute("placeholder", placeholder)
    }
  }
  await expectThai(page, Object.keys(fields).map((id) => `${id}-label`))
}


/** AC-37 ข้อ 1/3: แถวละช่องตามลำดับ DOM, left เท่ากัน, กว้างเท่ากัน (ยกเว้นแถว checkbox), ไม่ล้นแนวนอน */
async function expectSingleColumn(page: Page, order: string[]) {
  const boxes = await Promise.all(order.map((id) => fieldBox(page, id)))
  const widthRef = boxes[order.findIndex((id) => id !== "billing-address-checkbox")]
  boxes.forEach((b, i) => {
    const id = order[i]
    if (i > 0) {
      const prev = boxes[i - 1]
      expect(b.y, `${id}: อยู่ใต้ ${order[i - 1]}`).toBeGreaterThanOrEqual(prev.y + prev.height - 0.5)
    }
    expect(Math.abs(b.x - boxes[0].x), `${id}: left เท่ากัน`).toBeLessThanOrEqual(1)
    if (id !== "billing-address-checkbox") {
      expect(Math.abs(b.width - widthRef.width), `${id}: กว้างเท่ากัน`).toBeLessThanOrEqual(1)
    }
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "ไม่ล้นแนวนอน").toBe(true)
}

/** AC-37 ข้อ 2: คู่อยู่แถวเดียวกัน (a ซ้าย), control สูงเท่ากัน, label ระดับเดียวกัน; ช่องที่ไม่อยู่ในคู่ไม่มี control อื่นที่ top เท่ากัน */
async function expectPairs(page: Page, controls: string[], pairs: [string, string][]) {
  for (const [a, b] of pairs) {
    const fa = await fieldBox(page, a)
    const fb = await fieldBox(page, b)
    expect(Math.abs(fa.y - fb.y), `${a}–${b}: แถวเดียวกัน`).toBeLessThanOrEqual(1)
    expect(fb.x, `${b} อยู่ขวาของ ${a}`).toBeGreaterThanOrEqual(fa.x + fa.width)
    const ca = await controlBox(page.getByTestId(a))
    const cb = await controlBox(page.getByTestId(b))
    expect(Math.abs(ca.height - cb.height), `${a}–${b}: control สูงเท่ากัน`).toBeLessThanOrEqual(1)
    const la = (await page.getByTestId(`${a}-label`).boundingBox())!
    const lb = (await page.getByTestId(`${b}-label`).boundingBox())!
    expect(Math.abs(la.y - lb.y), `${a}–${b}: label ระดับเดียวกัน`).toBeLessThanOrEqual(1)
  }
  const paired = new Set(pairs.flat())
  const tops = await Promise.all(controls.map(async (id) => (await controlBox(page.getByTestId(id))).top))
  controls.forEach((id, i) => {
    if (paired.has(id)) return
    const same = controls.filter((other, j) => j !== i && Math.abs(tops[j] - tops[i]) <= 1)
    expect(same, `${id}: ไม่มี control อื่นในแถวเดียวกัน`).toEqual([])
  })
}

async function checkoutWith(page: Page, context: BrowserContext, request: Parameters<typeof adminHeaders>[0], baseURL: string, product?: string) {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL, customer)
  const handle = product ?? (await createVoucher(request, admin)).handle
  await page.goto(`/${CC}/products/${handle}`)
  await addToCartFromPdp(page, { request, pk, customer })
  await page.goto(`/${CC}/checkout?step=address`)
  return customer
}

test("AC-34, AC-37: checkout ที่อยู่จัดส่ง + ใบเสร็จ — label เหนือช่อง, placeholder, option เท่าเดิม, แถวละช่อง < 768px / คู่ ≥ 768px", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(150_000)
  const customer = await checkoutWith(page, context, request, baseURL!, "t-shirt")
  await expect(page.getByTestId("shipping-email-input")).toHaveValue(customer.email)
  // ปิด "ใช้ที่อยู่จัดส่งเป็นที่อยู่สำหรับออกใบเสร็จ" → ฟอร์มที่อยู่ใบเสร็จแสดง
  await page.getByTestId("billing-address-checkbox").click()
  await expect(page.getByTestId("billing-first-name-input")).toBeVisible()

  await step("AC-34 ช่องของสองฟอร์ม + option ของ select ประเทศ", async () => {
    await expectFields(page, SHIPPING)
    await expectFields(page, BILLING)
    await expect(page.getByTestId("billing-address-checkbox")).toHaveAccessibleName(
      await labelText(page.getByTestId("billing-address-checkbox-label"))
    )
    const checkbox = (await page.getByTestId("billing-address-checkbox").boundingBox())!
    const checkboxLabel = (await page.getByTestId("billing-address-checkbox-label").boundingBox())!
    expect(checkboxLabel.x, "label ของ checkbox อยู่ขวาของ checkbox").toBeGreaterThanOrEqual(checkbox.x + checkbox.width)
  })

  const order = [...SHIPPING_ORDER, ...Object.keys(BILLING)]
  for (const [width, height] of [
    [375, 812],
    [767, 1024],
  ]) {
    await step(`AC-37 ${width}px: แถวละช่อง`, async () => {
      await page.setViewportSize({ width, height })
      await expectSingleColumn(page, order)
      if (width === 375) await evidence("02-checkout-address-375")
    })
  }
  for (const [width, height] of [
    [768, 1024],
    [1280, 800],
  ]) {
    await step(`AC-37 ${width}px: คู่ตามตารางกฎ 37b`, async () => {
      await page.setViewportSize({ width, height })
      await expectPairs(page, [...Object.keys(SHIPPING), ...Object.keys(BILLING)], [...SHIPPING_PAIRS, ...BILLING_PAIRS])
      if (width === 1280) await evidence("01-checkout-address-1280")
    })
  }
})

test("AC-34, AC-37: checkout ของ cart digital-only — อีเมลแถวเดียว, ช่องใบเสร็จเป็นคู่ ≥ 768px", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(150_000)
  await checkoutWith(page, context, request, baseURL!)
  await expect(page.getByTestId("billing-email-input")).toBeVisible()

  await step("AC-34", async () => {
    await expectFields(page, { ...BILLING, ...DIGITAL_EMAIL })
  })
  const order = [...Object.keys(BILLING), "billing-email-input"]
  for (const width of [375, 767]) {
    await step(`AC-37 ${width}px: แถวละช่อง`, async () => {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 1024 })
      await expectSingleColumn(page, order)
    })
  }
  for (const [width, height] of [
    [768, 1024],
    [1280, 800],
  ]) {
    await step(`AC-37 ${width}px: คู่ของที่อยู่ใบเสร็จ อีเมลไม่มีคู่`, async () => {
      await page.setViewportSize({ width, height })
      await expectPairs(page, order, BILLING_PAIRS)
    })
  }
})

test("AC-34: โค้ดส่วนลด — label เหนือช่อง และ promotion-error ผูก aria-describedby ขณะช่องเปิด (กฎ 32d)", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  await checkoutWith(page, context, request, baseURL!, "t-shirt")
  const input = page.getByTestId("discount-input")

  await step("เปิดช่องโค้ด → label เหนือช่อง ไม่มี aria-describedby", async () => {
    await page.getByTestId("add-discount-button").click()
    await expect(input).toBeVisible()
    await expectFields(page, DISCOUNT)
    await expect(input).toHaveAttribute("id", "promotion-input")
    await expect(input).toHaveAttribute("name", "code")
    await expect(input).not.toHaveAttribute("aria-describedby")
  })

  await step("ใส่โค้ดที่ไม่มี → promotion-error แสดงและช่องอ้าง id ของมัน", async () => {
    await input.fill(`NOPE-SFUI12B-${Date.now()}`)
    await page.getByTestId("discount-apply-button").click()
    const error = page.getByTestId("promotion-error")
    await expect(error).toBeVisible()
    await expectThai(page, ["promotion-error"])
    const errorId = await error.getAttribute("id")
    expect(errorId, "promotion-error มี id").toBeTruthy()
    const describedBy = ((await input.getAttribute("aria-describedby")) ?? "").split(/\s+/)
    expect(describedBy).toContain(errorId)
    for (const id of describedBy) {
      expect(await page.locator(`[id="${id}"]`).count(), `aria-describedby ${id} มี element จริง`).toBe(1)
    }
    await evidence("03-discount-error")
  })
})
