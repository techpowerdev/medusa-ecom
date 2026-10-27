import type { APIRequestContext, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"

// CORE-19a: spec 01 AC-62 (กฎข้อ 34), AC-63 — หา element ด้วย data-testid เท่านั้น
// ข้อมูลตั้งต้นจาก seed (CORE-2): region Thailand, t-shirt (มีหลาย variant)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-19a" } })

const PRODUCT = "t-shirt"

/** ตัวเลขใน nav-cart-link (ข้อความไทย "ตะกร้า (n)") */
const navCount = (text: string | null) => Number(/\((\d+)\)/.exec(text ?? "")?.[1] ?? NaN)
const shownCount = async (page: Page) =>
  navCount(await page.getByTestId("nav-cart-link").textContent())

const markNoReload = (page: Page) =>
  page.evaluate(() => {
    ;(window as unknown as { __core19aNoReload: boolean }).__core19aNoReload = true
  })
const notReloaded = (page: Page) =>
  page.evaluate(() => (window as unknown as { __core19aNoReload?: boolean }).__core19aNoReload === true)

const removeFirstInDropdown = async (page: Page) => {
  await page.getByTestId("nav-cart-link").hover()
  await page.getByTestId("nav-cart-dropdown").getByTestId("cart-item").first().getByRole("button").click()
}

async function newCustomer(request: APIRequestContext) {
  const pk = await publishableKey(request, await adminHeaders(request))
  return { pk, customer: await createCustomer(request, pk) }
}

/** ล็อกอินผ่านฟอร์มของ storefront (วิธีเดียวกับ QA ของ CORE-4b / PR #118) */
async function uiLogin(page: Page, c: Customer) {
  await page.goto(`/${CC}/account`)
  await page.getByTestId("email-input").fill(c.email)
  await page.getByTestId("password-input").fill(c.password)
  await page.getByTestId("sign-in-button").click()
  await expect(page.getByTestId("login-page")).toHaveCount(0, { timeout: 15_000 })
}

/** เพิ่มสินค้าจาก PDP ทีละ size รอให้ server action ของ add-to-cart ตอบก่อนกดครั้งถัดไป */
async function uiAddSizes(page: Page, sizes: string[]) {
  await page.goto(`/${CC}/products/${PRODUCT}`)
  for (const size of sizes) {
    await page.getByTestId("product-options").getByTestId("option-button").filter({ hasText: size }).click()
    const done = page.waitForResponse((r) => r.request().headers()["next-action"] !== undefined)
    await page.getByTestId("add-product-button").click()
    await done
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
  }
}

for (const path of ["", "/store", `/products/${PRODUCT}`]) {
  test(`AC-62: ลบ line ใน cart dropdown → ตัวนับใน nav เป็น 1 โดยไม่ reload (/${CC}${path})`, async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const customer = await createCustomer(request, pk)
    const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }

    await step("เตรียม cart ของลูกค้าที่มี 2 line (qty 1, 1) และล็อกอิน", async () => {
      const { regions } = await (await request.get(`${BACKEND_URL}/store/regions`, { headers })).json()
      const region = regions.find((r: { countries: { iso_2: string }[] }) =>
        r.countries.some((c) => c.iso_2 === CC)
      )
      const created = await request.post(`${BACKEND_URL}/store/carts`, {
        headers,
        data: { region_id: region.id },
      })
      expect(created.status(), "create cart").toBe(200)
      const cartId = (await created.json()).cart.id
      const products = await request.get(
        `${BACKEND_URL}/store/products?handle=${PRODUCT}&fields=id,*variants`,
        { headers }
      )
      const [product] = (await products.json()).products
      expect(product.variants.length, "seed t-shirt มีอย่างน้อย 2 variant").toBeGreaterThanOrEqual(2)
      for (const variant of product.variants.slice(0, 2)) {
        const res = await request.post(`${BACKEND_URL}/store/carts/${cartId}/line-items`, {
          headers,
          data: { variant_id: variant.id, quantity: 1 },
        })
        expect(res.status(), "add line item").toBe(200)
      }
      await signInAs(context, baseURL!, customer)
      await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
    })

    await step("เปิดหน้าแล้วตัวนับใน nav เป็น 2", async () => {
      await page.goto(`/${CC}${path}`)
      await expect
        .poll(async () => navCount(await page.getByTestId("nav-cart-link").textContent()))
        .toBe(2)
    })

    // ถ้าหน้า reload ระหว่างลบ marker นี้จะหาย
    await page.evaluate(() => {
      ;(window as unknown as { __core19aNoReload: boolean }).__core19aNoReload = true
    })

    await step("เปิด cart dropdown แล้วกดลบ line หนึ่ง → ตัวนับเป็น 1 ภายใน 5 วินาที", async () => {
      await page.getByTestId("nav-cart-link").hover()
      const dropdown = page.getByTestId("nav-cart-dropdown")
      await expect(dropdown.getByTestId("cart-item")).toHaveCount(2)
      await dropdown.getByTestId("cart-item").first().getByRole("button").click()
      await expect
        .poll(async () => navCount(await page.getByTestId("nav-cart-link").textContent()), {
          timeout: 5000,
        })
        .toBe(1)
      expect(
        await page.evaluate(
          () => (window as unknown as { __core19aNoReload?: boolean }).__core19aNoReload
        ),
        "หน้าไม่ถูก reload"
      ).toBe(true)
      if (path === "") await evidence("01-nav-cart-count-after-remove")
    })
  })
}

// root cause ของ D-1 (QA PR #118): หลัง mutation (server action) storefront ส่ง event `medusa:cart-updated` แล้ว CartDropdown
// เรียก retrieveCart (server action ตัวถัดไป) ซึ่งเริ่มก่อน response ของ mutation ปิด stream — revalidateTag ของ mutation ถูกรอ
// ผ่าน waitUntil ท้าย stream จึงแข่งกับการอ่าน data cache ของ Next (`force-cache`) ถ้าอ่านก่อนได้ cart ก่อน mutation (ช้าไปหนึ่งครั้ง)
// test นี้ทำให้เงื่อนไขแน่นอน: เปลี่ยน cart ทาง backend โดยตรง (ไม่มี revalidateTag) แล้วส่ง event → dropdown ต้องอ่าน cart ล่าสุด
// ไม่ใช่ค่าใน data cache
for (const path of ["", `/products/${PRODUCT}`]) {
  test(`AC-62 (root cause): หลัง event medusa:cart-updated ตัวนับอ่าน cart ล่าสุดจาก backend ไม่ใช่ data cache ของ Next (/${CC}${path})`, async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    const { pk, customer } = await newCustomer(request)
    const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
    const { regions } = await (await request.get(`${BACKEND_URL}/store/regions`, { headers })).json()
    const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === CC))
    const cartId = (await (await request.post(`${BACKEND_URL}/store/carts`, { headers, data: { region_id: region.id } })).json()).cart.id
    const products = await request.get(`${BACKEND_URL}/store/products?handle=${PRODUCT}&fields=id,*variants`, { headers })
    const [product] = (await products.json()).products
    for (const variant of product.variants.slice(0, 2)) {
      const res = await request.post(`${BACKEND_URL}/store/carts/${cartId}/line-items`, {
        headers,
        data: { variant_id: variant.id, quantity: 1 },
      })
      expect(res.status(), "add line item").toBe(200)
    }
    await signInAs(context, baseURL!, customer)
    await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

    await page.goto(`/${CC}${path}`)
    // ตัวนับ 2 = โหลด cart ครั้งแรกเสร็จแล้ว (ก่อนแก้: ค่านี้อยู่ใน data cache ของ Next ด้วย tag `carts-<cache id>`)
    await expect.poll(() => shownCount(page)).toBe(2)

    const { cart } = await (await request.get(`${BACKEND_URL}/store/carts/${cartId}`, { headers })).json()
    const del = await request.delete(`${BACKEND_URL}/store/carts/${cartId}/line-items/${cart.items[0].id}`, { headers })
    expect(del.status(), "delete line item ทาง backend").toBe(200)

    await markNoReload(page)
    await page.evaluate(() => window.dispatchEvent(new Event("medusa:cart-updated")))
    await expect.poll(() => shownCount(page), { timeout: 5000 }).toBe(1)
    expect(await notReloaded(page), "หน้าไม่ถูก reload").toBe(true)
  })
}

// AC-62 แบบที่ QA ทำซ้ำ D-1 ได้ (PR #118): ล็อกอินผ่าน UI เพิ่มสินค้าจาก PDP แล้วลบใน dropdown บน PDP (static) ทันที
for (const sizes of [["S", "M"], ["S"]]) {
  test(`AC-62 (UI flow, D-1): เพิ่ม ${sizes.join("+")} บน PDP แล้วลบ line หนึ่งใน dropdown โดยไม่ navigate → ${sizes.length - 1}`, async ({
    page,
    request,
    step,
  }) => {
    const { customer } = await newCustomer(request)
    await step("ล็อกอินผ่าน UI แล้วเพิ่มสินค้าจาก PDP", async () => {
      await uiLogin(page, customer)
      await uiAddSizes(page, sizes)
      await expect.poll(() => shownCount(page), { timeout: 5000 }).toBe(sizes.length)
    })
    await step("ลบ line หนึ่งใน dropdown → ตัวนับลดภายใน 5 วินาที โดยไม่ reload", async () => {
      await markNoReload(page)
      await removeFirstInDropdown(page)
      await expect.poll(() => shownCount(page), { timeout: 5000 }).toBe(sizes.length - 1)
      await expect(page.getByTestId("nav-cart-dropdown").getByTestId("cart-item")).toHaveCount(sizes.length - 1)
      expect(await notReloaded(page), "หน้าไม่ถูก reload").toBe(true)
    })
  })
}

test.describe("viewport 375×812", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test("AC-63: search drawer + ข้อความ 200 ตัวอักษรไม่มีช่องว่าง ไม่ล้นจอ/ไม่ล้น drawer", async ({
    page,
    step,
    evidence,
  }) => {
    const query = "ก".repeat(100) + "x".repeat(100)

    await step("เปิด search drawer แล้วพิมพ์ข้อความ 200 ตัวอักษร", async () => {
      await page.goto(`/${CC}`)
      await page.getByTestId("nav-search-button").click()
      await expect(page.getByTestId("search-drawer")).toBeVisible()
      await page.getByTestId("search-input").fill(query)
      // รอให้ผลค้นหา (ไม่พบสินค้า — แสดงข้อความที่มีคำค้น) แสดงก่อนวัด
      await expect(page.getByTestId("search-no-results")).toBeVisible({ timeout: 10_000 })
      // D-2 (QA PR #118): รอ transition เลื่อนเข้า (translate-x) ของ drawer จบก่อนวัดตำแหน่ง
      await page.waitForFunction(() =>
        document.getAnimations().every((a) => a.playState !== "running" && !a.pending)
      )
    })

    await step("หน้าไม่เลื่อนแนวนอน และ input/ผลลัพธ์อยู่ใน drawer", async () => {
      const m = await page.evaluate(() => {
        const drawer = document.querySelector('[data-testid="search-drawer"]') as HTMLElement
        const box = drawer.getBoundingClientRect()
        const outside = Array.from(drawer.querySelectorAll<HTMLElement>("*"))
          .filter((el) => {
            const r = el.getBoundingClientRect()
            return r.width > 0 && (r.left < box.left - 0.5 || r.right > box.right + 0.5)
          })
          .map((el) => el.getAttribute("data-testid") ?? el.tagName)
        const overflowing = Array.from(drawer.querySelectorAll<HTMLElement>("*"))
          .filter(
            (el) =>
              el.scrollWidth > el.clientWidth &&
              el.clientWidth > 0 &&
              getComputedStyle(el).overflowX !== "visible" &&
              el.tagName !== "INPUT"
          )
          .map((el) => el.getAttribute("data-testid") ?? el.tagName)
        return {
          docScrollWidth: document.documentElement.scrollWidth,
          drawerScroll: drawer.scrollWidth,
          drawerClient: drawer.clientWidth,
          drawerRight: box.right,
          outside,
          overflowing,
        }
      })
      expect(m.docScrollWidth, "document scrollWidth").toBeLessThanOrEqual(375)
      expect(m.drawerRight, "drawer อยู่ในจอ").toBeLessThanOrEqual(375)
      expect(m.drawerScroll, "drawer scrollWidth <= clientWidth").toBeLessThanOrEqual(m.drawerClient)
      expect(m.outside, "element ที่ล้นออกนอก drawer").toEqual([])
      expect(m.overflowing, "container ที่เลื่อนแนวนอนใน drawer").toEqual([])
      await evidence("02-search-drawer-375-long-query")
    })
  })
})
