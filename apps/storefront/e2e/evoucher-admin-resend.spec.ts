import { APIRequestContext } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { call, createVoucher, placeCapturedOrder, waitDelivered } from "./support/evoucher"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders, createCustomer, publishableKey } from "./support/medusa"

// EV-5b (spec 02 AC-19): ปุ่ม resend (data-testid="evoucher-resend") บน order widget ของ EV-6
// order voucher qty 2 วางผ่าน store API ด้วย token ของลูกค้า → admin capture → EV-4 ส่งมอบ 2 code
// admin UI เป็นภาษาอังกฤษ (CLAUDE.md) — หา element ด้วย data-testid
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "evoucher", taskId: "EV-5b" } })

const countDeliveredEmails = async (request: APIRequestContext, admin: Headers, to: string) => {
  const { notifications } = await call(
    request,
    admin,
    `/admin/notifications?channel=email&to=${encodeURIComponent(to)}&limit=50`
  )
  return notifications.filter((n: { template: string }) => n.template === "evoucher.delivered").length
}

test("AC-19: กด Resend email บน widget E-vouchers ของ order → ข้อความสำเร็จและ notification ใหม่ 1 รายการ", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold) + รอ subscriber ส่งมอบ
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const { variantId } = await createVoucher(request, admin)
  const orderId = await placeCapturedOrder(request, admin, pk, customer, variantId)

  // EV-4 ส่งมอบแบบ async (subscriber payment.captured)
  await expect
    .poll(
      async () =>
        (await call(request, admin, `/admin/evoucher/orders/${orderId}/codes`)).codes.map(
          (c: { status: string }) => c.status
        ),
      { timeout: 30_000 }
    )
    .toEqual(["delivered", "delivered"])
  expect(await countDeliveredEmails(request, admin, customer.email)).toBe(1)

  const resendPath = `/admin/evoucher/orders/${orderId}/resend`
  const posts: string[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === resendPath) posts.push(req.url())
  })

  await step("ล็อกอิน admin แล้วเปิดหน้า order", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/orders/${orderId}`)
    await expect(page.getByTestId("evoucher-resend")).toBeVisible({ timeout: 30_000 })
  })

  await step("dblclick Resend email → POST 1 ครั้ง, toast สำเร็จ และ notification ใหม่ 1 รายการ", async () => {
    await page.getByTestId("evoucher-resend").dblclick()
    await expect(page.getByText("E-voucher email resent with 2 codes")).toBeVisible()
    await evidence("01-resend-success")
    expect(posts).toHaveLength(1)
    await expect.poll(() => countDeliveredEmails(request, admin, customer.email)).toBe(2)
  })
})

// EV-13 (spec 02 AC-32): widget ไม่ล้นที่ 1280×800 และ toast error ของ resend ไม่แสดง id `noti_…`
test.describe("EV-13", () => {
  test.use({ viewport: { width: 1280, height: 800 }, evidenceTarget: { feature: "evoucher", taskId: "EV-13" } })

  test("AC-32: widget E-vouchers 3 code ไม่ล้นที่ 1280px และ toast error ไม่มี noti_ id", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const customer = await createCustomer(request, pk)
    const { variantId } = await createVoucher(request, admin, 3)
    const orderId = await placeCapturedOrder(request, admin, pk, customer, variantId, 3)
    await waitDelivered(request, admin, orderId, 3)

    await step("เปิดหน้า order ที่ 1280×800 → widget และหน้าไม่ล้นแนวนอน", async () => {
      await loginAdmin(page)
      await page.goto(`${BACKEND_URL}/app/orders/${orderId}`)
      const widget = page.getByTestId("evoucher-order-widget")
      await expect(widget.locator("tbody tr")).toHaveCount(3, { timeout: 30_000 })
      const widgetSize = await widget.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
      expect(widgetSize.scroll, JSON.stringify(widgetSize)).toBeLessThanOrEqual(widgetSize.client)
      const pageSize = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
      expect(pageSize.scroll, JSON.stringify(pageSize)).toBeLessThanOrEqual(pageSize.client)
    })

    await step("resend ล้ม (error ของ Notification module ที่มี noti_ id) → toast สั้น ไม่มี id", async () => {
      // e2e ทำให้ provider ของ server จริง throw ไม่ได้ จึงตอบ 500 แทนด้วยข้อความรูปแบบเดิมของ Notification module;
      // ฝั่ง backend (ตัด id ออก + log) ทดสอบใน integration-tests/http/evoucher-resend.spec.ts
      await page.route(`**/admin/evoucher/orders/${orderId}/resend`, (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            type: "unexpected_state",
            message: "Could not send the e-voucher email: Failed to send notification with id noti_01E2EFAKE0013: smtp down",
          }),
        })
      )
      await page.getByTestId("evoucher-resend").click()
      const toast = page.locator("[data-sonner-toast]").filter({ hasText: "smtp down" })
      await expect(toast).toBeVisible()
      await expect(toast).not.toContainText(/noti_[A-Za-z0-9]+/)
      await expect(toast).toContainText(/try again/i)
      // รอ toast เลื่อนเข้าจอจนสุดก่อนเก็บ screenshot
      await expect.poll(async () => (await toast.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0)
      await evidence("01-widget-and-error-toast")
    })
  })
})
