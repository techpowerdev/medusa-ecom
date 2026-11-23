import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"
import { Mocked, mockPlaceOrder, paidWhileQrShown } from "./support/promptpay-race"
import { HAS_STRIPE_UI } from "./support/stripe"
import { expectSingleTabStop } from "./support/keyboard"
import { expectThai } from "./support/thai-text"

// PAY-15 (spec 06 กฎข้อ 17, AC-28 — owner ตัดสิน 2026-11-22 จาก review #479): หลัง `promptpay-refunded` ที่รู้เหตุ (ทางสำรองของ PAY-11)
// ไม่มีปุ่ม "เริ่มชำระใหม่" (สร้าง QR ใหม่บนตะกร้าเดิม → จ่ายซ้ำแล้วถูกคืนซ้ำ) แต่มีลิงก์ "ไปที่ตะกร้า" → /<cc>/cart
// ฉากและ route mock เดียวกับ pay-11 (`mockPlaceOrder`); กรณีไม่รู้เหตุ (PAY-6c) ตรวจใน payments-promptpay-fallback-cap.spec.ts
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-15" } })

const NEED_UI = "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน"

test.describe("PromptPay refunded ที่รู้เหตุ → ไปที่ตะกร้า (AC-28)", () => {
  test.skip(!HAS_STRIPE_UI, NEED_UI)

  test("placeOrder ได้ 409 FLASH_SOLD_OUT → promptpay-go-to-cart แทน promptpay-retry-button แล้วคลิกไป /th/cart", async ({
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

    await step("When QR ครบ 10 นาที → ทางสำรองได้ผล refunded ที่รู้เหตุ", async () => {
      await page.clock.fastForward("10:01")
      await expect.poll(() => mocked.placeOrders.length, { timeout: 60_000 }).toBeGreaterThan(0)
      await expect(page.getByTestId("promptpay-refunded")).toBeVisible({ timeout: 5_000 })
    })

    await step("Then เห็นลิงก์ไปที่ตะกร้า (ไทย, href /th/cart) และไม่เห็นปุ่มเริ่มชำระใหม่", async () => {
      const goToCart = page.getByTestId("promptpay-go-to-cart")
      await expect(goToCart).toBeVisible()
      await expect(goToCart).toHaveAttribute("href", new RegExp(`/${CC}/cart$`))
      await expectThai(page, ["promptpay-refunded", "promptpay-go-to-cart"])
      await expect(page.getByTestId("promptpay-retry-button")).toHaveCount(0)
      await evidence("01-promptpay-go-to-cart")
    })

    await step("And Tab หยุดที่ลิงก์ไปที่ตะกร้าครั้งเดียว (CORE-90 กฎข้อ 146b, AC-187)", async () => {
      await expectSingleTabStop(page.getByTestId("promptpay-go-to-cart"))
    })

    await step("When คลิกไปที่ตะกร้า → Then อยู่ที่หน้า /th/cart", async () => {
      await page.getByTestId("promptpay-go-to-cart").click()
      await expect(page).toHaveURL(new RegExp(`/${CC}/cart(\\?.*)?$`), { timeout: 30_000 })
    })
  })
})
