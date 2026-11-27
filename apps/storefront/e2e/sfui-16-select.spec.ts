import crypto from "node:crypto"

import type { APIRequestContext, BrowserContext, Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { addAddresses, poolGroup } from "./support/group-buy"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  fulfillAndShip,
  ok,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { chooseOption, expectSelected, selectOptions } from "./support/select"
import { addToCartFromPdp, isServerAction } from "./support/server-action"

// SFUI-16 (spec 09 รอบ 49 กฎ 40b–46; ADR-033): select ของ storefront เป็น Select ของ shadcn (Radix) — 16a: คืนสินค้า + group buy join (AC-43), 16b: ประเทศ (AC-44/49), 16c: จำนวนในตะกร้า (AC-45/49)
// หา element ด้วย data-testid เท่านั้น (trigger `<t>`, `<t>-options`, `<t>-option` + data-value)

const heightOf = (control: Locator) => control.evaluate((el) => getComputedStyle(el).height)
const triggerText = (trigger: Locator) => trigger.locator('[data-slot="select-value"]').textContent()

/** เปิดด้วย Enter ที่ trigger (ซ้ำจน hydrate); ระบุ `current` → รอ focus อยู่ที่ item ของค่าปัจจุบัน */
async function openWithEnter(page: Page, trigger: Locator, testId: string, current?: string) {
  await expect(async () => {
    // รอบ retry: เปิดแล้วไม่กด Enter ซ้ำ (Enter บน item ที่ focus = เลือกค่า) — แบบเดียวกับ open() ของ support/select.ts
    if ((await trigger.getAttribute("aria-expanded")) !== "true") {
      await trigger.focus()
      await page.keyboard.press("Enter")
    }
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

// SFUI-16b — AC-49 (กฎ 46, Q-R49-1 = ก): มือถือใช้ popover ของ Radix — กล่องรายการอยู่ในจอทั้งกล่อง เลือกได้ หน้าไม่ล้นแนวนอน
test.describe("SFUI-16b ประเทศ", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("AC-49: 390×844 แตะ shipping-country-select → shipping-country-select-options อยู่ในจอ เลือกได้ และไม่ล้นแนวนอน", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const pk = await publishableKey(request, await adminHeaders(request))
    const customer = await createCustomer(request, pk)
    await signInAs(context, baseURL!, customer)
    await page.goto(`/${CC}/products/t-shirt`)
    await addToCartFromPdp(page, { request, pk, customer })
    await page.goto(`/${CC}/checkout?step=address`)

    const trigger = page.getByTestId("shipping-country-select")
    const options = page.getByTestId("shipping-country-select-options")
    await step("แตะ trigger → กล่องรายการมองเห็นและอยู่ในจอทั้งกล่อง", async () => {
      await trigger.scrollIntoViewIfNeeded()
      await expect(async () => {
        if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.tap()
        await expect(trigger).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 })
      }).toPass()
      await expect(options).toBeVisible()
      const box = (await options.boundingBox())!
      const viewport = page.viewportSize()!
      expect(box.x, "ซ้าย").toBeGreaterThanOrEqual(0)
      expect(box.y, "บน").toBeGreaterThanOrEqual(0)
      expect(box.x + box.width, "ขวา").toBeLessThanOrEqual(viewport.width)
      expect(box.y + box.height, "ล่าง").toBeLessThanOrEqual(viewport.height)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await evidence("16b-01-country-popover-390")
      await page.keyboard.press("Escape")
      await expect(trigger).toHaveAttribute("aria-expanded", "false")
    })

    await step("เลือก item ได้ และหน้าไม่ล้นแนวนอน", async () => {
      await chooseOption(trigger, CC)
      await expectSelected(trigger, CC)
      await expect(options).toBeHidden()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })
  })
})

// ---- SFUI-16c: จำนวนในตะกร้า (`product-select-button`) — AC-45, AC-49 (ตะกร้า) ----

type CartFixture = { pk: string; customer: Customer; cartId: string; lineId: string }

/** ลูกค้าที่ login + cart 1 line จำนวน 1 (เจ้าของ cart — CORE-6/CORE-12) แล้วผูก cookie cart ให้ browser */
async function cartWithOneLine(request: APIRequestContext, context: BrowserContext, baseURL: string): Promise<CartFixture> {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const cartId = await cartReadyForPayment(request, pk, customer)
  const { cart } = await ok(
    await request.get(`${BACKEND_URL}/store/carts/${cartId}`, {
      headers: { "x-publishable-api-key": pk, authorization: `Bearer ${customer.token}` },
      params: { fields: "items.id" },
    }),
    "read cart"
  )
  await signInAs(context, baseURL, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL }])
  return { pk, customer, cartId, lineId: cart.items[0].id }
}

async function lineQuantity(request: APIRequestContext, { pk, customer, cartId }: CartFixture) {
  const { cart } = await ok(
    await request.get(`${BACKEND_URL}/store/carts/${cartId}`, {
      headers: { "x-publishable-api-key": pk, authorization: `Bearer ${customer.token}` },
      params: { fields: "items.quantity" },
    }),
    "read cart"
  )
  return cart.items[0].quantity as number
}

/** body ของ `updateLineItem({ lineId, quantity })` ของ line นี้ */
const isUpdateBody = (lineId: string, quantity: number) => (body: string) => {
  try {
    const [arg] = JSON.parse(body)
    return arg?.lineId === lineId && arg?.quantity === quantity
  } catch {
    return false
  }
}

test("AC-45: เลือก 2 ใน product-select-button → updateLineItem ถูกส่ง 1 ครั้ง, cart ใน backend จำนวน 2, ชื่อที่เข้าถึงได้ จำนวน", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(120_000)
  const fixture = await cartWithOneLine(request, context, baseURL!)
  const trigger = page.getByTestId("product-select-button")
  const updates: string[] = []
  page.on("request", (req) => {
    if (isServerAction(req, isUpdateBody(fixture.lineId, 2))) updates.push(req.postData() ?? "")
  })

  await step("trigger เป็น combobox ชื่อ จำนวน แสดงจำนวนจริง", async () => {
    await page.goto(`/${CC}/cart`)
    await expect(trigger).toHaveAttribute("role", "combobox")
    await expect(trigger).toHaveAccessibleName("จำนวน")
    await expectSelected(trigger, "1")
    await expect(trigger).toHaveText("1")
  })

  await step("เลือก 2 → backend จำนวน 2 และ action ถูกส่ง 1 ครั้ง", async () => {
    await chooseOption(trigger, "2")
    await expect.poll(() => lineQuantity(request, fixture), { message: "จำนวนของ line ตาม Store API" }).toBe(2)
    await expect(trigger).toHaveText("2")
    await page.waitForLoadState("networkidle")
    expect(updates, "server action updateLineItem({ quantity: 2 })").toHaveLength(1)
  })
})

test.describe("AC-49 (ตะกร้า): มือถือ 390×844 แตะ trigger แล้วกล่องรายการอยู่ในจอ", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("product-select-button-options อยู่ในจอทั้งกล่อง เลือกได้ และหน้าไม่ล้นแนวนอน", async ({
    page,
    context,
    request,
    baseURL,
    step,
  }) => {
    test.setTimeout(120_000)
    const fixture = await cartWithOneLine(request, context, baseURL!)
    const trigger = page.getByTestId("product-select-button")
    const options = page.getByTestId("product-select-button-options")

    /** แตะซ้ำจน `aria-expanded="true"` (ก่อน hydrate แตะแล้วไม่เปิด — เหมือน helper `chooseOption` แต่เป็น tap) */
    const tapOpen = async (el: Locator) => {
      await expect(async () => {
        if ((await el.getAttribute("aria-expanded")) !== "true") await el.tap()
        await expect(el).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 })
      }).toPass()
    }

    await step("แตะ trigger → กล่องรายการมองเห็นและอยู่ในจอ", async () => {
      await page.goto(`/${CC}/cart`)
      await tapOpen(trigger)
      await expect(options).toBeVisible()
      const box = (await options.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(390)
      expect(box.y + box.height).toBeLessThanOrEqual(844)
    })

    await step("แตะ item 3 → เลือกได้ backend จำนวน 3 และหน้าไม่ล้นแนวนอน", async () => {
      await options.locator('[data-testid="product-select-button-option"][data-value="3"]').tap()
      await expectSelected(trigger, "3")
      await expect.poll(() => lineQuantity(request, fixture)).toBe(3)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })
  })
})
