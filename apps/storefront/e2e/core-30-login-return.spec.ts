import { APIRequestContext, APIResponse, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { poolGroup } from "./support/group-buy"
import { STOREFRONT_COUNTRY as CC, Customer, Headers, adminHeaders, createCustomer, publishableKey, variantOf } from "./support/medusa"

// CORE-30 (spec 01 กฎข้อ 87, AC-123): ไม่ login กด join (หน้ากลุ่ม) / สร้างทีม (หน้าแรก) → login แล้วกลับหน้าเดิม
// หลังกลับไม่ join/สร้างทีมให้อัตโนมัติ; return_to ที่ไม่ใช่ path ภายในตาม allow-list → /account ตามเดิม
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-30" } })

const HOUR = 60 * 60 * 1000
const FRESH_WITHIN_MS = 90_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin/store API ใน e2e
async function ok(res: APIResponse, what: string, status = 200): Promise<any> {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(status)
  return res.json()
}

async function loginViaForm(page: Page, customer: Customer) {
  await expect(page.getByTestId("login-page")).toBeVisible()
  await page.getByTestId("email-input").fill(customer.email)
  await page.getByTestId("password-input").fill(customer.password)
  await page.getByTestId("sign-in-button").click()
}

const membershipCount = async (request: APIRequestContext, admin: Headers, groupId: string) =>
  (await ok(await request.get(`${BACKEND_URL}/admin/group-buy/groups/${groupId}/memberships`, { headers: admin }), "memberships")).count as number

test("AC-123: หน้ากลุ่ม — ไม่ login กด join → login พร้อม return_to → กลับหน้ากลุ่ม ไม่มี membership ใหม่", async ({
  page,
  request,
  evidence,
}) => {
  const ctx = await poolGroup(request)
  const customer = await createCustomer(request, ctx.pk)
  const groupPath = `/${CC}/g/${ctx.token}`

  await page.goto(groupPath)
  await page.getByTestId("group-join-button").click()
  await expect(page).toHaveURL((url) => url.pathname === `/${CC}/account` && url.searchParams.get("return_to") === groupPath)
  await evidence("01-group-join-login-return")

  await loginViaForm(page, customer)
  await expect(page).toHaveURL((url) => url.pathname === groupPath && url.search === "")
  // login แล้ว (ลูกค้าใหม่ยังไม่มีที่อยู่) → ลิงก์เพิ่มที่อยู่แทนการส่งไป login
  await expect(page.getByTestId("group-add-address-link")).toBeVisible()
  expect(await membershipCount(request, ctx.admin, ctx.groupId), "ไม่ join ให้อัตโนมัติ").toBe(0)
  await evidence("02-group-page-after-login")
})

test("AC-123: return_to ถูกแก้เป็น URL ภายนอก → login แล้วอยู่ที่ /th/account", async ({ page, request }) => {
  const admin = await adminHeaders(request)
  const customer = await createCustomer(request, await publishableKey(request, admin))
  await page.goto(`/${CC}/account?${new URLSearchParams({ return_to: "https://evil.example" })}`)
  await loginViaForm(page, customer)
  await expect(page.getByTestId("account-nav")).toBeVisible()
  await expect(page).toHaveURL((url) => url.origin !== "https://evil.example" && url.pathname === `/${CC}/account`)
})

test("AC-123: หน้าแรก — ไม่ login กดสร้างทีม → login แล้วกลับ /th และจำนวนทีมไม่เพิ่ม", async ({ page, request, evidence }) => {
  test.setTimeout(FRESH_WITHIN_MS + 90_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const { productId } = await variantOf(request, pk, "t-shirt")
  const customer = await createCustomer(request, pk)
  const { campaign } = await ok(
    await request.post(`${BACKEND_URL}/admin/group-buy/campaigns`, {
      headers: admin,
      data: {
        name: `CORE-30 ทีม ${Date.now()}`,
        target_type: "orders",
        target_value: 5,
        group_mode: "team",
        team_duration_hours: 24,
        ends_at: new Date(Date.now() + 48 * HOUR).toISOString(),
        application_method: {
          type: "percentage",
          target_type: "items",
          allocation: "each",
          max_quantity: 10,
          value: 10,
          target_rules: [{ attribute: "items.product.id", operator: "in", values: [productId] }],
        },
        rules: [{ attribute: "currency_code", operator: "in", values: ["thb"] }],
      },
    }),
    "create campaign"
  )
  const createdAt = Date.now()
  try {
    await ok(
      await request.post(`${BACKEND_URL}/admin/group-buy/campaigns/${campaign.id}/status`, { headers: admin, data: { status: "active" } }),
      "activate"
    )
    const teams = async () =>
      (await ok(await request.get(`${BACKEND_URL}/admin/group-buy/campaigns/${campaign.id}/groups`, { headers: admin }), "groups"))
        .groups.length as number
    const button = page.locator(`[data-testid="group-campaign-card"][data-campaign-id="${campaign.id}"]`).getByTestId("group-create-team-button")

    // หน้าแรก static (revalidate 60, ADR-017) → reload จนการ์ดของแคมเปญนี้ขึ้น
    await expect(async () => {
      await page.goto(`/${CC}`)
      await expect(button).toBeVisible({ timeout: 1_000 })
    }).toPass({ intervals: [2_000, 5_000], timeout: Math.max(createdAt + FRESH_WITHIN_MS - Date.now(), 10_000) })

    await button.click()
    await expect(page).toHaveURL((url) => url.pathname === `/${CC}/account` && url.searchParams.get("return_to") === `/${CC}`)
    await loginViaForm(page, customer)
    await expect(page).toHaveURL((url) => url.pathname === `/${CC}` && url.search === "")
    await expect(button).toBeVisible()
    expect(await teams(), "ไม่สร้างทีมให้อัตโนมัติ").toBe(0)
    await evidence("03-home-after-login")
  } finally {
    await ok(
      await request.post(`${BACKEND_URL}/admin/group-buy/campaigns/${campaign.id}/status`, { headers: admin, data: { status: "ended" } }),
      "end campaign"
    )
  }
})
