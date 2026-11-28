import { Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { createActiveAffiliate } from "./support/affiliate"
import { createVoucher, placeCapturedOrder, waitDelivered } from "./support/evoucher"
import { addAddresses, groupBuyOrder, poolGroup } from "./support/group-buy"
import {
  STOREFRONT_COUNTRY as CC,
  type Customer,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  fulfillAndShip,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { chooseOption } from "./support/select"
import { CARD_PROVIDER, HAS_STRIPE_UI, PROMPTPAY_PROVIDER, checkoutToPayment, continueToReview, fillCard } from "./support/stripe"

// SFUI-19a (spec 09 กฎ 58–61, AC-56, AC-57 — ADR-034 D1/D2): ทุกปุ่มบนหน้าใช้ขนาดมาตรฐานของ shadcn
// size default/icon = 36px (icon 36×36) — ค่าที่คาดคือค่าที่ `buttonVariants` ของ ui/button render จริง (`h-9`/`size-9`);
// `InputGroupButton size="icon-xs"` ภายใน `InputGroupAddon` = 24×24; SFUI-22 (กฎ 79, AC-67 (2)) ขยายเป็นทุก `BUTTON_SELECTOR` ยกเว้นรายการปิดของกฎ 79
test.use({ evidenceTarget: { feature: "storefront-consistency", taskId: "SFUI-19a" } })

const NEED_UI = "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชี Stripe เดียวกัน"

/** testid ของตาราง inventory ข้อ 1–12 (ปุ่มที่ SFUI-19a ถอด override ขนาด) */
const INVENTORY = [
  "submit-delivery-option-button",
  "submit-payment-button",
  "submit-order-button",
  "promptpay-retry-button",
  "order-pay-card-button",
  "order-pay-promptpay-button",
  "go-to-cart-button",
  "promptpay-go-to-cart",
  "review-refunded-go-to-cart",
  "checkout-button",
  "sign-in-button",
  "add-product-button",
  "mobile-cart-button",
  "cancel-button",
  "voucher-copy-button",
  "group-selection-remove",
  "edit-button",
  "free-shipping-nudge-close",
]

// SFUI-22 (spec 09 กฎ 79, AC-67 (2)): วัดทุกปุ่มบนหน้า — `button` (ปุ่มดิบ/ของ Radix), `[data-variant][data-size]` (Button ที่ถูก Slot ของ
// `<…Trigger asChild>` ทับ data-slot และ `Button asChild` บน `<a>`/`<span>` — review 19b) และ `[role="button"]`
// review SFUI-22: root ของ toggle-group (กล่องครอบ chip) ไม่ใช่ปุ่ม — ไม่วัด
const BUTTON_SELECTOR = 'button, [data-variant][data-size]:not([data-slot="toggle-group"]), [role="button"]'

/** รายการปิดของกฎ 79 — ปุ่มที่ไม่อยู่ใต้กฎขนาด (เพิ่มเองไม่ได้: เจอปุ่มอื่นที่ไม่ใช่ 36px = หยุดแจ้ง planner) */
const RULE_79_EXEMPT = [
  '[data-slot="radio-group-item"]',
  '[data-slot="checkbox"]',
  '[data-slot="accordion-trigger"]',
  '[data-slot="select-trigger"]',
  '[data-slot="toggle-group-item"]',
  '[data-testid="nav-menu-button"]',
  '[data-testid="add-address-button"]',
].join(", ")

/** ข้อยกเว้นของกฎ 59/79 ที่วัดแยกเป็น 24×24 */
const ADDON_ICON_XS = '[data-slot="input-group-addon"] [data-size="icon-xs"]'

/**
 * ลิงก์ที่ใช้ `buttonVariants(...)` ตรง (ไม่มี data-variant/data-size — selector ข้างบนไม่จับ; review 19a) นอก inventory:
 * ขนาด default ของ buttonVariants = 36px; `pagination-link` ของ ui/pagination
 */
const BUTTON_VARIANT_LINKS = [
  '[data-testid="hero-cta"]',
  '[data-testid="order-details-link"]',
  '[data-testid="continue-shopping-button"]',
  '[data-testid="group-order-pay-link"]',
  '[data-testid="group-order-details-link"]',
  'a[data-slot="pagination-link"]',
].join(", ")

type Off = { id: string; height: string; width: string; size: string | null }

/** ปุ่มที่มองเห็นแต่ขนาดไม่ตรง (36px / icon 36×36 / icon-xs ใน addon 24×24) — ไม่นับรายการปิดของกฎ 79 */
function offSizeButtons(page: Page): Promise<Off[]> {
  return page.evaluate(
    ({ selector, exempt, addonXs, links }) => {
      const off: Off[] = []
      const els = new Set([
        ...Array.from(document.querySelectorAll<HTMLElement>(selector)),
        ...Array.from(document.querySelectorAll<HTMLElement>(links)),
      ])
      for (const el of els) {
        if (el.getClientRects().length === 0) continue
        const s = getComputedStyle(el)
        if (s.visibility === "hidden") continue
        const xs = el.matches(addonXs)
        if (!xs && el.matches(exempt)) continue
        const size = el.getAttribute("data-size")
        const want = xs ? "24px" : "36px"
        const square = xs || size === "icon"
        if (s.height !== want || (square && s.width !== want)) {
          const id =
            el.getAttribute("data-testid") ??
            `${el.tagName.toLowerCase()}[data-slot=${el.getAttribute("data-slot")}] "${(el.textContent ?? "").trim().slice(0, 30)}"`
          off.push({ id, height: s.height, width: s.width, size })
        }
      }
      return off
    },
    { selector: BUTTON_SELECTOR, exempt: RULE_79_EXEMPT, addonXs: ADDON_ICON_XS, links: BUTTON_VARIANT_LINKS }
  )
}

/**
 * ทุกปุ่มบนหน้าเป็นขนาดมาตรฐาน + testid ของ inventory ที่อยู่ในหน้าสูง 36px (±0.5)
 * (ลิงก์ที่ใช้ `buttonVariants(...)` เช่น `checkout-button`, `go-to-cart-button` ไม่มี `data-slot` — ตรวจผ่านรายการ inventory)
 */
async function expectDefaultButtons(page: Page, where: string) {
  // หน้า checkout มี Stripe.js ที่ส่ง request ต่อเนื่อง — รอ network ว่างไม่เกิน 5 วินาที (ไม่ให้ค้างจนหมดเวลา test)
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined)
  expect(await offSizeButtons(page), `${where}: ปุ่มที่ขนาดไม่ใช่มาตรฐานของ shadcn`).toEqual([])
  for (const id of INVENTORY) {
    for (const el of await page.getByTestId(id).all()) {
      if (!(await el.isVisible())) continue
      // computed height (ไม่ใช่ boundingBox — dropdown/sheet ที่กำลัง animate scale ทำให้กล่องเล็กชั่วคราว)
      const height = await el.evaluate((node) => parseFloat(getComputedStyle(node).height))
      expect(Math.abs(height - 36), `${where}: ${id} สูง ${height}px`).toBeLessThanOrEqual(0.5)
    }
  }
}

async function visit(page: Page, path: string, ready: string) {
  await page.goto(path)
  await expect(page.getByTestId(ready).first()).toBeVisible({ timeout: 30_000 })
}

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]

for (const viewport of VIEWPORTS) {
  test(`AC-56 / AC-67 (${viewport.width}): ทุกปุ่มบนชุดหน้า P + login/register สูง 36px (icon 36×36) ตามขนาดมาตรฐานของ shadcn`, async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(360_000)
    await page.setViewportSize(viewport)
    const desktop = viewport.width >= 1024

    await step("AC-67: หน้า login และ register (ยังไม่ login)", async () => {
      await visit(page, `/${CC}/account`, "login-page")
      await expectDefaultButtons(page, "login")
      await page.getByTestId("login-to-register-button").click()
      await expect(page.getByTestId("register-page")).toBeVisible()
      await expectDefaultButtons(page, "register")
    })

    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const customer: Customer = await createCustomer(request, pk)
    const order = await placeOrder(request, pk, customer)
    await addAddresses(request, pk, customer, [
      { first_name: "Somchai", last_name: "Jaidee", address_1: "1 Sukhumvit Rd", city: "Bangkok", postal_code: "10110", phone: "0812345678" },
    ])
    const cartId = await cartReadyForPayment(request, pk, customer)
    await signInAs(context, baseURL!, customer)
    await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

    await step("หน้าแรก, /store, PDP", async () => {
      await visit(page, `/${CC}`, "nav-cart-link")
      await expectDefaultButtons(page, "หน้าแรก")
      await visit(page, `/${CC}/store`, "products-list")
      await expectDefaultButtons(page, "/store")
      await visit(page, `/${CC}/products/t-shirt`, "add-product-button")
      await expectDefaultButtons(page, "PDP")
      if (viewport.width === 390) await evidence("02-pdp-390")
    })

    await step("/cart มีสินค้า และ cart dropdown เปิด", async () => {
      await visit(page, `/${CC}/cart`, "checkout-button")
      await expectDefaultButtons(page, "/cart")
      if (desktop) {
        await page.getByTestId("nav-cart-link").hover()
        await expect(page.getByTestId("go-to-cart-button")).toBeVisible()
        await expectDefaultButtons(page, "cart dropdown")
        await evidence("01-cart-dropdown-1280")
      }
    })

    await step("checkout step=address|delivery|payment|review", async () => {
      await visit(page, `/${CC}/checkout?step=address`, "submit-address-button")
      await expectDefaultButtons(page, "checkout address")
      await visit(page, `/${CC}/checkout?step=delivery`, "submit-delivery-option-button")
      await expectDefaultButtons(page, "checkout delivery")
      await visit(page, `/${CC}/checkout?step=payment`, "submit-payment-button")
      await expectDefaultButtons(page, "checkout payment")
      // ขั้น review ต้องมี session ของการชำระ — manual payment ของ seed (ไม่ต้องใช้ Stripe)
      const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
      const pc = await request.post(`${BACKEND_URL}/store/payment-collections`, { headers, data: { cart_id: cartId } })
      expect(pc.status(), await pc.text()).toBe(200)
      const ses = await request.post(
        `${BACKEND_URL}/store/payment-collections/${(await pc.json()).payment_collection.id}/payment-sessions`,
        { headers, data: { provider_id: "pp_system_default" } }
      )
      expect(ses.status(), await ses.text()).toBe(200)
      await visit(page, `/${CC}/checkout?step=review`, "submit-order-button")
      await expectDefaultButtons(page, "checkout review")
    })

    await step("/account overview, profile (เปิด edit-panel), addresses (modal เพิ่ม/แก้), orders, order details", async () => {
      await visit(page, `/${CC}/account`, "account-page")
      await expectDefaultButtons(page, "/account")
      await visit(page, `/${CC}/account/profile`, "edit-button")
      await page.getByTestId("edit-button").first().click()
      await expect(page.getByTestId("edit-panel").first()).toHaveAttribute("data-open", "true")
      await expectDefaultButtons(page, "profile edit-panel")
      await visit(page, `/${CC}/account/addresses`, "add-address-button")
      await expectDefaultButtons(page, "addresses")
      await page.getByTestId("add-address-button").click()
      await expect(page.getByTestId("cancel-button")).toBeVisible()
      await expectDefaultButtons(page, "modal เพิ่มที่อยู่")
      await page.getByTestId("cancel-button").click()
      await expect(page.getByTestId("cancel-button")).toHaveCount(0)
      await page.getByTestId("address-edit-button").first().click()
      await expect(page.getByTestId("cancel-button")).toBeVisible()
      await expectDefaultButtons(page, "modal แก้ที่อยู่")
      await page.getByTestId("cancel-button").click()
      await visit(page, `/${CC}/account/orders`, "orders-page-wrapper")
      await expectDefaultButtons(page, "/account/orders")
      await visit(page, `/${CC}/account/orders/details/${order.id}`, "order-details-container")
      await expectDefaultButtons(page, "order details")
    })

    await step("order confirmed", async () => {
      await visit(page, `/${CC}/order/${order.id}/confirmed`, "order-complete-container")
      await expectDefaultButtons(page, "order confirmed")
    })

    await step("/g/<token> (มีรายการที่เลือก → ปุ่มลบ ghost)", async () => {
      const group = await poolGroup(request)
      await visit(page, `/${CC}/g/${group.token}`, "group-options")
      await page.getByTestId("group-options").getByTestId("option-button").filter({ hasText: /^S$/ }).click()
      await chooseOption(page.getByTestId("group-quantity"), "1")
      await page.getByTestId("group-add-variant").click()
      await expect(page.getByTestId("group-selection-remove")).toBeVisible()
      await expectDefaultButtons(page, "/g/<token>")
    })

    await step("/account/vouchers ที่มี voucher", async () => {
      const voucher = await createVoucher(request, admin, 1, { expires_at: "2099-12-31T05:00:00.000Z" })
      const voucherOrder = await placeCapturedOrder(request, admin, pk, customer, voucher.variantId, 1)
      await waitDelivered(request, admin, voucherOrder, 1)
      await visit(page, `/${CC}/account/vouchers`, "voucher-copy-button")
      await expectDefaultButtons(page, "/account/vouchers")
    })

    await step("หน้าจ่าย order ค้างจ่าย (order กลุ่มที่สำเร็จแล้ว)", async () => {
      const pending = await groupBuyOrder(request, true)
      await context.clearCookies()
      await signInAs(context, baseURL!, pending.customer)
      await visit(page, `/${CC}/account/orders/${pending.orderId}/pay`, "order-pay-page")
      await expectDefaultButtons(page, "order pay")
      if (HAS_STRIPE_UI) {
        await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
        await expect(page.getByTestId("order-pay-card-button")).toBeVisible({ timeout: 30_000 })
        await expectDefaultButtons(page, "order pay (บัตร)")
        await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()
        await expect(page.getByTestId("order-pay-promptpay-button")).toBeVisible({ timeout: 30_000 })
        await expectDefaultButtons(page, "order pay (พร้อมเพย์)")
      }
    })
  })
}

test.describe("AC-57: ปุ่มจ่ายเงิน 36px ใช้งานได้กับ Stripe test จริง", () => {
  test.skip(!HAS_STRIPE_UI, NEED_UI)

  async function toPayment(page: Page, context: import("@playwright/test").BrowserContext, request: import("@playwright/test").APIRequestContext, baseURL: string) {
    const pk = await publishableKey(request, await adminHeaders(request))
    const customer = await createCustomer(request, pk)
    await signInAs(context, baseURL, customer)
    await checkoutToPayment(page, context, request, pk, customer, CC, "t-shirt")
  }

  /** จุดกลางของปุ่มคือปุ่มเอง/ลูกของปุ่ม (ไม่ใช่ iframe ของ Stripe ที่อยู่ใกล้) */
  async function expectHitOnButton(page: Page, testId: string) {
    const button = page.getByTestId(testId)
    await button.scrollIntoViewIfNeeded()
    expect((await button.boundingBox())!.height).toBe(36)
    const onButton = await button.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return !!top && el.contains(top)
    })
    expect(onButton, `elementFromPoint ที่จุดกลางของ ${testId}`).toBe(true)
  }

  test("บัตร 3DS (4000 0027 6000 3184) → submit-order-button 36px → challenge → คำสั่งซื้อสำเร็จ", async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    test.setTimeout(150_000)
    await toPayment(page, context, request, baseURL!)
    await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
    await fillCard(page, "4000002760003184")
    await expect(page.getByTestId("submit-payment-button")).toBeEnabled({ timeout: 30_000 })
    await expectHitOnButton(page, "submit-payment-button")
    await continueToReview(page)
    await expectHitOnButton(page, "submit-order-button")
    await page.getByTestId("submit-order-button").click()
    const challenge = page.frameLocator('iframe[src*="three-ds-2-challenge"]').frameLocator("#challengeFrame")
    await expect(challenge.locator("#test-source-authorize-3ds")).toBeVisible({ timeout: 30_000 })
    // ปุ่มใน modal รับคลิกหลัง animation จบ — คลิกซ้ำจน modal ปิด (แนวเดียวกับ payments.spec AC-2)
    await expect(async () => {
      await challenge.locator("#test-source-authorize-3ds").click({ timeout: 5_000 })
      await expect(challenge.locator("#test-source-authorize-3ds")).toBeHidden({ timeout: 5_000 })
    }).toPass({ timeout: 45_000 })
    await expect(page.getByTestId("order-complete-container")).toBeVisible({ timeout: 60_000 })
    await evidence("03-card-3ds-order-confirmed")
  })

  test("พร้อมเพย์ → ปุ่มของพร้อมเพย์ 36px → กดแล้ว QR แสดง", async ({ page, context, request, baseURL, evidence }) => {
    test.setTimeout(150_000)
    await toPayment(page, context, request, baseURL!)
    await page.getByTestId(`payment-option-${PROMPTPAY_PROVIDER}`).click()
    await continueToReview(page)
    await expectHitOnButton(page, "submit-order-button")
    await page.getByTestId("submit-order-button").click()
    await expect(page.getByTestId("promptpay-qr")).toBeVisible({ timeout: 30_000 })
    await evidence("04-promptpay-qr")
  })
})

// SFUI-19b (spec 09 กฎ 60, AC-59): ปุ่ม/ลิงก์ที่ไม่ใช่ shadcn ในตาราง inventory ข้อ 14–20 เป็น `Button` ตามบทบาท (variant) ขนาด default/icon
const THAI_LABEL = /[\u0E00-\u0E7F]/

/** `slot`: Button ที่เป็นลูกของ `<…Trigger asChild>` ได้ data-slot ของ trigger ทับ (Slot ของ Radix รวม props) */
async function expectButton(page: Page, testId: string, variant: string, size = "default", slot = "button") {
  const el = page.getByTestId(testId).first()
  await expect(el, testId).toBeVisible()
  await expect(el, testId).toHaveAttribute("data-slot", slot)
  await expect(el, testId).toHaveAttribute("data-variant", variant)
  await expect(el, testId).toHaveAttribute("data-size", size)
  const { height, width } = await el.evaluate((n) => ({
    height: getComputedStyle(n).height,
    width: getComputedStyle(n).width,
  }))
  expect(height, `${testId} สูง`).toBe("36px")
  if (size === "icon") {
    expect(width, `${testId} กว้าง`).toBe("36px")
    expect(await el.getAttribute("aria-label"), `${testId} aria-label ไทย`).toMatch(THAI_LABEL)
  }
}

const STYLE_KEYS = ["height", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "fontSize", "color"] as const
const styleOf = (page: Page, testId: string) =>
  page.getByTestId(testId).first().evaluate((n, keys) => {
    const s = getComputedStyle(n)
    return Object.fromEntries(keys.map((k) => [k, s[k as keyof CSSStyleDeclaration] as string]))
  }, STYLE_KEYS as unknown as string[])

test("AC-59: ปุ่ม/ลิงก์ข้อ 14–20 เป็น Button ของ shadcn ตามบทบาท สูง 36px (icon 36×36 + aria-label ไทย)", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const order = await placeOrder(request, pk, customer)
  await fulfillAndShip(request, admin, order.id)
  await addAddresses(request, pk, customer, [
    { first_name: "Somchai", last_name: "Jaidee", address_1: "1 Sukhumvit Rd", city: "Bangkok", postal_code: "10110", phone: "0812345678" },
  ])
  const cartId = await cartReadyForPayment(request, pk, customer)
  await signInAs(context, baseURL!, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
  let logoutStyle: Record<string, string> = {}

  await step("order details: order-return-button เป็น <a> outline และ Tab หยุด 1 ครั้ง", async () => {
    await visit(page, `/${CC}/account/orders/details/${order.id}`, "order-return-button")
    await expectButton(page, "order-return-button", "outline")
    const link = page.getByTestId("order-return-button")
    expect(await link.evaluate((n) => n.tagName)).toBe("A")
    expect(await link.evaluate((n) => n.querySelectorAll("a, button, input, [tabindex]").length), "ไม่มี element ที่ focus ได้ซ้อนข้างใน").toBe(0)
  })

  await step("account overview: open-order-button icon; logout-button ghost", async () => {
    await visit(page, `/${CC}/account`, "open-order-button")
    await expectButton(page, "open-order-button", "ghost", "icon")
    const logout = page.locator('[data-testid="logout-button"]:visible')
    await expect(logout).toHaveCount(1)
    await expect(logout).toHaveAttribute("data-variant", "ghost")
    expect(await logout.evaluate((n) => getComputedStyle(n).height)).toBe("36px")
    logoutStyle = await logout.evaluate((n, keys) => {
      const s = getComputedStyle(n)
      return Object.fromEntries(keys.map((k) => [k, s[k as keyof CSSStyleDeclaration] as string]))
    }, STYLE_KEYS as unknown as string[])
  })

  await step("addresses: address-edit-button / address-delete-button ghost", async () => {
    await visit(page, `/${CC}/account/addresses`, "address-edit-button")
    await expectButton(page, "address-edit-button", "ghost", "default", "dialog-trigger")
    await expectButton(page, "address-delete-button", "ghost")
  })

  await step("cart: product-delete-button icon; add-discount-button link; cart dropdown: cart-item-remove-button ghost", async () => {
    await visit(page, `/${CC}/cart`, "product-delete-button")
    await expectButton(page, "product-delete-button", "ghost", "icon")
    await expectButton(page, "add-discount-button", "link")
    await page.getByTestId("nav-cart-link").hover()
    await expect(page.getByTestId("nav-cart-dropdown")).toBeVisible()
    // cart-item-remove-button มีข้อความ "ลบ" → ghost size default (กฎ 60 / inventory 18: size="icon" เมื่อไม่มีข้อความ)
    await expectButton(page, "cart-item-remove-button", "ghost")
  })

  await step("checkout review: edit-address-button / edit-delivery-button / edit-payment-button link", async () => {
    const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
    const pc = await request.post(`${BACKEND_URL}/store/payment-collections`, { headers, data: { cart_id: cartId } })
    expect(pc.status(), await pc.text()).toBe(200)
    const ses = await request.post(
      `${BACKEND_URL}/store/payment-collections/${(await pc.json()).payment_collection.id}/payment-sessions`,
      { headers, data: { provider_id: "pp_system_default" } }
    )
    expect(ses.status(), await ses.text()).toBe(200)
    await visit(page, `/${CC}/checkout?step=review`, "submit-order-button")
    for (const id of ["edit-address-button", "edit-delivery-button", "edit-payment-button"]) {
      await expectButton(page, id, "link")
    }
  })

  await step("affiliate portal: affiliate-logout ghost สไตล์เท่า logout-button", async () => {
    const affiliate = await createActiveAffiliate(request, admin, { prefix: "e2e-sfui19b" })
    await context.clearCookies()
    await page.goto(`/${CC}/affiliate/login`)
    await page.getByTestId("affiliate-login-email").fill(affiliate.email)
    await page.getByTestId("affiliate-login-password").fill(affiliate.password)
    await page.getByTestId("affiliate-login-submit").click()
    await expect(page.getByTestId("affiliate-logout")).toBeVisible({ timeout: 15_000 })
    await expectButton(page, "affiliate-logout", "ghost")
    expect(await styleOf(page, "affiliate-logout")).toEqual(logoutStyle)
  })
})
