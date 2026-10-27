import { APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  shippingOptionId,
  signInAs,
} from "./support/medusa"
import { Headers } from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-4e: spec 01 กฎข้อ 55–56, AC-91 — placeholder ของ CountrySelect เป็นไทย, popup ทักทายที่อยู่/shipping nudge หาได้ด้วย test id,
// ปุ่ม X ของ nudge มี aria-label ไทย, floating label ไม่ทับค่าที่เติมจากที่อยู่ที่บันทึกไว้, STORE_NAME ตามด้วย " แล้ว" (เว้นวรรค)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-4e" } })

const PRODUCT = "t-shirt"
const MANUAL = "pp_system_default"
const ADDRESS_INPUTS = [
  "shipping-first-name-input",
  "shipping-last-name-input",
  "shipping-address-input",
  "shipping-postal-code-input",
  "shipping-city-input",
  "shipping-province-input",
  "shipping-phone-input",
]

/**
 * nudge แสดงเมื่อมี shipping option ที่ส่งฟรีตาม `item_total` — seed ไม่มี จึงสร้าง option แยกของ test (zone/profile เดียวกับ Standard)
 * แล้วลบทิ้งหลังจบ (ไม่แก้ Standard ที่ test อื่นใช้)
 */
async function createFreeShippingOption(
  request: APIRequestContext,
  admin: Headers
): Promise<string> {
  const { shipping_options } = await (
    await request.get(
      `${BACKEND_URL}/admin/shipping-options?fields=id,name,provider_id,service_zone_id,shipping_profile_id&limit=100`,
      { headers: admin }
    )
  ).json()
  const standard = shipping_options.find(
    (o: { name: string }) => o.name === "Standard"
  )
  expect(standard, "Standard shipping option").toBeTruthy()
  const res = await request.post(`${BACKEND_URL}/admin/shipping-options`, {
    headers: admin,
    data: {
      name: `CORE-4e nudge ${Date.now()}`,
      price_type: "flat",
      provider_id: standard.provider_id,
      service_zone_id: standard.service_zone_id,
      shipping_profile_id: standard.shipping_profile_id,
      type: {
        label: "CORE-4e nudge",
        description: "CORE-4e nudge",
        code: `core4e-nudge-${Date.now()}`,
      },
      prices: [
        { currency_code: "thb", amount: 100 },
        {
          currency_code: "thb",
          amount: 0,
          rules: [
            { attribute: "item_total", operator: "gt", value: 1_000_000 },
          ],
        },
      ],
      rules: [
        { attribute: "enabled_in_store", value: "true", operator: "eq" },
        { attribute: "is_return", value: "false", operator: "eq" },
      ],
    },
  })
  expect(res.status(), `create nudge option: ${await res.text()}`).toBe(200)
  return (await res.json()).shipping_option.id
}

/**
 * qa #109: เลือกที่อยู่ที่บันทึกไว้ → ค่าใน input เปลี่ยนทันทีแต่ label ค่อยๆ เลื่อนขึ้น (transition) จึงทับข้อความค่า
 * วัดทันทีหลังเลือก: กล่องของ label (boundingBox) เทียบกับกล่อง "หมึก" ของข้อความค่า (glyph จริง ไม่รวม line-height)
 * baseline ของค่าวัดจาก clone ของ input คู่กับ probe inline-block (inline-block ของ input ใช้ baseline ของข้อความ)
 * ความสูงหมึกจาก canvas measureText ด้วยฟอนต์เดียวกับ input
 */
function labelAndValueBoxes(testIds: string[]) {
  const ctx = document.createElement("canvas").getContext("2d")!
  return testIds.map((id) => {
    const field = document.querySelector<HTMLInputElement>(
      `[data-testid="${id}"]`
    )!
    const label = field
      .parentElement!.querySelector("label")!
      .getBoundingClientRect()
    const rect = field.getBoundingClientRect()
    const holder = document.createElement("div")
    holder.style.cssText =
      "position:absolute;left:0;top:0;line-height:0;white-space:nowrap"
    const clone = field.cloneNode() as HTMLInputElement
    clone.value = field.value
    clone.style.cssText = `display:inline-block;width:${rect.width}px;height:${rect.height}px;vertical-align:baseline`
    const probe = document.createElement("span")
    probe.style.cssText =
      "display:inline-block;width:0;height:0;vertical-align:baseline"
    holder.append(clone, probe)
    document.body.append(holder)
    const baseline =
      rect.top +
      (probe.getBoundingClientRect().top - clone.getBoundingClientRect().top)
    holder.remove()
    const style = getComputedStyle(field)
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const ink = ctx.measureText(field.value)
    return {
      id,
      label: { top: label.top, bottom: label.bottom },
      value: {
        top: baseline - ink.actualBoundingBoxAscent,
        bottom: baseline + ink.actualBoundingBoxDescent,
      },
    }
  })
}

test("AC-91: ขั้นที่อยู่ของ checkout — placeholder ไทย, test id/aria-label ของ popup, label ไม่ทับค่า", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const nudgeOptionId = await createFreeShippingOption(request, admin)
  await test.info().attach("nudge option", { body: nudgeOptionId })
  try {
    await checkoutAddressStep()
  } finally {
    // CORE-4g (AC-99): cleanup ที่ล้มต้องไม่เงียบ
    const removed = await request.delete(
      `${BACKEND_URL}/admin/shipping-options/${nudgeOptionId}`,
      { headers: admin }
    )
    expect(removed.ok(), `ลบ nudge option ของ test: ${removed.status()}`).toBe(true)
  }

  async function checkoutAddressStep() {
    const customer = await createCustomer(request, pk)
    const saved = await request.post(
      `${BACKEND_URL}/store/customers/me/addresses`,
      {
        headers: {
          authorization: `Bearer ${customer.token}`,
          "x-publishable-api-key": pk,
        },
        data: {
          first_name: "สมชาย",
          last_name: "ใจดี",
          address_1: "99 ถนนสุขุมวิท",
          postal_code: "10110",
          city: "วัฒนา",
          province: "กรุงเทพมหานคร",
          country_code: CC,
          phone: "0812345678",
        },
      }
    )
    expect(saved.status(), "saved address").toBe(200)
    await signInAs(context, baseURL!, customer)

    await step(
      "shipping nudge: หาได้ด้วย test id และปุ่ม X มี aria-label ไทย",
      async () => {
        await page.goto(`/${CC}/products/${PRODUCT}`)
        await page.getByTestId("add-product-button").click()
        await expect(page.getByTestId("add-product-button")).toBeEnabled()
        await page.goto(`/${CC}/store`)
        const popup = page.getByTestId("free-shipping-nudge-popup")
        await expect(popup).toBeVisible()
        const close = page.getByTestId("free-shipping-nudge-close")
        await expect(close).toHaveAttribute("aria-label", THAI)
        await close.click()
        await expect(popup).toBeHidden()
      }
    )

    await step(
      "ขั้นที่อยู่: placeholder ของ CountrySelect เป็นไทย และ popup ทักทายมี test id",
      async () => {
        await page.goto(`/${CC}/cart`)
        await page.getByTestId("checkout-button").click()
        await expect(
          page.getByTestId("shipping-first-name-input")
        ).toBeVisible()
        const placeholder = page
          .getByTestId("shipping-country-select")
          .locator('option[value=""]')
        await expect(placeholder).toHaveText(THAI)
        await expect(page.getByTestId("saved-address-greeting")).toBeVisible()
        await expect(page.getByTestId("saved-address-greeting")).toHaveText(
          THAI
        )
      }
    )

    await step(
      "เลือกที่อยู่ที่บันทึกไว้ → label ไม่ทับข้อความค่าใน input",
      async () => {
        await page.getByTestId("shipping-address-select").click()
        await page.getByTestId("shipping-address-option").first().click()
        await expect(page.getByTestId("shipping-first-name-input")).toHaveValue(
          "สมชาย"
        )
        // วัดทันที (ไม่รอ transition) — label ต้องอยู่ตำแหน่งลอยแล้วตั้งแต่ค่าถูกเติม
        // CORE-4g: รอฟอนต์โหลดครบก่อน (ไม่รอ transition) — วัดด้วย fallback font ให้ผลต่างจากที่ผู้ใช้เห็น
        await page.evaluate(() => document.fonts.ready)
        const boxes = await page.evaluate(labelAndValueBoxes, ADDRESS_INPUTS)
        for (const { id, label, value } of boxes) {
          expect(
            label.bottom,
            `${id}: label ${JSON.stringify(label)} ทับค่า ${JSON.stringify(
              value
            )}`
          ).toBeLessThanOrEqual(value.top)
        }
        await expect(page.getByTestId("shipping-address-options")).toBeHidden()
        await evidence("4e-01-saved-address-labels")
      }
    )

    await step(
      'ขั้น review: STORE_NAME ตามด้วย " แล้ว" มีเว้นวรรค',
      async () => {
        await page.getByTestId("submit-address-button").click()
        await expect(
          page.getByTestId("delivery-options-container").first()
        ).toBeVisible()
        const standardId = await shippingOptionId(
          request,
          context,
          pk,
          customer,
          "Standard"
        )
        await page
          .locator(
            `[data-testid="delivery-option-radio"][data-option-id="${standardId}"]`
          )
          .click()
        await expect(
          page.getByTestId("submit-delivery-option-button")
        ).toBeEnabled()
        await page.getByTestId("submit-delivery-option-button").click()
        await page.getByTestId(`payment-option-${MANUAL}`).click()
        await page.getByTestId("submit-payment-button").click()
        const terms = page.getByTestId("review-terms")
        await expect(terms).toBeVisible({ timeout: 30_000 })
        const text = ((await terms.textContent()) ?? "").trim()
        expect(text).toMatch(/\sแล้ว$/)
        expect(text).not.toMatch(/\Sแล้ว$/)
      }
    )
  }
})
