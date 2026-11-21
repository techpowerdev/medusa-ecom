import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { THAI, latinWordsOutsideAllowList } from "./support/thai-text"

// PAY-12: spec 06 AC-25 (กฎข้อ 14) — /api/payment-return ส่ง ?error= มาหน้า cart แล้วหน้า cart แสดง cart-error-notice ภาษาไทยตามค่า
// (ทางแยกของ route ตาม kind ของ placeOrder ตรวจใน unit `src/core-29-active-cart.test.ts`) ค่าที่ไม่รู้จัก → ไม่แสดง
// หา element ด้วย data-testid เท่านั้น ไม่ match ประโยคไทยตรงตัว
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-12" } })

const KNOWN = ["refunded", "order_failed", "payment_failed"] as const

test("AC-25: cart-error-notice ภาษาไทยต่อค่า error และไม่แสดงเมื่อค่าไม่รู้จัก", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const notice = page.getByTestId("cart-error-notice")
  const texts = new Map<string, string>()

  await step("(a) ลูกค้าที่มีตะกร้า: ?error=refunded → ข้อความไทยเหนือรายการสินค้า", async () => {
    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const customer = await createCustomer(request, pk)
    const cartId = await cartReadyForPayment(request, pk, customer)
    await signInAs(context, baseURL!, customer)
    await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
    await page.goto(`/${CC}/cart?error=refunded`)
    await expect(page.getByTestId("cart-container")).toBeVisible()
    await expect(notice).toBeVisible()
    await evidence("01-cart-error-refunded")
  })

  await step("(b) ทุกค่าที่รู้จัก → อักษรไทย ไม่มีคำละติน และข้อความต่างกันต่อค่า", async () => {
    for (const value of KNOWN) {
      await page.goto(`/${CC}/cart?error=${value}`)
      await expect(notice, value).toHaveCount(1)
      await expect(notice, value).toBeVisible()
      const text = ((await notice.textContent()) ?? "").trim()
      expect(text, value).toMatch(THAI)
      expect(latinWordsOutsideAllowList(text), `${value}: "${text}"`).toEqual([])
      texts.set(value, text)
    }
    expect(new Set(texts.values()).size).toBe(KNOWN.length)
    expect(texts.get("refunded")).toContain("คืนเงิน")
  })

  await step("(c) ?error=<script> / ค่าไม่รู้จัก / ไม่มี error → ไม่แสดง notice และไม่ render ค่าจาก URL", async () => {
    let dialogs = 0
    page.on("dialog", (dialog) => {
      dialogs++
      void dialog.dismiss()
    })
    for (const query of [`?error=${encodeURIComponent("<script>alert(1)</script>")}`, "?error=unknown", ""]) {
      await page.goto(`/${CC}/cart${query}`)
      await expect(page.getByTestId("cart-container")).toBeVisible()
      await expect(notice, query).toHaveCount(0)
      // innerText = ข้อความที่มองเห็น (textContent ของ body รวม payload RSC ใน <script> ที่มี URL ของหน้า)
      expect(await page.locator("body").innerText(), query).not.toContain("alert(1)")
    }
    expect(dialogs).toBe(0)
    await evidence("02-cart-error-unknown-hidden")
  })
})
