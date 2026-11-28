import { APIRequestContext, Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { CARD_PROVIDER, HAS_STRIPE_SECRET, HAS_STRIPE_UI, continueToReview, fillCard } from "./support/stripe"

// SFUI-21c (spec 09 กฎ 80, AC-69 (2) — owner Q-R50-1, ADR-034 D8): การ์ดตัวเลือกจัดส่งและชำระเงิน = Choice Card ของ shadcn
// (`FieldLabel` → `Field orientation="horizontal"` → `FieldContent` + `RadioGroupItem`) — กรอบ/มุม/ระยะในการ์ดเท่ากันทั้งสองขั้น,
// สีกรอบของการ์ดที่เลือกเท่ากันและต่างจากการ์ดที่ไม่เลือก, คลิกชื่อตัวเลือก (FieldTitle) แล้วเลือก, ลูกศรเปลี่ยนตัวเลือก,
// iframe ของ Stripe อยู่นอก <label> และกรอกบัตรแล้วไปขั้น review ได้
test.use({
  evidenceTarget: { feature: "storefront-consistency", taskId: "SFUI-21c" },
})

/** การ์ด = `<label data-slot="field-label">` ที่ครอบ RadioGroupItem (FieldTitle ก็มี data-slot เดียวกันแต่เป็น div) */
const cardOf = (page: Page, radio: Locator) => page.locator('label[data-slot="field-label"]', { has: radio })
const titleOf = (page: Page, radio: Locator) => cardOf(page, radio).locator('[data-slot="field-content"] > [data-slot="field-label"]')

async function cardStyle(radio: Locator) {
  return radio.evaluate((el) => {
    const label = el.closest('label[data-slot="field-label"]')
    const field = el.closest('[data-slot="field"]')
    if (!label || !field) return null
    const l = getComputedStyle(label)
    const f = getComputedStyle(field)
    return {
      borderWidth: [l.borderTopWidth, l.borderRightWidth, l.borderBottomWidth, l.borderLeftWidth].join(" "),
      borderRadius: l.borderRadius,
      padding: f.padding,
    }
  })
}

/** seed มีตัวเลือกจัดส่งแบบส่งของตัวเดียว (Standard) → สร้างตัวที่สองของ test (zone/profile เดียวกับ Standard) แล้วลบใน finally (แบบ core-4e) */
async function createSecondOption(request: APIRequestContext, admin: Headers): Promise<string> {
  const res = await request.get(
    `${BACKEND_URL}/admin/shipping-options?fields=id,name,provider_id,service_zone_id,shipping_profile_id&limit=100`,
    { headers: admin }
  )
  const standard = (await res.json()).shipping_options.find((o: { name: string }) => o.name === "Standard")
  expect(standard, "Standard shipping option").toBeTruthy()
  const stamp = Date.now()
  const created = await request.post(`${BACKEND_URL}/admin/shipping-options`, {
    headers: admin,
    data: {
      name: `SFUI-21c ด่วน ${stamp}`,
      price_type: "flat",
      provider_id: standard.provider_id,
      service_zone_id: standard.service_zone_id,
      shipping_profile_id: standard.shipping_profile_id,
      type: {
        label: "SFUI-21c",
        description: "SFUI-21c",
        code: `sfui21c-${stamp}`,
      },
      prices: [{ currency_code: "thb", amount: 120 }],
      rules: [
        { attribute: "enabled_in_store", value: "true", operator: "eq" },
        { attribute: "is_return", value: "false", operator: "eq" },
      ],
    },
  })
  expect(created.status(), `create option: ${await created.text()}`).toBe(200)
  return (await created.json()).shipping_option.id
}

const borderColor = (radio: Locator) =>
  radio.evaluate((el) => getComputedStyle(el.closest('label[data-slot="field-label"]')!).borderTopColor)

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`AC-69 (2) ${viewport.width}: การ์ดจัดส่ง/ชำระเงินเป็น Choice Card เดียวกัน, คลิกชื่อ/ลูกศรเลือกได้ และ Stripe อยู่นอก label`, async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.skip(!HAS_STRIPE_SECRET, "ต้องตั้ง STRIPE_API_KEY (sk_test_) — วิธีชำระ ≥ 2 ต้องมี provider ของ Stripe")
    test.setTimeout(240_000)
    await page.setViewportSize(viewport)
    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const optionId = await createSecondOption(request, admin)
    try {
      await checkoutWithChoiceCards()
    } finally {
      const removed = await request.delete(`${BACKEND_URL}/admin/shipping-options/${optionId}`, { headers: admin })
      expect(removed.ok(), `ลบตัวเลือกจัดส่งของ test: ${removed.status()}`).toBe(true)
    }

    async function checkoutWithChoiceCards() {
      const customer = await createCustomer(request, pk)
      const cartId = await cartReadyForPayment(request, pk, customer)
      await signInAs(context, baseURL!, customer)
      await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
      await page.goto(`/${CC}/checkout?step=delivery`)

      const radios = page.getByTestId("delivery-option-radio")
      let delivery: Awaited<ReturnType<typeof cardStyle>> = null
      let selectedColor = ""

      await step("ขั้นจัดส่ง: การ์ด ≥ 2 ใบ เป็น Choice Card, คลิกชื่อแล้วเลือก, สีกรอบที่เลือกต่างจากที่ไม่เลือก", async () => {
        await expect(radios.first()).toBeVisible()
        expect(await radios.count(), "ตัวเลือกจัดส่ง").toBeGreaterThanOrEqual(2)
        const target = radios.and(page.locator('[aria-checked="false"]')).first()
        const value = await target.getAttribute("value")
        const chosen = page.locator(`[data-testid="delivery-option-radio"][value="${value}"]`)
        delivery = await cardStyle(chosen)
        expect(delivery, "RadioGroupItem อยู่ใน FieldLabel → Field").not.toBeNull()
        await titleOf(page, chosen).click()
        await expect(chosen).toHaveAttribute("aria-checked", "true")
        selectedColor = await borderColor(chosen)
        const other = radios.and(page.locator('[aria-checked="false"]')).first()
        expect(await borderColor(other), "สีกรอบของการ์ดที่ไม่เลือก").not.toBe(selectedColor)
        for (let i = 0; i < (await radios.count()); i++) expect(await cardStyle(radios.nth(i))).toEqual(delivery)
        await expect(page.getByTestId("submit-delivery-option-button")).toBeEnabled()
        if (viewport.width === 1280) await evidence(`01-delivery-${viewport.width}`)
      })

      await step("ขั้นจัดส่ง: ลูกศรเปลี่ยนตัวเลือก (กฎ 12)", async () => {
        const checked = radios.and(page.locator('[aria-checked="true"]'))
        const before = await checked.getAttribute("value")
        await checked.focus()
        const focusedValue = () => page.evaluate(() => document.activeElement?.getAttribute("value") ?? null)
        // Radix เลือกเมื่อปุ่มลูกศรยังกดค้างตอน focus ย้าย (แบบ sfui-3d-payment)
        await page.keyboard.down("ArrowDown")
        await expect.poll(focusedValue).not.toBe(before)
        const focused = page.locator(`[data-testid="delivery-option-radio"][value="${await focusedValue()}"]`)
        await expect(focused).toHaveAttribute("aria-checked", "true")
        await page.keyboard.up("ArrowDown")
        await expect(radios.and(page.locator('[aria-checked="true"]'))).toHaveCount(1)
        await expect(page.getByTestId("submit-delivery-option-button")).toBeEnabled()
        await page.getByTestId("submit-delivery-option-button").click()
      })

      const card = page.getByTestId(`payment-option-${CARD_PROVIDER}`)
      const options = page.locator('[data-testid^="payment-option-"]')

      await step("ขั้นชำระเงิน: การ์ด ≥ 2 ใบ ขอบ/มุม/ระยะเท่าขั้นจัดส่ง, คลิกชื่อบัตรแล้วเลือก, สีกรอบที่เลือกเท่าขั้นจัดส่ง", async () => {
        await expect(card).toBeVisible()
        expect(await options.count(), "วิธีชำระ").toBeGreaterThanOrEqual(2)
        for (let i = 0; i < (await options.count()); i++) expect(await cardStyle(options.nth(i))).toEqual(delivery)
        await titleOf(page, card).click()
        await expect(card).toHaveAttribute("aria-checked", "true")
        expect(await borderColor(card), "สีกรอบการ์ดที่เลือกเท่ากันทั้งสองขั้น").toBe(selectedColor)
        const other = options.and(page.locator('[aria-checked="false"]')).first()
        expect(await borderColor(other)).not.toBe(selectedColor)
      })

      await step("ขั้นชำระเงิน: iframe ของ Stripe อยู่นอก <label>, กรอกบัตร 4242 แล้วไปขั้น review", async () => {
        test.skip(!HAS_STRIPE_UI, "ต้องตั้ง NEXT_PUBLIC_STRIPE_KEY (pk_test_) — Stripe Elements ต้องโหลดใน browser")
        await fillCard(page, "4242424242424242")
        const frames = page.locator('iframe[src^="https://js.stripe.com"]')
        expect(await frames.count()).toBeGreaterThan(0)
        expect(await frames.evaluateAll((els) => els.filter((el) => el.closest("label") !== null).length)).toBe(0)
        if (viewport.width === 1280) await evidence(`02-payment-card-${viewport.width}`)
        await continueToReview(page)
      })
    }
  })
}
