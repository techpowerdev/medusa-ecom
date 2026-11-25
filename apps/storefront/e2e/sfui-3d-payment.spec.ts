import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, publishableKey, signInAs } from "./support/medusa"
import { CARD_PROVIDER, HAS_STRIPE_SECRET, PROMPTPAY_PROVIDER, checkoutToPayment } from "./support/stripe"

// SFUI-3d (spec 09 กฎ 4, 9, 12, AC-12): ตัวเลือกวิธีชำระเป็น RadioGroup ของ shadcn (Radix) — ตัวเลือกคือปุ่ม role="radio"
// ที่มี testid เดิม และลูกศรเปลี่ยนตัวเลือก (เลือกพร้อมเพย์ไม่ต้องกรอกบัตร จึงต้องการแค่ provider Stripe ฝั่ง backend)
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-3d" } })

test("AC-12: focus ตัวเลือกบัตรแล้วกด ArrowDown → พร้อมเพย์ถูกเลือก (aria-checked)", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.skip(!HAS_STRIPE_SECRET, "ต้องตั้ง STRIPE_API_KEY (sk_test_) — backend ต้องมี provider ของ Stripe")
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  await checkoutToPayment(page, context, request, pk, customer, CC, "t-shirt")

  const card = page.getByTestId(`payment-option-${CARD_PROVIDER}`)
  const promptpay = page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`)

  await step("ตัวเลือกเป็นปุ่ม role=radio ที่ยังไม่ถูกเลือก", async () => {
    await expect(card).toHaveAttribute("role", "radio")
    await expect(promptpay).toHaveAttribute("role", "radio")
    await expect(card).toHaveAttribute("aria-checked", "false")
    await expect(promptpay).toHaveAttribute("aria-checked", "false")
  })

  await step("focus ตัวเลือกบัตรแล้วกด ArrowDown → ตัวเลือกถัดไปถูกเลือกทีละตัว จนถึงพร้อมเพย์", async () => {
    // ลำดับตัวเลือกมาจาก backend (ตอนนี้ พร้อมเพย์ → บัตร → แมนนวล) — กด ArrowDown วนตามลำดับ DOM (Radix loop)
    // แต่ละครั้งตัวที่ได้ focus ต้องถูกเลือก (aria-checked) จนถึงพร้อมเพย์ ไม่ผูกกับลำดับของ provider
    const options = page.locator('[data-testid^="payment-option-"]')
    const count = await options.count()
    const focusedValue = () => page.evaluate(() => document.activeElement?.getAttribute("value") ?? null)
    await card.focus()
    for (let i = 0; i < count && (await promptpay.getAttribute("aria-checked")) !== "true"; i++) {
      const before = await focusedValue()
      // Radix ย้าย focus ใน setTimeout แล้วเลือกเมื่อปุ่มลูกศรยังกดค้าง (isArrowKeyPressed) — press() ของ Playwright ปล่อยปุ่มทันที
      // จึงกดค้างจน focus ย้ายไปตัวถัดไปและตัวนั้นถูกเลือกแล้วค่อยปล่อย (เหมือนคนกด)
      await page.keyboard.down("ArrowDown")
      await expect.poll(focusedValue).not.toBe(before)
      const focused = page.locator(`[data-testid="payment-option-${await focusedValue()}"]`)
      await expect(focused).toHaveAttribute("aria-checked", "true")
      await page.keyboard.up("ArrowDown")
      await expect(options.and(page.locator('[aria-checked="true"]'))).toHaveCount(1)
    }
    await expect(promptpay).toHaveAttribute("aria-checked", "true")
    await expect(promptpay).toBeFocused()
    await expect(card).toHaveAttribute("aria-checked", "false")
    await evidence("01-payment-arrowdown-promptpay")
  })
})
