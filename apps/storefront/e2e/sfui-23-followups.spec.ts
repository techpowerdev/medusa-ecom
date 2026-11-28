import { APIRequestContext, Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { addAddresses } from "./support/group-buy"
import {
  STOREFRONT_COUNTRY as CC,
  type Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { addToCartFromPdp } from "./support/server-action"

// SFUI-23 (spec 09 กฎ 81–85, AC-72–75 — เก็บตกจาก qa ปลาย stack รอบ 50): gap ฟอร์ม affiliate, popup ค่าส่งฟรีไม่ล้นจอ + ลิงก์เป็น Button,
// แนวข้อความของปุ่ม ghost/link (margin ติดลบ) และประโยคลิงก์สลับ login/สมัคร — ตำแหน่งข้อความวัดจาก Range ของ text node (ไม่ใช่กล่องปุ่มที่รวม padding)
test.use({ evidenceTarget: { feature: "storefront-consistency", taskId: "SFUI-23" } })

type Rect = { left: number; right: number; top: number; bottom: number }

/** กล่องของ text node แรกที่ไม่ว่างใน element (document.createRange + selectNodeContents) */
const textRect = (locator: Locator): Promise<Rect> =>
  locator.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    })
    const node = walker.nextNode()
    if (!node) throw new Error(`ไม่มีข้อความใน ${el.outerHTML.slice(0, 80)}`)
    const range = document.createRange()
    range.selectNodeContents(node)
    const r = range.getBoundingClientRect()
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
  })

const css = (locator: Locator, props: string[]) =>
  locator.evaluate((el, keys) => {
    const s = getComputedStyle(el)
    return Object.fromEntries(keys.map((k) => [k, s.getPropertyValue(k)]))
  }, props)

/** ปุ่มยังเป็นขนาด default ของ shadcn: data-size="default", สูง 36px, padding แนวนอน 16px (กฎ 84 — margin ไม่แตะ padding/พื้นที่กด) */
async function expectDefaultButton(button: Locator, where: string) {
  await expect(button, where).toHaveAttribute("data-size", "default")
  expect(await css(button, ["height", "padding-left", "padding-right"]), where).toEqual({
    height: "36px",
    "padding-left": "16px",
    "padding-right": "16px",
  })
}

/** ส่งฟรีตาม `item_total` — seed ไม่มี จึงสร้าง option ของ test (แนวเดียวกับ core-4e-checkout-polish) แล้วลบหลังจบ */
async function createFreeShippingOption(request: APIRequestContext, admin: Headers): Promise<string> {
  const { shipping_options } = await (
    await request.get(`${BACKEND_URL}/admin/shipping-options?fields=id,name,provider_id,service_zone_id,shipping_profile_id&limit=100`, {
      headers: admin,
    })
  ).json()
  const standard = shipping_options.find((o: { name: string }) => o.name === "Standard")
  expect(standard, "Standard shipping option").toBeTruthy()
  const stamp = Date.now()
  const res = await request.post(`${BACKEND_URL}/admin/shipping-options`, {
    headers: admin,
    data: {
      name: `SFUI-23 nudge ${stamp}`,
      price_type: "flat",
      provider_id: standard.provider_id,
      service_zone_id: standard.service_zone_id,
      shipping_profile_id: standard.shipping_profile_id,
      type: { label: "SFUI-23 nudge", description: "SFUI-23 nudge", code: `sfui23-nudge-${stamp}` },
      prices: [
        { currency_code: "thb", amount: 100 },
        { currency_code: "thb", amount: 0, rules: [{ attribute: "item_total", operator: "gt", value: 1_000_000 }] },
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

test("AC-72: ฟอร์ม login/สมัคร affiliate ระยะระหว่างช่อง 16px (กฎ 81)", async ({ page, step }) => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await step(`${viewport.width}: row-gap ของ <form> ทั้งสอง = 16px`, async () => {
      await page.setViewportSize(viewport)
      await page.goto(`/${CC}/affiliate/login`)
      for (const id of ["affiliate-login-email", "affiliate-register-email"]) {
        const form = page.locator("form").filter({ has: page.getByTestId(id) })
        await expect(form).toHaveCount(1)
        expect((await css(form, ["row-gap"]))["row-gap"], id).toBe("16px")
      }
    })
  }
})

test("AC-73: popup ค่าส่งฟรีไม่ล้นจอ 375/390, ≥ 640px หน้าตาเดิม, ลิงก์เป็น Button ghost/secondary ที่มี focus ring (กฎ 82–83)", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const optionId = await createFreeShippingOption(request, admin)
  try {
    const customer = await createCustomer(request, pk)
    await signInAs(context, baseURL!, customer)
    await page.goto(`/${CC}/products/t-shirt`)
    await addToCartFromPdp(page, { request, pk, customer })

    const popup = page.getByTestId("free-shipping-nudge-popup")
    const close = page.getByTestId("free-shipping-nudge-close")
    const cartLink = page.getByTestId("free-shipping-nudge-cart-link")
    const storeLink = page.getByTestId("free-shipping-nudge-store-link")

    for (const viewport of [
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 1280, height: 800 },
    ]) {
      await step(`${viewport.width}: popup และทุก element ข้างในอยู่ในจอ`, async () => {
        await page.setViewportSize(viewport)
        await page.goto(`/${CC}/store`)
        await expect(popup).toBeVisible()
        if (viewport.width === 375) await evidence("01-free-shipping-popup-375")
        await expect(cartLink).toBeVisible()
        const overflow = await popup.evaluate((root) => {
          const vw = window.innerWidth
          return [root, ...Array.from(root.querySelectorAll("*"))]
            .filter((el) => el.checkVisibility() && el.getBoundingClientRect().width > 0)
            .map((el) => ({ el, r: el.getBoundingClientRect() }))
            .filter(({ r }) => r.left < -0.5 || r.right > vw + 0.5)
            .map(({ el, r }) => `${el.tagName}${el.getAttribute("data-testid") ? `[${el.getAttribute("data-testid")}]` : ""} ${r.left}–${r.right}`)
        })
        expect(overflow, "element ที่ล้นจอ").toEqual([])
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

        const content = popup.locator(":scope > div").filter({ has: cartLink })
        await expect(content).toHaveCount(1)
        expect(await content.evaluate((el) => el.scrollWidth <= el.clientWidth), "กล่องเนื้อหาไม่ล้นแนวนอน").toBe(true)
        if (viewport.width === 1280) {
          const box = await content.evaluate((el) => {
            const r = el.getBoundingClientRect()
            return { width: r.width, right: r.right, vw: window.innerWidth }
          })
          expect(Math.abs(box.width - 400), `กว้าง ${box.width}`).toBeLessThanOrEqual(0.5)
          expect(Math.abs(box.right - (box.vw - 20)), `ขอบขวา ${box.right}`).toBeLessThanOrEqual(0.5)
        }
        if (viewport.width === 390) {
          const c = (await close.boundingBox())!
          const y = c.y + c.height / 2
          // x=10 นอก popup; x ข้างซ้ายปุ่มปิด (ภายใน root ที่กว้างเต็มจอ) ต้องทะลุไปที่หน้า (pointer-events-none ของ root)
          for (const x of [10, c.x - 20]) {
            const inside = await popup.evaluate((root, [px, py]) => root.contains(document.elementFromPoint(px, py)), [x, y])
            expect(inside, `elementFromPoint(${x}, ${y}) อยู่ใน popup`).toBe(false)
          }
        }
      })
    }

    await step("ลิงก์สองตัว = <a> Button ghost/secondary size default 36px, href /th/cart และ /th/store", async () => {
      for (const [link, variant, href] of [
        [cartLink, "ghost", `/${CC}/cart`],
        [storeLink, "secondary", `/${CC}/store`],
      ] as const) {
        expect(await link.evaluate((n) => n.tagName)).toBe("A")
        await expect(link).toHaveAttribute("data-slot", "button")
        await expect(link).toHaveAttribute("data-variant", variant)
        await expect(link).toHaveAttribute("data-size", "default")
        expect((await css(link, ["height"])).height).toBe("36px")
        expect(await link.getAttribute("href")).toMatch(new RegExp(`${href}$`))
      }
    })

    await step("Tab จากปุ่มปิด → ลิงก์ตะกร้า → ลิงก์สินค้า ทั้งสองมี focus ring", async () => {
      await close.focus()
      for (const link of [cartLink, storeLink]) {
        await page.keyboard.press("Tab")
        await expect(link).toBeFocused()
        await expect.poll(async () => (await css(link, ["box-shadow"]))["box-shadow"]).not.toBe("none")
      }
    })

    // PDP เป็น force-static (layout ไม่เห็น cart → ไม่มี popup) จึงเริ่มจาก /cart
    await step("กด free-shipping-nudge-store-link จาก /cart → /th/store", async () => {
      await page.goto(`/${CC}/cart`)
      await expect(storeLink).toBeVisible()
      await storeLink.click()
      await expect(page).toHaveURL(new RegExp(`/${CC}/store$`))
    })
  } finally {
    const removed = await request.delete(`${BACKEND_URL}/admin/shipping-options/${optionId}`, { headers: admin })
    expect(removed.ok(), `ลบ nudge option ของ test: ${removed.status()}`).toBe(true)
  }
})

/** ancestor ที่ใกล้ที่สุดซึ่ง justify-content = space-between (แถวหัวข้อของขั้น checkout) — กล่องของมัน */
const spaceBetweenRow = (locator: Locator): Promise<Rect> =>
  locator.evaluate((el) => {
    let p = el.parentElement
    while (p && getComputedStyle(p).justifyContent !== "space-between") p = p.parentElement
    if (!p) throw new Error("ไม่พบแถว space-between")
    const r = p.getBoundingClientRect()
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
  })

const near = (a: number, b: number, where: string) => expect(Math.abs(a - b), `${where}: ${a} vs ${b}`).toBeLessThanOrEqual(1)

test("AC-74: ข้อความของปุ่ม ghost/link ในตารางกฎ 84 ตรงแนวคอลัมน์ (checkout review, เมนูบัญชี)", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(240_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await addAddresses(request, pk, customer, [
    { first_name: "Somchai", last_name: "Jaidee", address_1: "1 Sukhumvit Rd", city: "Bangkok", postal_code: "10110", phone: "0812345678" },
  ])
  const cartId = await cartReadyForPayment(request, pk, customer)
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const pc = await request.post(`${BACKEND_URL}/store/payment-collections`, { headers, data: { cart_id: cartId } })
  expect(pc.status(), await pc.text()).toBe(200)
  const ses = await request.post(`${BACKEND_URL}/store/payment-collections/${(await pc.json()).payment_collection.id}/payment-sessions`, {
    headers,
    data: { provider_id: "pp_system_default" },
  })
  expect(ses.status(), await ses.text()).toBe(200)
  await signInAs(context, baseURL!, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await step(`${viewport.width}: checkout review — แก้ไข ×3 ชิดขวาแถวหัวข้อ, เพิ่มโค้ดส่วนลด ชิดซ้าย <form>`, async () => {
      await page.setViewportSize(viewport)
      await page.goto(`/${CC}/checkout?step=review`)
      await expect(page.getByTestId("submit-order-button")).toBeVisible({ timeout: 30_000 })
      for (const id of ["edit-address-button", "edit-delivery-button", "edit-payment-button"]) {
        const button = page.getByTestId(id)
        await expectDefaultButton(button, id)
        near((await textRect(button)).right, (await spaceBetweenRow(button)).right, `${id} ขอบขวาข้อความ`)
      }
      const discount = page.locator('[data-testid="add-discount-button"]:visible')
      await expect(discount).toHaveCount(1)
      await expectDefaultButton(discount, "add-discount-button")
      const formLeft = await discount.evaluate((el) => el.closest("form")!.getBoundingClientRect().left)
      near((await textRect(discount)).left, formLeft, "add-discount-button ขอบซ้ายข้อความ")
    })
  }

  await step("390: logout-button ในเมนูบัญชีมือถือ ข้อความตรง icon ของ profile-link", async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/${CC}/account`)
    const nav = page.getByTestId("mobile-account-nav")
    const logout = nav.getByTestId("logout-button")
    await expect(logout).toBeVisible()
    await expectDefaultButton(logout, "logout-button มือถือ")
    const iconLeft = await nav.getByTestId("profile-link").locator("svg").first().evaluate((el) => el.getBoundingClientRect().left)
    near((await textRect(logout)).left, iconLeft, "logout-button มือถือ")
    await evidence("03-mobile-account-nav-390")
  })

  await step("1280: logout-button ใน account-nav ข้อความตรง overview-link", async () => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/${CC}/account`)
    const nav = page.getByTestId("account-nav")
    const logout = nav.getByTestId("logout-button")
    await expect(logout).toBeVisible()
    await expectDefaultButton(logout, "logout-button desktop")
    near((await textRect(logout)).left, (await textRect(nav.getByTestId("overview-link"))).left, "logout-button desktop")
  })
})

async function registerExistingEmail(page: Page, email: string, password: string) {
  await page.goto(`/${CC}/account`)
  await page.getByTestId("login-to-register-button").click()
  const form = page.getByTestId("register-page")
  await expect(form).toBeVisible()
  await form.getByTestId("first-name-input").fill("สมชาย")
  await form.getByTestId("last-name-input").fill("ใจดี")
  await form.getByTestId("email-input").fill(email)
  await form.getByTestId("password-input").fill(password)
  await form.getByTestId("register-button").click()
  await expect(page.getByTestId("register-login-link")).toBeVisible()
}

test("AC-74: register-login-link ข้อความตรงแนวข้อความ error ใน AlertDescription (1280, 375)", async ({ page, request, step }) => {
  const customer = await createCustomer(request, await publishableKey(request, await adminHeaders(request)))
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 375, height: 812 },
  ]) {
    await step(`${viewport.width}: ขอบซ้ายข้อความ register-login-link = ขอบซ้ายข้อความ <span>`, async () => {
      await page.setViewportSize(viewport)
      await registerExistingEmail(page, customer.email, customer.password)
      const link = page.getByTestId("register-login-link")
      await expectDefaultButton(link, "register-login-link")
      const span = page.getByTestId("register-email-exists").locator('[data-slot="alert-description"] > span')
      near((await textRect(link)).left, (await textRect(span)).left, "register-login-link")
    })
  }
})

test("AC-75: ประโยคลิงก์สลับ login/สมัคร ขนาด 14px เดียวกับปุ่ม ไม่มี '.' เว้นด้วย padding ของปุ่ม (กฎ 85)", async ({ page, step, evidence }) => {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
  ]) {
    for (const [view, id, text] of [
      ["login", "login-to-register-button", "ยังไม่เป็นสมาชิก?สมัครสมาชิก"],
      ["register", "register-to-login-button", "เป็นสมาชิกอยู่แล้ว?เข้าสู่ระบบ"],
    ] as const) {
      await step(`${viewport.width} ${view}: ${id}`, async () => {
        await page.setViewportSize(viewport)
        if (view === "login") await page.goto(`/${CC}/account`)
        else await page.getByTestId("login-to-register-button").click()
        const button = page.getByTestId(id)
        await expect(button).toBeVisible()
        const parent = button.locator("..")
        const info = await parent.evaluate((el) => ({
          text: el.textContent?.trim(),
          textNodes: Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).length,
          box: el.getBoundingClientRect().toJSON() as DOMRect,
          vw: window.innerWidth,
        }))
        expect(info.text).toBe(text)
        expect(info.textNodes, "text node ตรงใน element พ่อ (ช่องว่าง/จุด)").toBe(0)
        expect(info.box.left).toBeGreaterThanOrEqual(0)
        expect(info.box.right).toBeLessThanOrEqual(info.vw)
        const sentence = parent.locator(":scope > span")
        await expect(sentence).toHaveCount(1)
        expect((await css(sentence, ["font-size"]))["font-size"]).toBe("14px")
        const { "font-size": buttonSize, "padding-left": paddingLeft } = await css(button, ["font-size", "padding-left"])
        expect(buttonSize).toBe("14px")
        const s = await textRect(sentence)
        const b = await textRect(button)
        near(b.left - s.right, parseFloat(paddingLeft), "ระยะประโยค → ข้อความลิงก์")
        near((s.top + s.bottom) / 2, (b.top + b.bottom) / 2, "กึ่งกลางแนวตั้ง")
        if (viewport.width === 375 && view === "login") await evidence("02-auth-toggle-375")
      })
    }
  }
})
