import type { Locator, Page } from "@playwright/test"

import { createActiveAffiliate } from "./support/affiliate"
import { expect, test } from "./support/fixtures"
import { groupBuyOrder, teamGroup } from "./support/group-buy"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, publishableKey, signInAs } from "./support/medusa"

// SFUI-9e (spec 09 กฎ 22, AC-21): หน้าฟีเจอร์ (group buy, affiliate portal, บัตรกำนัล) เลิกใช้ utility ฟอนต์ของ starter (`text-*-regular/semi`)
// → utility มาตรฐาน ค่าที่ render (font-size/line-height/font-weight) ต้องเท่าที่วัดที่ปลาย develop ก่อนแก้ — spec นี้ผ่านทั้งบน commit ฐานและหลังแก้
// จุดตัวอย่าง: ทุก token ที่ต่างกันในขอบเขต (small-regular, small-semi, base-regular, base-semi, large-semi, xl-semi, 2xl-semi)
// ไม่มีจุดที่เข้ากฎ 22b/22c ในขอบเขตนี้ (ไม่มี token ใน `cn(...)` และไม่มี class อื่นที่ตั้ง font-size/line-height/font-weight ร่วม)
// ทุกจุดที่วัดตรวจด้วยว่าไม่ถูก rule floating label เดิม (`input ~ label`) จับ (กฎ 23c — เป็นของ AC-23)
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-9e" } })
test.describe.configure({ mode: "serial" })

const font = async (locator: Locator) => {
  await expect(locator).toBeVisible()
  return locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return { size: s.fontSize, lineHeight: s.lineHeight, weight: s.fontWeight, floating: el.matches("input ~ label") }
  })
}

const at = (size: string, lineHeight: string, weight: string) => ({ size, lineHeight, weight, floating: false })
const SMALL = at("12px", "20px", "400") // เดิม text-small-regular
const SMALL_SEMI = at("12px", "20px", "600") // เดิม text-small-semi
const BASE = at("14px", "24px", "400") // เดิม text-base-regular
const BASE_SEMI = at("14px", "24px", "600") // เดิม text-base-semi
const LARGE_SEMI = at("16px", "24px", "600") // เดิม text-large-semi
const XL_SEMI = at("24px", "36px", "600") // เดิม text-xl-semi
const XXL_SEMI = at("30px", "48px", "600") // เดิม text-2xl-semi

async function signInNewCustomer(page: Page, baseURL: string, pk: string) {
  await signInAs(page.context(), baseURL, await createCustomer(page.request, pk))
}

test("AC-21: หน้ากลุ่ม /g/<token> คงขนาด/ระยะบรรทัด/น้ำหนักเดิม", async ({ page, request, baseURL, evidence }) => {
  const ctx = await teamGroup(request, 3)
  await signInNewCustomer(page, baseURL!, ctx.pk)
  await page.goto(`/${CC}/g/${ctx.token}`)
  const root = page.getByTestId("group-page")
  // หัวข้อและป้ายชนิดกลุ่มไม่มี testid — หาภายใน container ที่มี testid
  expect(await font(root.locator("header > span"))).toEqual(SMALL)
  expect(await font(root.getByRole("heading", { level: 1 }))).toEqual(XXL_SEMI)
  expect(await font(page.getByTestId("group-discount"))).toEqual(LARGE_SEMI)
  expect(await font(page.getByTestId("group-status"))).toEqual(BASE_SEMI)
  expect(await font(page.getByTestId("group-member-count"))).toEqual(BASE)
  expect(await font(page.getByTestId("group-join").getByRole("heading", { level: 2 }))).toEqual(LARGE_SEMI)
  // label ที่ครอบ select จำนวน (ไม่ตามหลัง <input> จึงไม่ถูก rule floating label จับ — font() ตรวจ)
  expect(await font(page.getByTestId("group-join").locator("label", { has: page.getByTestId("group-quantity") }))).toEqual(SMALL)
  await evidence("01-group-page")
})

test("AC-21: คำสั่งซื้อแบบกลุ่มในหน้า account คงขนาด/ระยะบรรทัด/น้ำหนักเดิม", async ({ page, request, baseURL, evidence }) => {
  const ctx = await groupBuyOrder(request, false)
  await signInAs(page.context(), baseURL!, ctx.customer)
  await page.goto(`/${CC}/account/orders`)
  const section = page.getByTestId("group-orders")
  expect(await font(section.getByRole("heading", { level: 2 }))).toEqual(LARGE_SEMI)
  const card = page.locator(`[data-testid="group-order-card"][data-order-id="${ctx.orderId}"]`)
  expect(await font(card.getByTestId("group-order-campaign"))).toEqual(BASE_SEMI)
  expect(await font(card.getByTestId("group-order-status"))).toEqual(SMALL_SEMI)
  await card.getByTestId("group-leave-button").click()
  expect(await font(card.getByTestId("group-leave-confirm-box").locator("span").first())).toEqual(SMALL)
  await evidence("02-account-group-orders")
})

test("AC-21: affiliate portal (login, earnings) คงขนาด/ระยะบรรทัด/น้ำหนักเดิม", async ({ page, request, evidence }) => {
  const admin = await adminHeaders(request)
  const who = await createActiveAffiliate(request, admin, { prefix: "e2e-sfui9e" })
  await page.goto(`/${CC}/affiliate/login`)
  expect(await font(page.getByTestId("affiliate-login-title"))).toEqual(LARGE_SEMI)
  await page.getByTestId("affiliate-login-email").fill(who.email)
  await page.getByTestId("affiliate-login-password").fill(who.password)
  await page.getByTestId("affiliate-login-submit").click()
  await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate(\\?|$)`))

  await page.goto(`/${CC}/affiliate/earnings`)
  const root = page.getByTestId("affiliate-earnings-page")
  expect(await font(root.getByRole("heading", { level: 1 }))).toEqual(XL_SEMI)
  const pending = page.getByTestId("affiliate-earnings-pending")
  expect(await font(pending.locator("dt"))).toEqual(SMALL)
  expect(await font(pending.locator("dd").first())).toEqual(LARGE_SEMI)
  expect(await font(page.getByTestId("affiliate-earnings-pending-note"))).toEqual(SMALL)
  await evidence("03-affiliate-earnings")
})

test("AC-21: หน้าบัตรกำนัล (ยังไม่มีรายการ) คงขนาด/ระยะบรรทัด/น้ำหนักเดิม", async ({ page, request, baseURL, evidence }) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  await signInNewCustomer(page, baseURL!, pk)
  await page.goto(`/${CC}/account/vouchers`)
  const header = page.getByTestId("account-page-header")
  expect(await font(header.getByRole("heading", { level: 1 }))).toEqual(XXL_SEMI)
  expect(await font(header.locator("p").first())).toEqual(BASE)
  expect(await font(page.getByTestId("vouchers-empty"))).toEqual(BASE)
  await evidence("04-vouchers-empty")
})
