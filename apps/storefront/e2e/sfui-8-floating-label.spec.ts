import type { APIRequestContext, BrowserContext, Locator, Page } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import { teamGroup } from "./support/group-buy"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { addToCartFromPdp } from "./support/server-action"

// SFUI-8 (spec 09 กฎ 23, AC-23): rule ป้ายลอยเดิมใน globals.css (`input:focus ~ label`, `input:not(:placeholder-shown) ~ label`)
// จับ <label> ทุกตัวที่ตามหลัง <input> พี่น้อง — ย้ายเป็น peer ของ common/components/input
// (1) ป้ายลอยทำงานเท่าค่าที่วัดที่ปลาย develop (b2b27ccc + e2a3ffa9): ว่าง 14px/20px ไม่เลื่อน, focus/มีค่า 10px/16px/400 เลื่อนขึ้น 12px
// (2)(3) label อื่นที่ rule เดิมจับ (option-button ที่มี radio sr-only นำหน้า, label ที่ครอบ product-quantity-select ที่มี input hidden
//     ของ fieldset/flash นำหน้า — บน PDP และหน้า group buy) ได้ค่าตาม className ของตัวเอง (text-small-regular = 12px/20px/400) และไม่เลื่อน
//     — ข้อ (2) ล้มบน commit ฐาน (บั๊กที่แก้)
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-8" } })

type Style = { size: string; lineHeight: string; weight: string; translate: string; left: string; duration: string }

const style = (locator: Locator): Promise<Style> =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      size: s.fontSize,
      lineHeight: s.lineHeight,
      weight: s.fontWeight,
      translate: s.translate,
      left: s.left,
      duration: s.transitionDuration,
    }
  })

const labelOf = (input: Locator) => input.locator("xpath=following-sibling::label[1]")

const RESTING = { size: "14px", lineHeight: "20px", weight: "400", translate: "none", left: "0px", duration: "0s" }
const FOCUSED = { size: "10px", lineHeight: "16px", weight: "400", translate: "0px -12px", left: "0px", duration: "0.3s" }
// ค่าที่เติม/กรอกแล้ว blur ลอยทันทีไม่มี transition (CORE-4e)
const FILLED = { ...FOCUSED, duration: "0s" }
const OWN_SMALL = { size: "12px", lineHeight: "20px", weight: "400", translate: "none" }

/** ว่าง → focus → กรอกแล้ว blur ของช่องที่ยังว่าง (รอ transition 300ms จบด้วย poll) */
async function expectFloating(page: Page, input: Locator, value: string) {
  const label = labelOf(input)
  await expect(input).toHaveValue("")
  expect(await style(label), "ว่างและไม่ focus").toEqual(RESTING)
  await input.focus()
  await expect.poll(() => style(label), { message: "focus" }).toEqual(FOCUSED)
  await input.fill(value)
  await input.blur()
  await expect.poll(() => style(label), { message: "กรอกแล้ว blur" }).toEqual(FILLED)
}

const ownStyle = async (locator: Locator) => {
  const { size, lineHeight, weight, translate } = await style(locator)
  return { size, lineHeight, weight, translate }
}

async function expectOptionButtons(fieldsets: Locator) {
  await expect(fieldsets.first()).toBeVisible()
  for (const fieldset of await fieldsets.all()) {
    const legend = await fieldset.locator("legend").boundingBox()
    const buttons = fieldset.getByTestId("option-button")
    expect(await buttons.count()).toBeGreaterThan(0)
    for (const button of await buttons.all()) {
      expect(await ownStyle(button), `option-button "${await button.textContent()}"`).toEqual(OWN_SMALL)
      const box = await button.boundingBox()
      expect(box!.y, "option-button ไม่ทับ legend").toBeGreaterThanOrEqual(legend!.y + legend!.height)
    }
  }
}

test("AC-23 (1): ป้ายลอยของ login / register เท่าค่าเดิม (ว่าง, focus, กรอกแล้ว blur)", async ({ page, step, evidence }) => {
  await page.goto(`/${CC}/account`)

  await step("login: email-input และ password-input", async () => {
    const login = page.getByTestId("login-page")
    await expectFloating(page, login.getByTestId("email-input"), "somchai@example.com")
    await expectFloating(page, login.getByTestId("password-input"), "not-a-real-password")
  })

  await step("register: first-name-input และ phone-input", async () => {
    await page.getByTestId("login-page").getByTestId("login-to-register-button").click()
    const register = page.getByTestId("register-page")
    await expect(register).toBeVisible()
    await expectFloating(page, register.getByTestId("first-name-input"), "สมชาย")
    await expectFloating(page, register.getByTestId("phone-input"), "0812345678")
    await register.getByTestId("last-name-input").focus()
    await expect.poll(() => style(labelOf(register.getByTestId("last-name-input")))).toEqual(FOCUSED)
    await evidence("01-register-floating-label")
  })
})

async function signedIn({ context, request, baseURL }: { context: BrowserContext; request: APIRequestContext; baseURL?: string }) {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  return { pk, customer }
}

test("AC-23 (1): ป้ายลอยของ checkout step=address เท่าค่าเดิม (ค่าที่เติมจากบัญชี, ว่าง → focus → กรอก)", async ({
  page,
  context,
  request,
  baseURL,
  evidence,
}) => {
  test.setTimeout(120_000)
  const { pk, customer } = await signedIn({ context, request, baseURL })
  await page.goto(`/${CC}/products/t-shirt`)
  await addToCartFromPdp(page, { request, pk, customer })
  await page.goto(`/${CC}/checkout?step=address`)
  const email = page.getByTestId("shipping-email-input")
  await expect(email).toHaveValue(customer.email)
  expect(await style(labelOf(email)), "อีเมลที่เติมจากโค้ดลอยทันทีไม่มี transition").toEqual(FILLED)
  await expectFloating(page, page.getByTestId("shipping-first-name-input"), "สมชาย")
  await expectFloating(page, page.getByTestId("shipping-address-input"), "1 ถนนสุขุมวิท")
  await evidence("03-checkout-address-floating-label")
})

// ล้มบน commit ฐาน: rule เดิมจับ label เหล่านี้ → 10px/16px และเลื่อนขึ้น 12px ทับ legend
test("AC-23 (2)(3): PDP และหน้า group buy — option-button และ label ของจำนวน 12px/20px/400 ไม่เลื่อน ไม่ทับ legend", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  await signedIn({ context, request, baseURL })

  await step("PDP /th/products/t-shirt", async () => {
    await page.goto(`/${CC}/products/t-shirt`)
    await expectOptionButtons(page.getByTestId("product-options").locator("xpath=ancestor::fieldset[1]"))
    const quantityLabel = page.getByTestId("product-quantity-select").locator("xpath=ancestor::label[1]")
    expect(await ownStyle(quantityLabel), "label ที่ครอบ product-quantity-select").toEqual(OWN_SMALL)
    await evidence("02-pdp-options-quantity")
  })

  await step("หน้า group buy /th/g/<token>", async () => {
    const team = await teamGroup(request, 3)
    await page.goto(`/${CC}/g/${team.token}`)
    await expectOptionButtons(page.getByTestId("group-options").locator("fieldset"))
  })
})
