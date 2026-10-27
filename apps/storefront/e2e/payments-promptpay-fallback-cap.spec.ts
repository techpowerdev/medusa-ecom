import { Page, Route } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import { Ctx, paidWhileQrShown } from "./support/promptpay-race"
import { HAS_STRIPE_UI, PROMPTPAY_PROVIDER } from "./support/stripe"
import { expectThai } from "./support/thai-text"

// PAY-6c: spec 06 กฎข้อ 8, AC-17 — ทางสำรองหลัง 409 PAYMENT_ALREADY_COMPLETED (PAY-6b) ต้องมีเพดาน 10 request
// และแสดง promptpay-refunded เมื่อ Medusa คืนเงิน (compensatePaymentIfNeededStep) ระหว่างทางสำรอง
// ใช้ฉาก race เดียวกับ PAY-6b (webhook ไม่มา + guard จริงตอบ 409) แล้ว mock เฉพาะ server action ของ storefront
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-6c" } })

const NEED_UI = "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน"

type ActionHandler = (route: Route, actionId: string) => Promise<void>

/**
 * ดัก server action ของหน้า checkout: นับ/จัดการเฉพาะ action ที่รับ cart id อย่างเดียว (placeOrder / getPromptPayState)
 * หลังจาก storefront ส่ง action สร้าง session ใหม่ (renewPromptPaySession มี provider id ใน body) แล้วเท่านั้น
 * — action ก่อนหน้านั้นคือ poll ระหว่างแสดง QR (getPromptPayState) จดไว้ใน `pollActionIds`
 */
async function routeCartActions(page: Page, ctx: Ctx, afterRenew: ActionHandler) {
  const state = { renewed: false, pollActionIds: new Set<string>() }
  await page.route(
    (url) => url.pathname.includes("/checkout"),
    async (route) => {
      const req = route.request()
      const actionId = req.headers()["next-action"]
      if (req.method() !== "POST" || !actionId) return route.fallback()
      const body = req.postData() ?? ""
      if (body === JSON.stringify([ctx.cartId])) {
        if (state.renewed) return afterRenew(route, actionId)
        state.pollActionIds.add(actionId)
      } else if (body.includes(PROMPTPAY_PROVIDER)) {
        state.renewed = true
      }
      return route.fallback()
    }
  )
  return state
}

test.describe("PromptPay ทางสำรองมีเพดาน + เงินถูกคืน (AC-17)", () => {
  test.skip(!HAS_STRIPE_UI, NEED_UI)

  test("complete cart ล้มทุกครั้ง → ยิงรวม ≤ 10 แล้วแสดง promptpay-order-delayed และหยุดยิง", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(240_000)
    let ctx!: Ctx
    const sent: number[] = []

    await step("Given ลูกค้าชำระแล้วตอน QR ยังแสดง, webhook ไม่มา และ complete cart / poll ล้มทุกครั้ง", async () => {
      ctx = await paidWhileQrShown(page, context, request, baseURL!)
      await routeCartActions(page, ctx, async (route) => {
        sent.push(Date.now())
        await route.abort("failed")
      })
    })

    await step("When QR ครบ 10 นาที → guard ตอบ 409 → ทางสำรองลองซ้ำจนครบเพดาน", async () => {
      await page.clock.fastForward("10:01")
      await expect(page.getByTestId("promptpay-order-delayed")).toBeVisible({ timeout: 90_000 })
    })

    await step("Then ยิงรวม ≤ 10, ข้อความไทยพร้อมลิงก์ /contact, ไม่แสดงรอสร้าง order แล้ว", async () => {
      expect(sent.length).toBeGreaterThanOrEqual(1)
      expect(sent.length).toBeLessThanOrEqual(10)
      await expectThai(page, ["promptpay-order-delayed"])
      await expect(page.getByTestId("promptpay-contact-link")).toHaveAttribute("href", /\/contact$/)
      await expect(page.getByTestId("promptpay-awaiting-order")).toHaveCount(0)
      await evidence("01-promptpay-order-delayed")
    })

    await step("And ไม่มี request complete/poll เพิ่มใน 30 วินาทีถัดไป", async () => {
      const before = sent.length
      await page.clock.runFor("00:30")
      await page.waitForTimeout(1_000)
      expect(sent.length).toBe(before)
      await expect(page.getByTestId("promptpay-order-delayed")).toBeVisible()
    })
  })

  test("เงินถูกคืนระหว่างทางสำรอง → แสดง promptpay-refunded และปุ่มเริ่มชำระใหม่", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(240_000)
    let ctx!: Ctx
    let routed!: Awaited<ReturnType<typeof routeCartActions>>
    let refundedResponses = 0

    await step("Given ลูกค้าชำระแล้วตอน QR ยังแสดง, webhook ไม่มา", async () => {
      ctx = await paidWhileQrShown(page, context, request, baseURL!)
      // mock: complete cart ล้ม (abort) และ poll ได้สถานะ "refunded" — แทนผลของ compensatePaymentIfNeededStep
      // (Store API: payment_collection.refunded_amount ครอบ captured_amount ตรวจด้วย unit test ของ promptPayPollState)
      routed = await routeCartActions(page, ctx, async (route, actionId) => {
        if (!routed.pollActionIds.has(actionId)) return route.abort("failed")
        const res = await route.fetch()
        const text = (await res.text()).replaceAll('"pending"', '"refunded"')
        const headers = { ...res.headers() }
        delete headers["content-length"]
        refundedResponses++
        await route.fulfill({ status: res.status(), headers, body: text })
      })
      // รู้ id ของ action poll จากรอบ poll ระหว่างแสดง QR (ทุก 3 วินาที)
      await expect.poll(() => routed.pollActionIds.size, { timeout: 30_000 }).toBeGreaterThan(0)
    })

    await step("When QR ครบ 10 นาที → guard ตอบ 409 → complete ล้ม → poll เห็นว่าคืนเงินแล้ว", async () => {
      await page.clock.fastForward("10:01")
      await expect(page.getByTestId("promptpay-refunded")).toBeVisible({ timeout: 60_000 })
    })

    await step("Then แสดงข้อความไทยว่าเงินจะคืน + ปุ่มเริ่มชำระใหม่ ไม่แสดงรอสร้าง order/หมดอายุ", async () => {
      expect(refundedResponses).toBeGreaterThanOrEqual(1)
      await expectThai(page, ["promptpay-refunded", "promptpay-retry-button"])
      await expect(page.getByTestId("promptpay-retry-button")).toBeEnabled()
      await expect(page.getByTestId("promptpay-awaiting-order")).toHaveCount(0)
      await expect(page.getByTestId("promptpay-order-delayed")).toHaveCount(0)
      await expect(page.getByTestId("promptpay-expired")).toHaveCount(0)
      await evidence("02-promptpay-refunded")
    })
  })
})
