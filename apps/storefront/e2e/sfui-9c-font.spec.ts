import type { Locator } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { addToCartFromPdp } from "./support/server-action"

// SFUI-9c (spec 09 กฎ 22, AC-21): checkout + cart หลังแทน utility ขนาดฟอนต์ของ starter ด้วย utility มาตรฐานของ Tailwind
// ค่าที่คาด = ค่าที่ render จริงที่ปลาย develop ก่อนแก้ (spec นี้ต้องผ่านทั้งบน commit ฐานและหลังแก้) — จุดตัวอย่างครบทุกขนาดในขอบเขต:
// 12px/20px/400, 12px/20px/600, 14px/24px/400, 14px/24px/600, 30px/48px/600 (ไม่มีจุดที่เข้ากฎ 22b/22c ในขอบเขต)
// (ปุ่ม RadioGroupItem มี span ของ indicator `data-slot="radio-group-indicator"` นำหน้าเมื่อถูกเลือก — ข้ามด้วย :not([data-slot]))
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-9c" } })

type Font = { size: string; lineHeight: string; weight: string }

const font = (locator: Locator): Promise<Font> =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return { size: s.fontSize, lineHeight: s.lineHeight, weight: s.fontWeight }
  })

const SMALL_REGULAR: Font = { size: "12px", lineHeight: "20px", weight: "400" }
const SMALL_SEMI: Font = { size: "12px", lineHeight: "20px", weight: "600" }
const BASE_REGULAR: Font = { size: "14px", lineHeight: "24px", weight: "400" }
const BASE_SEMI: Font = { size: "14px", lineHeight: "24px", weight: "600" }
const XXL_SEMI: Font = { size: "30px", lineHeight: "48px", weight: "600" }

const savedAddress = {
  first_name: "สมชาย",
  last_name: "ใจดี",
  company: "บริษัท ทดสอบ จำกัด",
  address_1: "11 ถนนพระราม 4",
  address_2: "คลองเตยเหนือ",
  postal_code: "10110",
  city: "วัฒนา",
  province: "กรุงเทพมหานคร",
  country_code: CC,
  phone: "0812345678",
}

test("AC-21: checkout (not-found, ที่อยู่, จัดส่ง, ชำระเงิน) และตะกร้าว่าง คงขนาดตัวอักษร/ระยะบรรทัด/น้ำหนักเดิม", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const store = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const saved = await request.post(`${BACKEND_URL}/store/customers/me/addresses`, { headers: store, data: savedAddress })
  expect(saved.status(), "saved address").toBe(200)
  await signInAs(context, baseURL!, customer)

  await step("ยังไม่มี cart: not-found ของ (checkout) หัวข้อ 30px/48px/600 คำอธิบาย 12px/20px/400; ตะกร้าว่าง 14px/24px/400", async () => {
    await page.goto(`/${CC}/checkout`)
    await expect(page.getByTestId("not-found-title")).toBeVisible()
    expect.soft(await font(page.getByTestId("not-found-title"))).toEqual(XXL_SEMI)
    expect.soft(await font(page.getByTestId("not-found-description"))).toEqual(SMALL_REGULAR)

    await page.goto(`/${CC}/cart`)
    const empty = page.getByTestId("empty-cart-message")
    await expect(empty).toBeVisible()
    expect.soft(await font(empty.locator("h1 + p"))).toEqual(BASE_REGULAR)
  })

  await step("ขั้นที่อยู่: ลิงก์กลับตะกร้า 12px/20px/600, คำทักที่อยู่ที่บันทึก 12px/20px/400, ตัวเลือกที่อยู่ 14px/24px/600 + 12px/20px/400 + 14px/24px/400, error 12px/20px/400", async () => {
    await page.goto(`/${CC}/products/t-shirt`)
    await addToCartFromPdp(page, { request, pk, customer })
    await page.goto(`/${CC}/checkout?step=address`)
    expect.soft(await font(page.getByTestId("back-to-cart-link"))).toEqual(SMALL_SEMI)
    const greeting = page.getByTestId("saved-address-greeting")
    await expect(greeting).toBeVisible()
    expect.soft(await font(greeting.locator("p"))).toEqual(SMALL_REGULAR)

    await page.getByTestId("shipping-address-select").click()
    const option = page.getByTestId("shipping-address-option").first()
    await expect(option).toBeVisible()
    const details = option.getByTestId("shipping-address-radio").locator("xpath=following-sibling::div[1]")
    expect.soft(await font(details.locator(":scope > span").nth(0))).toEqual(BASE_SEMI)
    expect.soft(await font(details.locator(":scope > span").nth(1))).toEqual(SMALL_REGULAR)
    expect.soft(await font(details.locator(":scope > div"))).toEqual(BASE_REGULAR)
    await evidence("01-checkout-address-options")
    await option.click()
    await expect(page.getByTestId("shipping-address-options")).toBeHidden()

    // เขต/อำเภอเป็นช่องว่างล้วน → ErrorMessage ของ checkout (CORE-52)
    await page.getByTestId("shipping-city-input").fill("   ")
    await page.getByTestId("shipping-email-input").fill(customer.email)
    await page.getByTestId("submit-address-button").click()
    const error = page.getByTestId("address-error-message")
    await expect(error).toBeVisible()
    expect.soft(await font(error)).toEqual(SMALL_REGULAR)
  })

  const cartId = await cartReadyForPayment(request, pk, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  await step("ขั้นจัดส่ง: สรุปที่อยู่ 12px/20px/400, ชื่อวิธีจัดส่ง 14px/24px/400", async () => {
    await page.goto(`/${CC}/checkout?step=delivery`)
    const summary = page.getByTestId("shipping-address-summary")
    await expect(summary).toBeVisible()
    expect.soft(await font(summary.locator("../../.."))).toEqual(SMALL_REGULAR)
    const radio = page.getByTestId("delivery-option-radio").first()
    await expect(radio).toBeVisible()
    expect.soft(await font(radio.locator(":scope > span:not([data-slot])").first().locator(":scope > span").nth(1))).toEqual(BASE_REGULAR)
    await evidence("02-checkout-delivery")
  })

  await step("ขั้นชำระเงิน: สรุปวิธีจัดส่ง 12px/20px/400, กรอบตัวเลือกชำระเงิน 12px/20px/400, ชื่อวิธีชำระ 14px/24px/400", async () => {
    await page.goto(`/${CC}/checkout?step=payment`)
    const option = page.getByTestId("payment-option-pp_system_default")
    await expect(option).toBeVisible()
    expect
      .soft(await font(page.getByTestId("delivery-heading").locator("xpath=../following-sibling::div[1]/div[1]")))
      .toEqual(SMALL_REGULAR)
    expect.soft(await font(option.locator(".."))).toEqual(SMALL_REGULAR)
    expect
      .soft(await font(option.locator(":scope > span:not([data-slot])").first().locator(":scope > span").first().locator(":scope > span").nth(1)))
      .toEqual(BASE_REGULAR)
    await evidence("03-checkout-payment")
  })
})
