import type { Locator } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"

// SFUI-9d (spec 09 กฎ 22, AC-21): หน้า account + order หลังแทน utility ขนาดฟอนต์ของ starter ด้วย utility มาตรฐานของ Tailwind
// ค่าที่คาด = ค่าที่ render จริงที่ปลาย develop ก่อนแก้ (spec นี้ต้องผ่านทั้งบน commit ฐานและหลังแก้) — จุดตัวอย่างครบทุกขนาดในขอบเขต:
// 12px/20px/400, 14px/24px/400, 14px/24px/600, 16px/24px/600, 24px/36px/600, 30px/48px/600 และจุดกฎ 22c
// (ตัวเลขความสมบูรณ์ของโปรไฟล์: 32px/44px/600 + leading-none → leading-none ชนะใน CSS ที่ compile = 32px/32px/600)
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-9d" } })

type Font = { size: string; lineHeight: string; weight: string }

const font = (locator: Locator): Promise<Font> =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return { size: s.fontSize, lineHeight: s.lineHeight, weight: s.fontWeight }
  })

const SMALL_REGULAR: Font = { size: "12px", lineHeight: "20px", weight: "400" }
const BASE_REGULAR: Font = { size: "14px", lineHeight: "24px", weight: "400" }
const BASE_SEMI: Font = { size: "14px", lineHeight: "24px", weight: "600" }
const LARGE_SEMI: Font = { size: "16px", lineHeight: "24px", weight: "600" }
const XL_SEMI: Font = { size: "24px", lineHeight: "36px", weight: "600" }
const XXL_SEMI: Font = { size: "32px", lineHeight: "48px", weight: "600" } // SFUI-21b (spec 09 กฎ 77, 78 (i)): h1 ทุกหน้า text-3xl font-semibold tracking-tight = 32px/48px/600 (วัดบน build)
const H1 = XXL_SEMI

test("AC-21: หน้า login/register, ภาพรวมบัญชี, โปรไฟล์, ที่อยู่, รายการ/รายละเอียด order คงขนาดตัวอักษร/ระยะบรรทัด/น้ำหนักเดิม", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)

  await step("login + register (ยังไม่ login): หัวข้อ 16px/24px/600, คำอธิบาย 14px/24px/400, ลิงก์สลับหน้า 12px/20px/400", async () => {
    await page.goto(`/${CC}/account`)
    const login = page.getByTestId("login-page")
    await expect(login).toBeVisible()
    expect.soft(await font(login.locator("h1"))).toEqual(H1)
    expect.soft(await font(login.locator("h1 + p"))).toEqual(BASE_REGULAR)
    expect.soft(await font(page.getByTestId("login-to-register-button").locator(".."))).toEqual(SMALL_REGULAR)

    await page.getByTestId("login-to-register-button").click()
    const register = page.getByTestId("register-page")
    await expect(register).toBeVisible()
    expect.soft(await font(register.locator("h1"))).toEqual(H1)
    expect.soft(await font(register.locator("h1 + p"))).toEqual(BASE_REGULAR)
    expect.soft(await font(page.getByTestId("register-privacy-link").locator(".."))).toEqual(SMALL_REGULAR)
  })

  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const { id } = await placeOrder(request, pk, customer)

  await step("ภาพรวมบัญชี: ทักทาย 24px/36px/600, หัวข้อสถิติ 16px/24px/600, ตัวเลข 32px/32px/600 (กฎ 22c), เมนูบัญชี และส่วนช่วยเหลือ", async () => {
    await page.goto(`/${CC}/account`)
    await expect(page.getByTestId("overview-page-wrapper")).toBeVisible()
    expect.soft(await font(page.getByTestId("welcome-message").locator(".."))).toEqual(XL_SEMI)
    expect.soft(await font(page.getByTestId("customer-email").locator(".."))).toEqual(SMALL_REGULAR)
    const stats = page.getByTestId("overview-stats")
    expect.soft(await font(stats.locator("h3").first())).toEqual(LARGE_SEMI)
    expect.soft(await font(page.getByTestId("customer-profile-completion"))).toEqual({
      size: "32px",
      lineHeight: "32px",
      weight: "600",
    })
    expect.soft(await font(page.getByTestId("addresses-count"))).toEqual({ size: "32px", lineHeight: "32px", weight: "600" })
    expect
      .soft(await font(page.getByTestId("customer-profile-completion").locator("xpath=following-sibling::span[1]")))
      .toEqual(BASE_REGULAR)
    expect.soft(await font(page.getByTestId("overview-orders-view-all"))).toEqual(SMALL_REGULAR)
    expect
      .soft(await font(page.getByTestId("order-wrapper").first().getByTestId("order-id").locator("..")))
      .toEqual(SMALL_REGULAR)

    const nav = page.getByTestId("account-nav")
    expect.soft(await font(nav.locator("h3"))).toEqual(BASE_SEMI)
    expect.soft(await font(nav.locator("h3").locator("xpath=../following-sibling::div[1]"))).toEqual(BASE_REGULAR)
    expect.soft(await font(page.getByTestId("account-help").locator("h3"))).toEqual(XL_SEMI)
    await evidence("01-account-overview")
  })

  await step("โปรไฟล์ + ที่อยู่: หัวหน้า 30px/48px/600, คำอธิบาย 14px/24px/400, อีเมล 12px/20px/400, ปุ่มเพิ่มที่อยู่ 14px/24px/600", async () => {
    await page.goto(`/${CC}/account/profile`)
    const header = page.getByTestId("account-page-header")
    await expect(header).toBeVisible()
    expect.soft(await font(header.locator("h1"))).toEqual(XXL_SEMI)
    expect.soft(await font(header.locator("p"))).toEqual(BASE_REGULAR)
    expect.soft(await font(page.getByTestId("account-email"))).toEqual(SMALL_REGULAR)

    await page.goto(`/${CC}/account/addresses`)
    await expect(header).toBeVisible()
    expect.soft(await font(header.locator("h1"))).toEqual(XXL_SEMI)
    expect.soft(await font(header.locator("p"))).toEqual(BASE_REGULAR)
    expect.soft(await font(page.getByTestId("add-address-button").locator("span").first())).toEqual(BASE_SEMI)
  })

  await step("รายการ order: หัวหน้า 30px/48px/600, เลขที่ order 16px/24px/600, วันที่/ยอด 12px/20px/400", async () => {
    await page.goto(`/${CC}/account/orders`)
    const header = page.getByTestId("account-page-header")
    await expect(header).toBeVisible()
    expect.soft(await font(header.locator("h1"))).toEqual(XXL_SEMI)
    expect.soft(await font(header.locator("p"))).toEqual(BASE_REGULAR)
    const card = page.getByTestId("order-card").first()
    await expect(card).toBeVisible()
    expect.soft(await font(card.getByTestId("order-display-id").locator(".."))).toEqual(LARGE_SEMI)
    expect.soft(await font(card.getByTestId("order-created-at").locator(".."))).toEqual(SMALL_REGULAR)
    await evidence("02-account-orders")
  })

  await step("รายละเอียด order: หัวข้อ 30px/48px/600, สรุปคำสั่งซื้อ 14px/24px/600 + 12px/20px/400 + 14px/24px/400, ช่วยเหลือ 14px/24px/400", async () => {
    await page.goto(`/${CC}/account/orders/details/${id}`)
    await expect(page.getByTestId("order-details-container")).toBeVisible()
    expect.soft(await font(page.getByTestId("order-details-heading"))).toEqual(XXL_SEMI)
    const summary = page.getByTestId("order-summary")
    expect.soft(await font(summary.locator("h2"))).toEqual(BASE_SEMI)
    expect.soft(await font(summary.locator("h2 + div"))).toEqual(SMALL_REGULAR)
    expect.soft(await font(summary.locator("h2 + div > div").first())).toEqual(BASE_REGULAR)
    expect.soft(await font(summary.locator("h2 + div > div").last())).toEqual(BASE_REGULAR)
    expect.soft(await font(page.getByTestId("order-help").locator("h2 + div"))).toEqual(BASE_REGULAR)
    await evidence("03-account-order-details")
  })
})
