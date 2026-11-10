import { APIRequestContext, APIResponse, Locator, Page } from "@playwright/test"

import { deleteAllThenExpectOk } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, Customer, Headers, adminHeaders, createCustomer, publishableKey, signInAs, variantOf } from "./support/medusa"
import { expectThai } from "./support/thai-text"

// GB-7c (spec 04 กฎข้อ 29a, 29e, 29g, AC-48): ส่วน `home-campaigns` บนหน้าแรก — การ์ด flash + group buy (สินค้าเดียว) + ปุ่มสร้างทีม
// หน้าแรก static (revalidate 60, ADR-017) → reload จนการ์ดของแคมเปญที่สร้างขึ้นภายใน 90 วินาที
// "ไม่มีแคมเปญ → ไม่มี home-campaigns" ตรวจด้วย unit (`hasHomeCampaigns`) — DB ของ e2e ใช้ร่วมกับ suite อื่นที่มีแคมเปญ active
test.use({ evidenceTarget: { feature: "group-buying", taskId: "GB-7c" } })
test.describe.configure({ mode: "serial" })

const HOUR = 60 * 60 * 1000
const FRESH_WITHIN_MS = 90_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin/store API ใน e2e
async function ok(res: APIResponse, what: string, status = 200): Promise<any> {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(status)
  return res.json()
}

let admin: Headers
let pk: string
let productId: string
let run: string
let createdAt = 0
const ids: Record<"g1" | "g2" | "g3", string> = { g1: "", g2: "", g3: "" }
let g3Template = ""
let poolToken = ""
let flashCampaignId = ""
let flashPromotionId = ""

async function groupCampaign(request: APIRequestContext, name: string, group_mode: "both" | "pool" | "team") {
  const { campaign } = await ok(
    await request.post(`${BACKEND_URL}/admin/group-buy/campaigns`, {
      headers: admin,
      data: {
        name,
        target_type: "orders",
        target_value: 5,
        group_mode,
        ...(group_mode === "pool" ? {} : { team_duration_hours: 24 }),
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
    `create ${name}`
  )
  await ok(
    await request.post(`${BACKEND_URL}/admin/group-buy/campaigns/${campaign.id}/status`, { headers: admin, data: { status: "active" } }),
    `activate ${name}`
  )
  return campaign as { id: string; template_promotion_id: string }
}

const teamsOf = async (request: APIRequestContext, campaignId: string) => {
  const { groups } = await ok(
    await request.get(`${BACKEND_URL}/admin/group-buy/campaigns/${campaignId}/groups`, { headers: admin }),
    "list groups"
  )
  return (groups as { kind: string }[]).filter((g) => g.kind === "team").length
}

const cardOf = (page: Page, id: string, testId = "group-campaign-card"): Locator =>
  page.locator(`[data-testid="${testId}"][data-campaign-id="${id}"]`)

/** reload หน้าแรกจนเห็นการ์ดของ G1, G2 (+ G3 เมื่อขอ) และ F (ภายใน 90 วินาทีนับจากสร้างข้อมูล) */
async function openHomeWithCards(page: Page, withG3 = false) {
  await expect(async () => {
    await page.goto(`/${CC}`)
    for (const id of [ids.g1, ids.g2, ...(withG3 ? [ids.g3] : [])]) {
      await expect(cardOf(page, id)).toBeVisible({ timeout: 1_000 })
    }
    await expect(cardOf(page, flashCampaignId, "flash-campaign-card")).toBeVisible({ timeout: 1_000 })
  }).toPass({ intervals: [2_000, 5_000], timeout: Math.max(createdAt + FRESH_WITHIN_MS - Date.now(), 10_000) })
}

async function signedInCustomer(request: APIRequestContext, page: Page, baseURL: string): Promise<Customer> {
  const customer = await createCustomer(request, pk)
  await signInAs(page.context(), baseURL, customer)
  return customer
}

test.beforeAll(async ({ request }) => {
  test.setTimeout(120_000)
  admin = await adminHeaders(request)
  pk = await publishableKey(request, admin)
  productId = (await variantOf(request, pk, "t-shirt")).productId
  run = `${Date.now()}`
  // ให้หน้าแรกถูก render/cache ก่อนสร้างข้อมูล — การ์ดต้องขึ้นด้วย revalidate (ADR-017)
  expect((await request.get(`/${CC}`)).ok(), "warm หน้าแรก").toBe(true)

  const g1 = await groupCampaign(request, `GB-7c ทั้งสองแบบ ${run}`, "both")
  const g2 = await groupCampaign(request, `GB-7c กลุ่มเปิด ${run}`, "pool")
  const g3 = await groupCampaign(request, `GB-7c ทีม ${run}`, "team")
  ids.g1 = g1.id
  ids.g2 = g2.id
  ids.g3 = g3.id
  g3Template = g3.template_promotion_id
  const { group } = await ok(
    await request.post(`${BACKEND_URL}/admin/group-buy/campaigns/${g1.id}/groups`, { headers: admin, data: { name: "Pool GB-7c" } }),
    "create pool",
    201
  )
  poolToken = group.join_token

  // flash F: promotion อัตโนมัติที่ไม่ตรงสินค้าใดใน seed (ไม่กระทบราคาของ suite อื่น) — การ์ดแสดงแค่ชื่อ/banner/นับถอยหลัง
  const { campaign } = await ok(
    await request.post(`${BACKEND_URL}/admin/campaigns`, {
      headers: admin,
      data: {
        name: `GB-7c แฟลช ${run}`,
        campaign_identifier: `gb7c-${run}`,
        starts_at: new Date(Date.now() - HOUR).toISOString(),
        ends_at: new Date(Date.now() + HOUR).toISOString(),
      },
    }),
    "create flash campaign"
  )
  flashCampaignId = campaign.id
  const { promotion } = await ok(
    await request.post(`${BACKEND_URL}/admin/promotions`, {
      headers: admin,
      data: {
        code: `GB7C-FLASH-${run}`,
        type: "standard",
        status: "active",
        is_automatic: true,
        campaign_id: flashCampaignId,
        application_method: {
          type: "percentage",
          target_type: "items",
          allocation: "across",
          value: 20,
          target_rules: [{ attribute: "items.product.id", operator: "in", values: [`prod_gb7c_none_${run}`] }],
        },
      },
    }),
    "create flash promotion"
  )
  flashPromotionId = promotion.id
  await ok(
    await request.post(`${BACKEND_URL}/admin/flash-sales/${flashCampaignId}/config`, {
      headers: admin,
      data: { banner_text: "ลดแรงเฉพาะวันนี้", show_countdown: true, show_remaining: false },
    }),
    "flash config"
  )
  createdAt = Date.now()
})

test.afterAll(async ({ request }) => {
  // แคมเปญ group buy ลบไม่ได้หลัง active → ปิด (ended) ไม่ให้การ์ดค้างบนหน้าแรกของ suite ถัดไป; flash ลบทิ้ง
  for (const id of Object.values(ids).filter(Boolean)) {
    await ok(
      await request.post(`${BACKEND_URL}/admin/group-buy/campaigns/${id}/status`, { headers: admin, data: { status: "ended" } }),
      `end ${id}`
    )
  }
  await deleteAllThenExpectOk(request, admin, [
    flashPromotionId && `/admin/promotions/${flashPromotionId}`,
    flashCampaignId && `/admin/campaigns/${flashCampaignId}`,
  ])
})

test("AC-48: การ์ด group buy 2 แบบ + การ์ด flash บนหน้าแรก ข้อความไทย", async ({ page, evidence }) => {
  test.setTimeout(FRESH_WITHIN_MS + 60_000)
  await openHomeWithCards(page)
  const g1 = cardOf(page, ids.g1)
  await expect(g1.getByTestId("group-campaign-thumbnail").locator("img")).toBeVisible()
  await expect(g1).toContainText("เสื้อยืด")
  const price = g1.getByTestId("group-campaign-price")
  await expect(price.locator("s")).toHaveCSS("text-decoration-line", "line-through")
  await expect(price).toContainText("฿")
  await expect(g1.getByTestId("group-campaign-progress")).toContainText("0 / 5")
  await expect(g1.getByTestId("group-pool-link")).toHaveAttribute("href", new RegExp(`/${CC}/g/${poolToken}$`))
  await expect(g1.getByTestId("group-create-team-button")).toBeVisible()
  await expect(g1.getByTestId("group-campaign-countdown")).toContainText(/\d+:\d{2}:\d{2}/)

  const g2 = cardOf(page, ids.g2)
  await expect(g2.getByTestId("group-campaign-price")).toBeVisible()
  await expect(g2.getByTestId("group-create-team-button")).toHaveCount(0)

  const flash = cardOf(page, flashCampaignId, "flash-campaign-card")
  await expect(flash).toContainText("ลดแรงเฉพาะวันนี้")
  await expect(flash.getByTestId("flash-campaign-countdown")).toContainText(/\d+:\d{2}:\d{2}/)

  // ชื่อแคมเปญ/สินค้าเป็นข้อมูลจาก backend (มีละตินได้) — ตรวจเฉพาะข้อความของ storefront
  await expectThai(page, [
    "group-campaign-progress",
    "group-campaign-countdown",
    "group-pool-link",
    "group-create-team-button",
    "flash-campaign-countdown",
  ])
  await g1.scrollIntoViewIfNeeded()
  await evidence("01-home-campaigns")
})

test("AC-48: login แล้ว dblclick สร้างทีม → POST ครั้งเดียว ไปหน้าทีมใหม่ที่มีลิงก์แชร์ ไม่ join อัตโนมัติ", async ({
  page,
  request,
  baseURL,
  evidence,
}) => {
  test.setTimeout(FRESH_WITHIN_MS + 60_000)
  const customer = await signedInCustomer(request, page, baseURL!)
  await openHomeWithCards(page)
  expect(await teamsOf(request, ids.g1)).toBe(0)

  await cardOf(page, ids.g1).getByTestId("group-create-team-button").dblclick()
  await expect(page).toHaveURL(new RegExp(`/${CC}/g/[^/]+$`), { timeout: 15_000 })
  const token = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!)
  expect(token).not.toBe(poolToken)
  await expect(page.getByTestId("group-share-link")).toHaveAttribute("href", new RegExp(`/g/${token}$`))
  expect(await teamsOf(request, ids.g1), "กดซ้ำต้องสร้างทีมเดียว").toBe(1)

  const { count } = await ok(
    await request.get(`${BACKEND_URL}/store/customers/me/group-buy/memberships`, {
      headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
    }),
    "my memberships"
  )
  expect(count, "สร้างทีมไม่ join อัตโนมัติ").toBe(0)
  await evidence("02-team-page-after-create")
})

test("AC-48: ยังไม่ login กดสร้างทีม → หน้า login และไม่สร้างทีม", async ({ page, request }) => {
  test.setTimeout(FRESH_WITHIN_MS + 60_000)
  await openHomeWithCards(page)
  const before = await teamsOf(request, ids.g1)
  await cardOf(page, ids.g1).getByTestId("group-create-team-button").click()
  // CORE-30 (spec 01 กฎข้อ 87): หน้า login พร้อม return_to กลับหน้าแรก
  await expect(page).toHaveURL((url) => url.pathname === `/${CC}/account` && url.searchParams.get("return_to") === `/${CC}`)
  expect(await teamsOf(request, ids.g1)).toBe(before)
})

test("375px: การ์ดแคมเปญไม่ทำให้หน้าเลื่อนแนวนอน", async ({ page, evidence }) => {
  test.setTimeout(FRESH_WITHIN_MS + 60_000)
  await page.setViewportSize({ width: 375, height: 812 })
  await openHomeWithCards(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth), "หน้าไม่เลื่อนแนวนอน").toBeLessThanOrEqual(375)
  await cardOf(page, ids.g1).scrollIntoViewIfNeeded()
  await expect(cardOf(page, ids.g1).getByTestId("group-campaign-thumbnail").locator("img")).toHaveJSProperty("complete", true)
  await evidence("04-home-campaigns-375")
})

test("AC-48: POST สร้างทีมตอบ 400 (ต้นแบบถูกแก้เป็น 2 สินค้า) → group-create-team-error ไทย ไม่เปลี่ยนหน้า", async ({
  page,
  request,
  baseURL,
  evidence,
}) => {
  test.setTimeout(FRESH_WITHIN_MS + 60_000)
  await signedInCustomer(request, page, baseURL!)
  await openHomeWithCards(page, true)

  // ต้นแบบของ G3 ถูกแก้ระหว่าง active (กฎข้อ 30b) → createGroupWorkflow 400 GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED (หน้าที่โหลดแล้วยังมีการ์ด)
  const { products } = await ok(
    await request.get(`${BACKEND_URL}/store/products?limit=2&fields=id`, { headers: { "x-publishable-api-key": pk } }),
    "products"
  )
  const other = (products as { id: string }[]).find((p) => p.id !== productId)!.id
  const { promotion } = await ok(
    await request.get(`${BACKEND_URL}/admin/promotions/${g3Template}?fields=*application_method.target_rules`, { headers: admin }),
    "template"
  )
  await ok(
    await request.post(`${BACKEND_URL}/admin/promotions/${g3Template}/target-rules/batch`, {
      headers: admin,
      data: { update: [{ id: promotion.application_method.target_rules[0].id, values: [productId, other] }] },
    }),
    "edit template"
  )

  const card = cardOf(page, ids.g3)
  await card.getByTestId("group-create-team-button").click()
  await expectThai(page, ["group-create-team-error"])
  await expect(page).toHaveURL(new RegExp(`/${CC}$`))
  await expect(card.getByTestId("group-create-team-button")).toBeEnabled()
  expect(await teamsOf(request, ids.g3)).toBe(0)
  await card.scrollIntoViewIfNeeded()
  await evidence("03-create-team-error")
})
