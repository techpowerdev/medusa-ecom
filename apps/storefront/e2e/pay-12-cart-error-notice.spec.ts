import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  completeCart,
  createCustomer,
  ok,
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

// review/qa #481 D-1: session หมดอายุระหว่าง 3DS แล้วกลับมาที่ /api/payment-return (succeeded) → หน้า login (ไม่ใช่ payment_failed)
// และ client_secret ไม่หลุดไปใน URL/HTML ของหน้า login; login แล้วกลับขั้น review ของ cart เดิมเพื่อจบ flow
// D-2: cart ถูก complete ไปแล้วก่อน login (เช่น webhook) → login แล้วได้หน้า order confirmed ของ order นั้น ไม่ใช่ 404
test("AC-25 (D-1, D-2): session หมดอายุ → login โดยไม่มี client_secret แล้วจบ flow", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(180_000)
  const SECRET = "sec_pay12_should_not_leak"
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)

  const run = async (mode: "no-jwt" | "bad-jwt", completed: boolean) => {
    const customer = await createCustomer(request, pk)
    const cartId = await cartReadyForPayment(request, pk, customer)
    // แบบที่ storefront ทำจริง (CORE-29 setCartCookie → customer.metadata.active_cart_id)
    await ok(
      await request.post(`${BACKEND_URL}/store/customers/me`, {
        headers: { "x-publishable-api-key": pk, authorization: `Bearer ${customer.token}` },
        data: { metadata: { active_cart_id: cartId } },
      }),
      "active_cart_id"
    )
    const order = completed ? await completeCart(request, pk, customer, cartId) : null

    await context.clearCookies()
    await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
    if (mode === "bad-jwt") {
      await context.addCookies([{ name: "_medusa_jwt", value: "expired.invalid.token", url: baseURL! }])
    }
    await page.goto(
      `/api/payment-return?${new URLSearchParams({
        cart_id: cartId,
        country_code: CC,
        payment_intent: "pi_pay12_expired",
        payment_intent_client_secret: SECRET,
        redirect_status: "succeeded",
      })}`
    )

    await expect(page.getByTestId("login-page")).toBeVisible()
    const url = new URL(page.url())
    expect(page.url()).not.toContain(SECRET)
    expect(decodeURIComponent(page.url())).not.toContain("payment_intent_client_secret")
    expect(url.pathname).toBe(`/${CC}/account`)
    expect(url.searchParams.get("return_to")).toBe(`/${CC}/checkout?step=review&cart_id=${cartId}`)
    const html = await page.content()
    expect(html).not.toContain(SECRET)
    expect(html).not.toContain("payment_intent_client_secret")

    await page.getByTestId("email-input").fill(customer.email)
    await page.getByTestId("password-input").fill(customer.password)
    await page.getByTestId("sign-in-button").click()
    if (order) {
      await expect(page).toHaveURL((u) => u.pathname === `/${CC}/order/${order.id}/confirmed`)
      await expect(page.getByTestId("order-complete-container")).toBeVisible()
    } else {
      await expect(page).toHaveURL(
        (u) => u.pathname === `/${CC}/checkout` && u.searchParams.get("step") === "review" && u.searchParams.get("cart_id") === cartId
      )
      await expect(page.getByTestId("review-heading")).toBeVisible()
    }
  }

  await step("(a) ไม่มี jwt → login → ขั้น review ของ cart เดิม", () => run("no-jwt", false))
  await step("(b) jwt เสีย → login → ขั้น review ของ cart เดิม", () => run("bad-jwt", false))
  await step("(c) D-2 ไม่มี jwt + cart complete แล้ว → login → หน้า order confirmed", () => run("no-jwt", true))
  await step("(d) D-2 jwt เสีย + cart complete แล้ว → login → หน้า order confirmed", () => run("bad-jwt", true))
})
