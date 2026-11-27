import crypto from "node:crypto"

import type { Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { addAddresses, poolGroup } from "./support/group-buy"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, fulfillAndShip, placeOrder, publishableKey, signInAs } from "./support/medusa"
import { chooseOption, expectSelected, selectOptions } from "./support/select"

// SFUI-16 (spec 09 รอบ 49 กฎ 40b–46; ADR-033): select ของ storefront เป็น Select ของ shadcn (Radix) — ส่วน 16a: คืนสินค้า + group buy join (AC-43)
// หา element ด้วย data-testid เท่านั้น (trigger `<t>`, `<t>-options`, `<t>-option` + data-value)

const heightOf = (control: Locator) => control.evaluate((el) => getComputedStyle(el).height)
const triggerText = (trigger: Locator) => trigger.locator('[data-slot="select-value"]').textContent()

/** เปิดด้วย Enter ที่ trigger (ซ้ำจน hydrate); ระบุ `current` → รอ focus อยู่ที่ item ของค่าปัจจุบัน */
async function openWithEnter(page: Page, trigger: Locator, testId: string, current?: string) {
  await expect(async () => {
    await trigger.focus()
    await page.keyboard.press("Enter")
    await expect(trigger).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 })
  }).toPass()
  if (current === undefined) return
  await expect(page.getByTestId(`${testId}-options`).locator(`[data-testid="${testId}-option"][data-value="${current}"]`)).toBeFocused()
}

test.describe("16a: ฟอร์มคืนสินค้า (AC-43)", () => {
  test("return-item-quantity: Enter เปิด, ArrowDown + Enter เปลี่ยนค่า, Escape ไม่เปลี่ยน; เลือกเหตุผลแล้วข้อความ trigger = ข้อความของ item; สูง 36px", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    test.setTimeout(180_000)
    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const customer = await createCustomer(request, pk)
    const order = await placeOrder(request, pk, customer)
    await fulfillAndShip(request, admin, order.id)
    const reasonRes = await request.post(`${BACKEND_URL}/admin/return-reasons`, {
      headers: admin,
      data: { value: `sfui16a-${Date.now()}-${crypto.randomInt(1e6)}`, label: "ขนาดไม่พอดี" },
    })
    expect(reasonRes.status(), await reasonRes.text()).toBe(200)
    const reasonId: string = (await reasonRes.json()).return_reason.id
    await signInAs(context, baseURL!, customer)

    await page.goto(`/${CC}/account/orders/details/${order.id}/return`)
    const row = page.getByTestId("return-item").first()
    const quantity = row.getByTestId("return-item-quantity")
    await expectSelected(quantity, "0")
    expect(await heightOf(quantity)).toBe("36px")

    await openWithEnter(page, quantity, "return-item-quantity", "0")
    await page.keyboard.press("ArrowDown")
    // Radix ย้าย focus ใน setTimeout — รอ focus ถึง item ถัดไปก่อนกด Enter
    await expect(page.getByTestId("return-item-quantity-options").locator('[data-testid="return-item-quantity-option"][data-value="1"]')).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(quantity).toHaveAttribute("aria-expanded", "false")
    await expectSelected(quantity, "1")
    expect(await triggerText(quantity)).toBe("1")

    await openWithEnter(page, quantity, "return-item-quantity")
    await page.keyboard.press("ArrowUp")
    await page.keyboard.press("Escape")
    await expect(quantity).toHaveAttribute("aria-expanded", "false")
    await expectSelected(quantity, "1")

    const reason = row.getByTestId("return-item-reason")
    expect(await heightOf(reason)).toBe("36px")
    const { placeholder, options } = await selectOptions(reason)
    expect(placeholder).toBe("เลือกเหตุผล")
    const itemText = options.find(([value]) => value === reasonId)![1]
    await chooseOption(reason, reasonId)
    expect(await triggerText(reason)).toBe(itemText)
  })
})

test.describe("16a: group buy join (AC-43)", () => {
  test("selectOptions ของ group-shipping-option มี placeholder เลือกวิธีจัดส่ง และไม่มี item value ว่าง; ทั้งสามช่องสูง 36px", async ({ page, request, baseURL }) => {
    test.setTimeout(180_000)
    const ctx = await poolGroup(request, { max_units_per_person: 5 })
    const customer = await createCustomer(request, ctx.pk)
    await addAddresses(request, ctx.pk, customer, [
      { first_name: "สมชาย", last_name: "ใจดี", address_1: "1 ถนนสุขุมวิท", city: "กรุงเทพ", postal_code: "10110", phone: "0811111111" },
    ])
    await signInAs(page.context(), baseURL!, customer)
    await page.goto(`/${CC}/g/${ctx.token}`)

    await page.getByTestId("group-options").getByTestId("option-button").filter({ hasText: /^S$/ }).click()
    await page.getByTestId("group-add-variant").click()
    await expect(page.getByTestId("group-selection-item")).toHaveCount(1)
    await page.getByTestId("group-shipping-load").click()
    const shipping = page.getByTestId("group-shipping-option")
    await expect(shipping).toBeVisible({ timeout: 30_000 })
    await expectSelected(shipping, "")

    const { placeholder, options } = await selectOptions(shipping)
    expect(placeholder).toBe("เลือกวิธีจัดส่ง")
    expect(options.length).toBeGreaterThan(0)
    for (const [value, text] of options) expect(value, text).not.toBe("")
    for (const id of ["group-quantity", "group-address-select", "group-shipping-option"]) {
      expect(await heightOf(page.getByTestId(id)), id).toBe("36px")
    }
  })
})
