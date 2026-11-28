import { Page } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import { createActiveAffiliate } from "./support/affiliate"
import { groupBuyOrder, poolGroup } from "./support/group-buy"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, placeOrder, publishableKey, signInAs } from "./support/medusa"

// SFUI-21b (spec 09 กฎ 77, AC-65 (2) — owner: h1 ทุกหน้าขนาดเดียว): ทุก h1 (ยกเว้น hero ของหน้าแรก) = text-3xl font-semibold tracking-tight
// → computed font-size 32px (--text-3xl = 2rem), weight 600, text-transform none, letter-spacing และ line-height เท่ากันทุกหน้า
test.use({ evidenceTarget: { feature: "storefront-consistency", taskId: "SFUI-21b" } })

type H1Style = { fontSize: string; fontWeight: string; textTransform: string; letterSpacing: string; lineHeight: string }

async function h1Style(page: Page, where: string): Promise<H1Style> {
  const h1 = page.locator("h1:visible").first()
  await expect(h1, where).toBeVisible({ timeout: 30_000 })
  return h1.evaluate((el) => {
    const s = getComputedStyle(el)
    return { fontSize: s.fontSize, fontWeight: s.fontWeight, textTransform: s.textTransform, letterSpacing: s.letterSpacing, lineHeight: s.lineHeight }
  })
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`AC-65 (2) ${viewport.width}: h1 ทุกหน้า 32px/600 ไม่ uppercase และ letter-spacing/line-height เท่ากัน`, async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(300_000)
    await page.setViewportSize(viewport)
    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const seen: { where: string; style: H1Style }[] = []
    const check = async (path: string, where: string) => {
      await page.goto(path)
      seen.push({ where, style: await h1Style(page, where) })
    }

    await step("ยังไม่ login: login, register, verify-account, affiliate login, 404, นโยบาย", async () => {
      await check(`/${CC}/account`, "login")
      await page.getByTestId("login-to-register-button").click()
      await expect(page.getByTestId("register-page")).toBeVisible()
      seen.push({ where: "register", style: await h1Style(page, "register") })
      await check(`/${CC}/verify-account`, "verify-account")
      await check(`/${CC}/affiliate/login`, "affiliate login")
      await check(`/${CC}/products/does-not-exist-sfui21b`, "404 (main)")
      await check(`/no-such-route-sfui21b/x`, "404 app")
      await check(`/${CC}/shipping`, "policy")
    })

    const customer = await createCustomer(request, pk)
    const order = await placeOrder(request, pk, customer)
    await signInAs(context, baseURL!, customer)

    await step("catalog + search + ตะกร้าว่าง", async () => {
      await check(`/${CC}/store`, "store")
      await check(`/${CC}/categories/shirts`, "category")
      await check(`/${CC}/collections/featured`, "collection")
      await check(`/${CC}/products/t-shirt`, "PDP")
      await check(`/${CC}/search?q=shirt`, "search")
      await check(`/${CC}/cart`, "ตะกร้าว่าง")
    })

    await step("บัญชี: orders, addresses, profile, vouchers, order details, order confirmed", async () => {
      await check(`/${CC}/account/orders`, "orders")
      await check(`/${CC}/account/addresses`, "addresses")
      await check(`/${CC}/account/profile`, "profile")
      await check(`/${CC}/account/vouchers`, "vouchers")
      await check(`/${CC}/account/orders/details/${order.id}`, "order details")
      await check(`/${CC}/order/${order.id}/confirmed`, "order confirmed")
      if (viewport.width === 390) await evidence("01-order-confirmed-h1-390")
    })

    await step("/g/<token> และหน้าจ่าย order ค้างจ่าย", async () => {
      const group = await poolGroup(request)
      await check(`/${CC}/g/${group.token}`, "group page")
      const pending = await groupBuyOrder(request, true)
      await context.clearCookies()
      await signInAs(context, baseURL!, pending.customer)
      await check(`/${CC}/account/orders/${pending.orderId}/pay`, "order pay")
    })

    await step("affiliate dashboard: payouts, earnings, profile, programs", async () => {
      const affiliate = await createActiveAffiliate(request, admin, { prefix: "e2e-sfui21b" })
      await context.clearCookies()
      await page.goto(`/${CC}/affiliate/login`)
      await page.getByTestId("affiliate-login-email").fill(affiliate.email)
      await page.getByTestId("affiliate-login-password").fill(affiliate.password)
      await page.getByTestId("affiliate-login-submit").click()
      await expect(page.getByTestId("affiliate-logout")).toBeVisible({ timeout: 15_000 })
      for (const path of ["payouts", "earnings", "profile", "programs"]) await check(`/${CC}/affiliate/${path}`, `affiliate ${path}`)
      if (viewport.width === 1280) await evidence("02-affiliate-h1-1280")
    })

    const first = seen[0].style
    for (const { where, style } of seen) {
      expect.soft(style.fontSize, `${where} font-size`).toBe("32px")
      expect.soft(style.fontWeight, `${where} font-weight`).toBe("600")
      expect.soft(style.textTransform, `${where} text-transform`).toBe("none")
      expect.soft(style.letterSpacing, `${where} letter-spacing เท่าหน้าแรกที่ตรวจ`).toBe(first.letterSpacing)
      expect.soft(style.lineHeight, `${where} line-height เท่าหน้าแรกที่ตรวจ`).toBe(first.lineHeight)
    }
    expect(seen.length).toBeGreaterThanOrEqual(25)
  })
}
