import { Page, Route } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import { Ctx, paidWhileQrShown } from "./support/promptpay-race"
import { isCartIdActionBody } from "./support/server-action"
import { HAS_STRIPE_UI, PROMPTPAY_PROVIDER } from "./support/stripe"
import { expectThai } from "./support/thai-text"

// PAY-11 (spec 06 กฎข้อ 13, AC-24): ทางสำรอง PromptPay (`finish` → placeOrder) ได้ผลล้มที่รู้เหตุ → หยุด poll แล้วแสดง
// `promptpay-refunded` บอกเหตุคืนเงิน (กฎข้อ 27 spec 03) แทนการค้าง "กำลังสร้างคำสั่งซื้อ"; 409 CART_COMPLETION_IN_PROGRESS → poll ต่อ
// ฉาก race เดียวกับ PAY-6b/6c (QR หมดอายุหลังชำระ + webhook ไม่มา → guard จริงตอบ 409 PAYMENT_ALREADY_COMPLETED → ทางสำรอง)
// route mock: placeOrder เป็น server action (complete ฝั่ง server) → แทน request นั้นด้วย action poll (`getPromptPayState`) ของ cart
// เดียวกันซึ่งไม่มีผลข้างเคียง แล้วแทนค่าที่คืน `"pending"` ด้วยผลของ placeOrder — ไม่ต้องรู้รูปแบบ flight ของ Next
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-11" } })

const NEED_UI = "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน"

type Mocked = { placeOrders: number[]; polls: number[] }

/**
 * หลัง storefront สร้าง session ใหม่ (renewPromptPaySession — มี provider id ใน body) action ที่รับ cart id อย่างเดียว:
 * id ที่เห็นตอน QR แสดง = poll (ผ่านจริง นับไว้), id อื่น = placeOrder → ตอบเป็น `outcome`
 */
async function mockPlaceOrder(page: Page, ctx: Ctx, outcome: object): Promise<Mocked> {
  const state = { renewed: false, pollActionIds: new Set<string>() }
  const mocked: Mocked = { placeOrders: [], polls: [] }
  await page.route(
    (url) => url.pathname.includes("/checkout"),
    async (route: Route) => {
      const req = route.request()
      const actionId = req.headers()["next-action"]
      if (req.method() !== "POST" || !actionId) return route.fallback()
      const body = req.postData() ?? ""
      if (!isCartIdActionBody(body, ctx.cartId)) {
        if (body.includes(PROMPTPAY_PROVIDER)) state.renewed = true
        return route.fallback()
      }
      if (!state.renewed) {
        state.pollActionIds.add(actionId)
        return route.fallback()
      }
      if (state.pollActionIds.has(actionId)) {
        mocked.polls.push(Date.now())
        return route.fallback()
      }
      mocked.placeOrders.push(Date.now())
      const pollId = Array.from(state.pollActionIds)[0]
      const res = await route.fetch({
        headers: { ...req.headers(), "next-action": pollId },
        postData: JSON.stringify([ctx.cartId]),
      })
      const text = await res.text()
      expect(text, "action poll คืนสถานะ pending").toContain('"pending"')
      const headers = { ...res.headers() }
      delete headers["content-length"]
      await route.fulfill({ status: res.status(), headers, body: text.replace('"pending"', JSON.stringify(outcome)) })
    }
  )
  await expect.poll(() => state.pollActionIds.size, { timeout: 30_000 }).toBeGreaterThan(0)
  return mocked
}

test.describe("PromptPay ทางสำรองบอกเหตุคืนเงิน (AC-24)", () => {
  test.skip(!HAS_STRIPE_UI, NEED_UI)

  test("placeOrder ได้ 409 FLASH_SOLD_OUT → promptpay-refunded ภายใน 5 วินาที และหยุด poll", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(240_000)
    let mocked!: Mocked

    await step("Given ชำระแล้วตอน QR ยังแสดง, webhook ไม่มา และ complete ของทางสำรองตอบ FLASH_SOLD_OUT", async () => {
      const ctx = await paidWhileQrShown(page, context, request, baseURL!)
      mocked = await mockPlaceOrder(page, ctx, { kind: "refunded", code: "FLASH_SOLD_OUT" })
    })

    await step("When QR ครบ 10 นาที → guard ตอบ 409 → finish เรียก placeOrder", async () => {
      await page.clock.fastForward("10:01")
      await expect.poll(() => mocked.placeOrders.length, { timeout: 60_000 }).toBeGreaterThan(0)
    })

    await step("Then ภายใน 5 วินาทีเห็น promptpay-refunded (คืนเงิน) ไม่ค้าง promptpay-awaiting-order", async () => {
      const refunded = page.getByTestId("promptpay-refunded")
      await expect(refunded).toBeVisible({ timeout: 5_000 })
      await expect(refunded).toContainText("คืนเงิน")
      await expectThai(page, ["promptpay-refunded"])
      await expect(page.getByTestId("promptpay-awaiting-order")).toHaveCount(0)
      await evidence("01-promptpay-refunded-flash-sold-out")
    })

    await step("And ไม่มี request poll/complete เพิ่มหลังจากนั้น", async () => {
      const polls = mocked.polls.length
      const placeOrders = mocked.placeOrders.length
      await page.clock.runFor("00:30")
      await page.waitForTimeout(1_000)
      expect(mocked.polls.length).toBe(polls)
      expect(mocked.placeOrders.length).toBe(placeOrders)
      await expect(page.getByTestId("promptpay-refunded")).toBeVisible()
    })
  })

  test("placeOrder ได้ 409 CART_COMPLETION_IN_PROGRESS → ยัง poll และไม่แสดง promptpay-refunded", async ({
    page,
    context,
    request,
    baseURL,
    step,
  }) => {
    test.setTimeout(240_000)
    let mocked!: Mocked

    await step("Given ชำระแล้วตอน QR ยังแสดง, webhook ไม่มา และ complete ของทางสำรองตอบ processing", async () => {
      const ctx = await paidWhileQrShown(page, context, request, baseURL!)
      mocked = await mockPlaceOrder(page, ctx, { kind: "processing" })
    })

    await step("When QR ครบ 10 นาที → finish เรียก placeOrder", async () => {
      await page.clock.fastForward("10:01")
      await expect.poll(() => mocked.placeOrders.length, { timeout: 60_000 }).toBeGreaterThan(0)
    })

    await step("Then ยังรอสร้างคำสั่งซื้อและ poll ต่อ ไม่แสดง promptpay-refunded", async () => {
      await expect(page.getByTestId("promptpay-awaiting-order")).toBeVisible()
      const polls = mocked.polls.length
      await expect
        .poll(
          async () => {
            await page.clock.runFor("00:03")
            return mocked.polls.length
          },
          { timeout: 30_000 }
        )
        .toBeGreaterThan(polls)
      await expect(page.getByTestId("promptpay-refunded")).toHaveCount(0)
      await expect(page.getByTestId("promptpay-awaiting-order")).toBeVisible()
    })
  })
})
