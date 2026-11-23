import type { APIRequestContext, Page } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { isNavCartReadBody, isServerAction } from "./support/server-action"

// CORE-91 (spec 01 กฎข้อ 147, AC-188): dropdown ตะกร้าบอกว่า "ว่าง" เฉพาะเมื่อรู้แน่ (ไม่ใช่ระหว่างโหลด/อ่านล้ม)
// และหน้า dynamic ที่ server ส่ง cart มาแล้ว (รวม "ไม่มี cart") CartDropdown ไม่อ่าน cart ซ้ำตอน mount
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-91" } })

const EMPTY_TEXT = "ตะกร้าของคุณยังว่างอยู่"

/** ลูกค้าที่ login แล้ว (มี/ไม่มี cart) — `/th` เป็นหน้า force-static: nav อ่าน cart ใน browser */
async function signedInCustomer(
  { page, request, baseURL }: { page: Page; request: APIRequestContext; baseURL: string },
  withCart: boolean
) {
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(page.context(), baseURL, customer)
  if (withCart) {
    const cartId = await cartReadyForPayment(request, pk, customer)
    await page.context().addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL }])
  }
}

/** นับ (และเลือกพัก/ทำให้ล้ม) `retrieveCart` ที่ CartDropdown ยิงเอง — เริ่มก่อน `goto` */
async function navCartReads(page: Page, handle: "pass" | "hold" | "fail" = "pass") {
  const state = { reads: 0, release: () => {} }
  const held = new Promise<void>((resolve) => (state.release = resolve))
  await page.route("**/*", async (route) => {
    if (!isServerAction(route.request(), isNavCartReadBody)) return route.fallback()
    state.reads++
    if (handle === "fail") return route.fulfill({ status: 500, contentType: "text/plain", body: "mocked cart read failure" })
    if (handle === "hold") await held
    return route.fallback()
  })
  return state
}

const dropdown = (page: Page) => page.getByTestId("nav-cart-dropdown")

test.describe("AC-188: dropdown ตะกร้าใน nav (กฎข้อ 147)", () => {
  test("(a) ระหว่างโหลด cart → hover ไม่มีข้อความตะกร้าว่าง", async ({ page, request, baseURL, evidence }) => {
    await signedInCustomer({ page, request, baseURL: baseURL! }, true)
    const nav = await navCartReads(page, "hold")
    try {
      await page.goto(`/${CC}`)
      await expect.poll(() => nav.reads, { message: "nav ยิงอ่าน cart แล้ว (hydrate แล้ว)" }).toBeGreaterThan(0)
      await page.getByTestId("nav-cart-link").hover()
      await expect(dropdown(page)).toBeVisible()
      await expect(dropdown(page)).not.toContainText(EMPTY_TEXT)
      await expect(page.getByTestId("nav-cart-dropdown-loading")).toBeVisible()
      await evidence("01-dropdown-loading")
    } finally {
      nav.release()
    }
  })

  test("(a) อ่าน cart ล้ม → hover ไม่มีข้อความตะกร้าว่าง", async ({ page, request, baseURL, evidence }) => {
    await signedInCustomer({ page, request, baseURL: baseURL! }, true)
    const nav = await navCartReads(page, "fail")
    await page.goto(`/${CC}`)
    await expect.poll(() => nav.reads, { message: "nav ยิงอ่าน cart แล้ว" }).toBeGreaterThan(0)
    const link = page.getByTestId("nav-cart-link")
    await expect(link).not.toHaveAttribute("aria-busy")
    await link.hover()
    await expect(dropdown(page)).toBeVisible()
    await expect(dropdown(page)).not.toContainText(EMPTY_TEXT)
    await expect(page.getByTestId("nav-cart-dropdown-error")).toBeVisible()
    await evidence("02-dropdown-error")
  })

  test("(a) ตะกร้าว่างจริง → hover มีข้อความตะกร้าว่าง", async ({ page, request, baseURL }) => {
    await signedInCustomer({ page, request, baseURL: baseURL! }, false)
    await page.goto(`/${CC}`)
    const link = page.getByTestId("nav-cart-link")
    await expect(link).toHaveText("ตะกร้า (0)")
    await link.hover()
    await expect(dropdown(page)).toContainText(EMPTY_TEXT)
  })

  for (const withCart of [true, false]) {
    test(`(b) หน้า dynamic ที่ server ส่ง${withCart ? " cart" : "ว่าไม่มี cart"} → CartDropdown อ่าน cart 0 ครั้งตอน mount`, async ({
      page,
      request,
      baseURL,
    }) => {
      await signedInCustomer({ page, request, baseURL: baseURL! }, withCart)
      const nav = await navCartReads(page)
      await page.goto(`/${CC}/account`)
      await expect(page.getByTestId("account-page")).toBeVisible()
      // hover เปิด dropdown ได้ = hydrate แล้ว (effect ตอน mount ของ CartDropdown รันแล้ว)
      await page.getByTestId("nav-cart-link").hover()
      await expect(dropdown(page)).toBeVisible()
      await page.waitForLoadState("networkidle")
      expect(nav.reads, "retrieveCart ของ CartDropdown ตอน mount").toBe(0)
      if (!withCart) await expect(dropdown(page)).toContainText(EMPTY_TEXT)
    })
  }
})
