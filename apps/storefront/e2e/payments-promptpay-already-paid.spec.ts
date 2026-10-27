import { APIRequestContext, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Ctx, paidWhileQrShown } from "./support/promptpay-race"
import { HAS_STRIPE_UI, cartPaymentState } from "./support/stripe"

// PAY-6b: spec 06 AC-12 + AC-12b (ส่วน storefront), กฎข้อ 7A — QR หมดอายุแต่ลูกค้าชำระไปแล้ว (race)
// - browser อ่านสถานะ PI ได้ค่าเก่า (mock เฉพาะ response ของ Stripe.js ให้เป็น requires_action) → storefront สร้าง session ใหม่
//   → guard จริงของ backend ตอบ 409 PAYMENT_ALREADY_COMPLETED (guard อ่าน PI ผ่าน `data.id` ของ session)
// - webhook "ไม่มา" แน่นอน: ลบ `metadata.session_id` ของ PI ก่อนชำระ → Stripe provider 2.22.1 คืน NOT_SUPPORTED และ subscriber
//   ของ Medusa ข้าม event (ไม่มี session_id) → order ที่ได้จึงมาจาก `POST /store/carts/:id/complete` ของ storefront เท่านั้น
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-6b" } })

const NEED_UI = "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน"

/** order captured เดียวที่อ้าง PI เดิม และ session เดิมไม่ถูกแทน */
async function expectSingleCapturedOrder(page: Page, request: APIRequestContext, ctx: Ctx) {
  const orderId = page.url().match(/\/order\/([^/]+)\/confirmed/)![1]
  const res = await request.get(
    `${BACKEND_URL}/admin/orders/${orderId}?fields=id,payment_status,*payment_collections.payments`,
    { headers: ctx.admin }
  )
  const { order } = await res.json()
  expect(order.payment_status).toBe("captured")
  const intents = order.payment_collections.flatMap((c: { payments: { data: { id: string } }[] }) =>
    c.payments.map((p) => p.data.id)
  )
  expect(intents).toEqual([ctx.intentId])
  const state = await cartPaymentState(request, ctx.pk, ctx.customer, ctx.cartId)
  expect(state.completed_at).not.toBeNull()
  expect(state.sessions.map((s) => s.data.id)).toEqual([ctx.intentId])
}

test.describe("PromptPay ชำระแล้วตอน QR หมดอายุ (AC-12, AC-12b)", () => {
  test.skip(!HAS_STRIPE_UI, NEED_UI)

  test("409 → รอสร้าง order → complete cart ทางสำรอง (webhook ไม่มา) → หน้า order confirmed", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(180_000)
    let ctx!: Ctx

    await step("Given QR แสดงอยู่, webhook ไม่มา, ลูกค้าชำระสำเร็จแต่ browser เห็น requires_action", async () => {
      ctx = await paidWhileQrShown(page, context, request, baseURL!)
    })

    await step("When QR ครบ 10 นาที → guard ตอบ 409 PAYMENT_ALREADY_COMPLETED", async () => {
      await page.clock.fastForward("10:01")
    })

    await step("Then storefront complete cart เอง → หน้า order confirmed, order เดียว captured, ไม่เคยแสดงหมดอายุ", async () => {
      await expect(page.getByTestId("order-complete-container")).toBeVisible({ timeout: 60_000 })
      // promptpay-awaiting-order แสดงแค่ช่วง complete cart (~300ms ใน CI run 40368956907) — ห้าม assert ด้วย toBeVisible
      // ที่ poll เป็นช่วงจนอาจพลาด ใช้ MutationObserver (trackTestIds) ที่บันทึกทุกครั้งที่ element ปรากฏแทน
      await expect
        .poll(() => Array.from(ctx.seen), { message: "AC-12: แสดงรอสร้าง order และไม่แสดงหมดอายุ", timeout: 5_000 })
        .toEqual(["promptpay-awaiting-order"])
      await expectSingleCapturedOrder(page, request, ctx)
      await evidence("01-promptpay-already-paid-order-confirmed")
    })
  })

  test("complete cart ล้ม → ยังรอสร้าง order และ poll ต่อ → ลองใหม่สำเร็จ", async ({ page, context, request, baseURL, step }) => {
    test.setTimeout(180_000)
    let ctx!: Ctx
    let blocked = 0

    await step("Given QR แสดงอยู่, webhook ไม่มา, ลูกค้าชำระสำเร็จแต่ browser เห็น requires_action", async () => {
      ctx = await paidWhileQrShown(page, context, request, baseURL!)
    })

    await step("When complete cart (และ poll) ล้มด้วย network error หลังได้ 409", async () => {
      // server action ที่รับ cart id อย่างเดียว (placeOrder / getPromptPayState) ล้ม — การสร้าง session ใหม่ (409) ผ่านตามปกติ
      await page.route(
        (url) => url.pathname.includes("/checkout"),
        async (route) => {
          const req = route.request()
          if (req.method() === "POST" && req.headers()["next-action"] && req.postData() === JSON.stringify([ctx.cartId])) {
            blocked++
            return route.abort("failed")
          }
          return route.fallback()
        }
      )
      await page.clock.fastForward("10:01")
      const awaiting = page.getByTestId("promptpay-awaiting-order")
      await expect(awaiting).toBeVisible({ timeout: 30_000 })
      await expect(awaiting.getByTestId("promptpay-payment-error-message")).toBeVisible({ timeout: 30_000 })
    })

    await step("Then ยังแสดงรอสร้าง order (ไม่แสดงหมดอายุ) และ poll ต่อ", async () => {
      const afterError = blocked
      await expect.poll(() => blocked, { timeout: 30_000 }).toBeGreaterThanOrEqual(afterError + 2)
      await expect(page.getByTestId("promptpay-awaiting-order")).toBeVisible()
      expect(Array.from(ctx.seen)).toEqual(["promptpay-awaiting-order"])
    })

    await step("เมื่อ complete ได้อีกครั้ง → poll รอบถัดไปลอง complete ใหม่ → หน้า order confirmed", async () => {
      await page.unrouteAll({ behavior: "ignoreErrors" })
      await expect(page.getByTestId("order-complete-container")).toBeVisible({ timeout: 60_000 })
      expect(Array.from(ctx.seen)).toEqual(["promptpay-awaiting-order"])
      await expectSingleCapturedOrder(page, request, ctx)
    })
  })
})
