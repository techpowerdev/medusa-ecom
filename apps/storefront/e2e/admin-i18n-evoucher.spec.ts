import { APIRequestContext, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, ADMIN_UI_OPTIONS_TH, adminText, loginAdmin } from "./support/admin"
import { call, createVoucher, placeCapturedOrder, waitDelivered } from "./support/evoucher"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders, createCustomer, publishableKey } from "./support/medusa"
import { THAI } from "./support/thai-text"

// spec 10 AC-10 (AI18N-3, กฎ 7, 9, 13): หน้า e-voucher + widget variant/order แสดงตามภาษาที่เลือกผ่านกลไกของ Medusa (`lng`)
// ค่าที่คาดสร้างจาก `json/<lng>/ecom-evoucher.json` (ไม่ hard-code ประโยคไทย) — `lng=en` ของ element เดียวกันต้องไม่มีอักษรไทย
// heading ของ DataTable/ลิงก์เมนู/breadcrumb/เมนูของ filter เป็นของ Medusa ที่ใส่ testid ไม่ได้ → หาด้วย role + ชื่อภายใน container
// ที่แคบที่สุด (ข้อยกเว้น — ADR-018); ส่วนอื่นใช้ testid เดิม

type Lng = "en" | "th"
const text = (lng: Lng, key: string) => adminText(lng, "ecom-evoucher", key)

type Fixture = { poolId: string; productId: string; variantId: string; orderId: string }

/** voucher 3 code → order 1 code (ส่งมอบแล้ว) — pool เหลือ available 2, order มี code delivered 1 (pp_system_default ไม่ใช้ Stripe) */
async function seed(request: APIRequestContext): Promise<{ admin: Headers; data: Fixture }> {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const voucher = await createVoucher(request, admin, 3)
  const orderId = await placeCapturedOrder(request, admin, pk, customer, voucher.variantId, 1)
  await waitDelivered(request, admin, orderId, 1)
  const { products } = await call(request, admin, `/admin/products?handle=${voucher.handle}&fields=id`)
  return { admin, data: { poolId: voucher.poolId, productId: products[0].id, variantId: voucher.variantId, orderId } }
}

/** ข้อความที่แสดงของ element ทั้งหมด (ตรวจอักษรไทย) */
const shown = async (...locators: ReturnType<Page["locator"]>[]) =>
  (await Promise.all(locators.map((l) => l.innerText()))).join(" ")

async function expectLanguage(lng: Lng, values: string) {
  if (lng === "th") expect(values).toMatch(THAI)
  else expect(values).not.toMatch(THAI)
}

async function checkPages(page: Page, lng: Lng, data: Fixture, step: (title: string, body: () => Promise<void>) => Promise<void>, evidence?: (name: string) => Promise<void>) {
  await loginAdmin(page)

  await step("/evouchers: ลิงก์เมนูด้านข้าง + heading ของตาราง pools/Partners", async () => {
    await page.goto(`${BACKEND_URL}/app/evouchers`)
    const nav = page.getByRole("complementary").getByRole("link", { name: text(lng, "nav.evouchers"), exact: true })
    const pools = page.getByRole("heading", { name: text(lng, "pools.heading"), exact: true })
    const partners = page.getByTestId("evoucher-partners-table").getByRole("heading", { name: text(lng, "partners.heading"), exact: true })
    await expect(nav).toBeVisible()
    await expect(pools).toBeVisible()
    await expect(partners).toBeVisible()
    await expectLanguage(lng, await shown(nav, pools, partners))
    await evidence?.("01-evouchers-th")
  })

  await step("หน้า pool: breadcrumb แรก, heading Codes, label filter สถานะ และป้ายสถานะ available", async () => {
    await page.goto(`${BACKEND_URL}/app/evouchers/pools/${data.poolId}`)
    const crumb = page.locator("ol").first().locator("li").first()
    await expect(crumb).toHaveText(text(lng, "nav.evouchers"))
    const codes = page.getByTestId("evoucher-codes")
    const heading = codes.getByRole("heading", { name: text(lng, "codes.heading"), exact: true })
    await expect(heading).toBeVisible()
    const available = codes.locator("tbody").getByText(text(lng, "codeStatus.available"), { exact: true })
    await expect(available.first()).toBeVisible()
    // อ่านก่อนเปิดเมนู filter — ระหว่างเมนูเปิด Radix ซ่อนส่วนอื่นจาก accessibility tree (getByRole หา heading ไม่เจอ)
    const page1 = await shown(crumb, heading, available.first())
    // ปุ่ม filter (Funnel) = trigger ของ dropdown ตัวแรกใน toolbar ของตาราง (แบบ evoucher-admin-pool-page.spec.ts)
    await codes.locator('button[aria-haspopup="menu"]').first().click()
    const filter = page.getByRole("menuitem", { name: text(lng, "fields.status"), exact: true })
    await expect(filter).toBeVisible()
    await expectLanguage(lng, `${page1} ${await shown(filter)}`)
    await evidence?.("02-pool-th")
    await page.keyboard.press("Escape")
  })

  await step("widget variant-evoucher-pool บนหน้า variant", async () => {
    await page.goto(`${BACKEND_URL}/app/products/${data.productId}/variants/${data.variantId}`)
    const title = page.getByRole("heading", { name: text(lng, "variantWidget.title"), exact: true })
    await expect(title).toBeVisible()
    const available = page.getByText(text(lng, "variantWidget.availableCodes"), { exact: true })
    await expect(available).toBeVisible()
    await expectLanguage(lng, await shown(title, available))
    await evidence?.("03-variant-widget-th")
  })

  await step("widget order-evouchers บนหน้า order ที่มี code", async () => {
    await page.goto(`${BACKEND_URL}/app/orders/${data.orderId}`)
    const widget = page.getByTestId("evoucher-order-widget")
    const heading = widget.getByRole("heading", { name: text(lng, "nav.evouchers"), exact: true })
    const codeHeader = widget.getByRole("columnheader", { name: text(lng, "fields.code"), exact: true })
    const delivered = widget.locator("tbody").getByText(text(lng, "codeStatus.delivered"), { exact: true })
    await expect(heading).toBeVisible()
    await expect(codeHeader).toBeVisible()
    await expect(delivered).toBeVisible()
    await expectLanguage(lng, await shown(heading, codeHeader, delivered))
    await evidence?.("04-order-widget-th")
  })
}

test.describe("lng=th", () => {
  test.use({ ...ADMIN_UI_OPTIONS_TH, evidenceTarget: { feature: "admin-i18n", taskId: "AI18N-3" } })

  test("AC-10: เมนู/breadcrumb/ตาราง e-voucher, หน้า pool และ widget variant/order เป็นค่า th", async ({ page, request, step, evidence }) => {
    test.setTimeout(180_000)
    const { data } = await seed(request)
    await checkPages(page, "th", data, step, evidence)
  })
})

test.describe("lng=en", () => {
  test.use({ ...ADMIN_UI_OPTIONS })

  test("AC-10: element เดียวกันเป็นค่า en (ข้อความเดิม) ไม่มีอักษรไทย", async ({ page, request, step }) => {
    test.setTimeout(180_000)
    expect([text("en", "nav.evouchers"), text("en", "codes.heading"), text("en", "codeStatus.available")]).toEqual([
      "E-vouchers",
      "Codes",
      "available",
    ])
    const { data } = await seed(request)
    await checkPages(page, "en", data, step)
  })
})
