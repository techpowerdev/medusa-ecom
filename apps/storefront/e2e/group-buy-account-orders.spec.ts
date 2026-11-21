import { APIRequestContext, BrowserContext, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { GroupBuyOrderCtx, groupBuyOrder, setStock, stockedProduct } from "./support/group-buy"
import { adminHeaders, signInAs, STOREFRONT_COUNTRY as CC } from "./support/medusa"
import { CARD_PROVIDER, HAS_STRIPE_UI, PROMPTPAY_PROVIDER, authorizePromptPay, fillCard } from "./support/stripe"
import { expectThai } from "./support/thai-text"

// GB-7b (spec 04 Storefront, AC-16 ส่วน account + พร้อมเพย์, AC-2): รายการ draft order ของกลุ่มในหน้า account อ่านจาก GB-8
// และลิงก์ไปหน้าชำระเงินของ PAY-3b (`/account/orders/:id/pay`) — ไม่สร้างหน้าชำระเงินซ้ำ
test.use({ evidenceTarget: { feature: "group-buying", taskId: "GB-7b" } })

const NEED_UI = "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน"
const ordersPath = `/${CC}/account/orders`

const card = (page: Page, ctx: GroupBuyOrderCtx) => page.locator(`[data-testid="group-order-card"][data-order-id="${ctx.orderId}"]`)

async function openOrders(page: Page, context: BrowserContext, baseURL: string, ctx: GroupBuyOrderCtx) {
  await signInAs(context, baseURL, ctx.customer)
  await page.goto(ordersPath)
  await expect(page.getByTestId("group-orders")).toBeVisible()
}

const storeHeaders = (ctx: GroupBuyOrderCtx) => ({ authorization: `Bearer ${ctx.customer.token}`, "x-publishable-api-key": ctx.pk })

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- response ของ GB-8
async function membershipOf(request: APIRequestContext, ctx: GroupBuyOrderCtx): Promise<any> {
  const res = await request.get(`${BACKEND_URL}/store/customers/me/group-buy/memberships`, { headers: storeHeaders(ctx) })
  expect(res.status()).toBe(200)
  return (await res.json()).memberships.find((m: { id: string }) => m.id === ctx.membershipId)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- response ของ GB-8
async function gb8(request: APIRequestContext, ctx: GroupBuyOrderCtx): Promise<any> {
  const res = await request.get(`${BACKEND_URL}/store/customers/me/group-buy/orders/${ctx.orderId}`, { headers: storeHeaders(ctx) })
  expect(res.status()).toBe(200)
  return res.json()
}

test.describe("หน้า account: คำสั่งซื้อแบบกลุ่ม (AC-16)", () => {
  test("joined → รอกลุ่ม + ออกจากกลุ่ม (ยืนยันก่อน) → ยกเลิก และ membership cancelled", async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    const ctx = await groupBuyOrder(request, false)
    await openOrders(page, context, baseURL!, ctx)
    const row = card(page, ctx)
    await expect(row.getByTestId("group-order-status")).toHaveAttribute("data-status", "waiting")
    await expect(row.getByTestId("group-order-pay-link")).toHaveCount(0)
    await expectThai(page, ["group-order-status"])
    await evidence("01-account-group-waiting")

    await row.getByTestId("group-leave-button").click()
    await expect(row.getByTestId("group-leave-confirm-box")).toBeVisible()
    await expectThai(page, ["group-leave-confirm-box"])
    // ยกเลิกการยืนยัน → ไม่ส่ง request
    await row.getByTestId("group-leave-cancel").click()
    expect((await membershipOf(request, ctx)).status).toBe("joined")

    await row.getByTestId("group-leave-button").click()
    await row.getByTestId("group-leave-confirm").dblclick()
    await expect(row.getByTestId("group-order-status")).toHaveAttribute("data-status", "cancelled", { timeout: 15_000 })
    await expect(row.getByTestId("group-leave-button")).toHaveCount(0)
    await expect(page.getByTestId("group-leave-error")).toHaveCount(0)
    expect((await membershipOf(request, ctx)).status).toBe("cancelled")
  })

  test("กลุ่มสำเร็จระหว่างเปิดหน้าอยู่ แล้วกดออก → error ไทย และรายการแสดงสถานะใหม่ (ชำระเงินภายใน)", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    const ctx = await groupBuyOrder(request, false)
    await openOrders(page, context, baseURL!, ctx)
    const row = card(page, ctx)
    await row.getByTestId("group-leave-button").click()
    const res = await request.post(`${BACKEND_URL}/admin/group-buy/groups/${ctx.groupId}/succeed`, { headers: ctx.admin })
    expect(res.status()).toBe(200)

    await row.getByTestId("group-leave-confirm").click()
    // review #223: รอ router.refresh() เสร็จ (แถวเปลี่ยนเป็นชำระเงินภายใน → canLeave = false) ก่อนตรวจ error
    // error ต้องยังอยู่หลัง refresh — ไม่ใช่โผล่ชั่วครู่แล้วหายเพราะปุ่มถูกถอด
    await expect(row.getByTestId("group-pay-deadline")).toBeVisible({ timeout: 15_000 })
    await expect(row.getByTestId("group-leave-button")).toHaveCount(0)
    await expect(row.getByTestId("group-leave-error")).toBeVisible()
    await expectThai(page, ["group-leave-error"])
    expect((await membershipOf(request, ctx)).status).toBe("awaiting_payment")
  })

  test("awaiting_payment → ชำระเงินภายใน <deadline> และลิงก์ไปหน้าชำระเงินของ PAY-3b", async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    const ctx = await groupBuyOrder(request, true)
    await openOrders(page, context, baseURL!, ctx)
    const row = card(page, ctx)
    await expect(row.getByTestId("group-pay-deadline")).toBeVisible()
    await expectThai(page, ["group-pay-deadline"])
    await expect(row.getByTestId("group-leave-button")).toHaveCount(0)
    await evidence("02-account-group-pay-deadline")

    await row.getByTestId("group-order-pay-link").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/account/orders/${ctx.orderId}/pay$`))
    await expect(page.getByTestId("order-pay-form")).toBeVisible()
  })
})

// GB-22 (spec 04 กฎข้อ 45b, AC-64d): จ่ายแล้วแต่แปลง draft order ไม่สำเร็จ (สต็อกหมดตอน convert — convert_failed ของกฎข้อ 25)
// → membership ยัง awaiting_payment + payment_status captured → "กำลังยืนยัน" ไม่มีปุ่มชำระ
test.describe("หน้า account: จ่ายแล้วแต่ยังเป็น draft (GB-22)", () => {
  test.use({ evidenceTarget: { feature: "group-buying", taskId: "GB-22" } })

  test("awaiting_payment + captured → group-order-processing ไม่มีลิงก์ชำระ", async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const product = await stockedProduct(request, admin, 1)
    const ctx = await groupBuyOrder(request, true, product.handle)
    await setStock(request, admin, product, 0)
    const collectionId = (await gb8(request, ctx)).order.payment_collections[0].id
    const paid = await request.post(`${BACKEND_URL}/admin/payment-collections/${collectionId}/mark-as-paid`, {
      headers: admin,
      data: { order_id: ctx.orderId },
    })
    expect(paid.status(), await paid.text()).toBe(200)
    // subscriber ของ GB-5 แปลง order ล้ม (สต็อก 0) → compensation คืน awaiting_payment; รอให้สถานะนิ่ง 2 รอบติดกัน
    let stable = 0
    await expect
      .poll(
        async () => {
          const m = await membershipOf(request, ctx)
          stable = m.status === "awaiting_payment" && m.order.payment_status === "captured" ? stable + 1 : 0
          return stable
        },
        { timeout: 30_000, intervals: [1_000] }
      )
      .toBeGreaterThanOrEqual(3)

    await openOrders(page, context, baseURL!, ctx)
    const row = card(page, ctx)
    await expect(row.getByTestId("group-order-processing")).toBeVisible()
    await expect(row.getByTestId("group-order-pay-link")).toHaveCount(0)
    await expect(row.getByTestId("group-pay-deadline")).toHaveCount(0)
    await expectThai(page, ["group-order-processing"])
    await evidence("01-account-group-processing")

    // session หลักตัดสิน 2026-11-21 (qa #444): หน้า pay ของ order เดียวกันต้องบอกข้อความเดียวกัน ไม่ใช่ "ชำระเงินเรียบร้อยแล้ว"
    const label = (await row.getByTestId("group-order-processing").textContent())!.trim()
    await page.goto(`/${CC}/account/orders/${ctx.orderId}/pay`)
    await expect(page.getByTestId("order-pay-processing")).toHaveText(label)
    await expect(page.getByTestId("order-pay-paid")).toHaveCount(0)
    await expect(page.getByTestId("order-pay-form")).toHaveCount(0)
  })
})

test.describe("หน้า account → หน้าชำระเงิน — Stripe test mode (AC-2, AC-16 พร้อมเพย์)", () => {
  test.skip(!HAS_STRIPE_UI, NEED_UI)

  test("AC-2: บัตร 4242 จากลิงก์ในหน้า account → order ปกติ captured, membership paid และรายการแสดงชำระแล้ว", async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    test.setTimeout(180_000)
    const ctx = await groupBuyOrder(request, true)
    await openOrders(page, context, baseURL!, ctx)
    await card(page, ctx).getByTestId("group-order-pay-link").click()
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    await fillCard(page, "4242424242424242")
    await page.getByTestId("order-pay-card-button").click()
    await expect(page.getByTestId("order-pay-paid")).toBeVisible({ timeout: 60_000 })

    // subscriber ของ GB-5 แปลง draft order หลัง capture (async)
    await expect
      .poll(async () => (await membershipOf(request, ctx)).status, { timeout: 60_000, intervals: [1_000] })
      .toBe("paid")
    const { order } = await gb8(request, ctx)
    expect(order.is_draft_order).toBe(false)
    expect(order.payment_status).toBe("captured")

    await page.goto(ordersPath)
    const row = card(page, ctx)
    await expect(row.getByTestId("group-order-status")).toHaveAttribute("data-status", "paid")
    await expect(row.getByTestId("group-order-details-link")).toBeVisible()
    await expectThai(page, ["group-order-status"])
    await evidence("03-account-group-paid")
  })

  test("AC-16: พร้อมเพย์จากลิงก์ในหน้า account → QR → authorize test payment → order-pay-paid", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    test.setTimeout(180_000)
    const ctx = await groupBuyOrder(request, true)
    await openOrders(page, context, baseURL!, ctx)
    await card(page, ctx).getByTestId("group-order-pay-link").click()
    await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()
    await page.getByTestId("order-pay-promptpay-button").click()
    await expect(page.getByTestId("promptpay-qr")).toBeVisible({ timeout: 30_000 })

    const session = (await gb8(request, ctx)).order.payment_collections[0].payment_sessions.find(
      (s: { provider_id: string; status: string }) => s.provider_id === PROMPTPAY_PROVIDER && s.status === "pending"
    )
    await authorizePromptPay(context, request, session.data.id)
    await expect(page.getByTestId("order-pay-paid")).toBeVisible({ timeout: 60_000 })
  })
})
