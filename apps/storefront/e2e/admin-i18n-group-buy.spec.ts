import { APIRequestContext, Locator, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, ADMIN_UI_OPTIONS_TH, PAGINATION_TEXT, adminText, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, Headers } from "./support/medusa"
import { THAI } from "./support/thai-text"

// spec 10 AC-9 (AI18N-2, กฎ 7, 9, 13): หน้า group buy + widget flash sale แสดงตามภาษาที่เลือกผ่านกลไกของ Medusa
// ค่าที่คาดสร้างจาก `json/<lng>/ecom-group-buy.json` (ไม่ hard-code ประโยคไทย); element ที่มี testid หาด้วย testid
// ลิงก์เมนู/ปุ่มใน action ของ DataTable/heading ของ DataTable/breadcrumb ของ dashboard หาด้วย role + ชื่อภายใน container ที่แคบที่สุด (ข้อยกเว้น — ADR-018)
// หมายเหตุ: ช่องชื่อของฟอร์มไม่มี error ใต้ช่อง (เดิม toast — `toCampaignBody`) → ตรวจ toast ของ "Name is required"
// และ error ใต้ช่องที่มี testid เดิม (`gb-target-value-error` — ข้อความจาก zod แบบ lazy) แทน

type Lng = "en" | "th"
const NS = "ecom-group-buy"
const HOUR = 60 * 60 * 1000
const text = (lng: Lng, key: string, vars: Record<string, string> = {}) =>
  Object.entries(vars).reduce((value, [name, v]) => value.replace(`{{${name}}}`, v), adminText(lng, NS, key))

async function seedCampaigns(request: APIRequestContext, admin: Headers, tag: string) {
  const products = await request.get(`${BACKEND_URL}/admin/products?handle=t-shirt&fields=id`, { headers: admin })
  expect(products.status(), "list products").toBe(200)
  const productId: string = (await products.json()).products[0].id
  const gb = await request.post(`${BACKEND_URL}/admin/group-buy/campaigns`, {
    headers: admin,
    data: {
      name: `AI18N-2 ${tag}`,
      target_type: "orders",
      target_value: 3,
      group_mode: "pool",
      team_duration_hours: null,
      ends_at: new Date(Date.now() + 48 * HOUR).toISOString(),
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "each",
        max_quantity: 10,
        value: 10,
        target_rules: [{ attribute: "items.product.id", operator: "in", values: [productId] }],
      },
    },
  })
  expect(gb.status(), "create group-buy campaign").toBe(200)
  const campaign = await request.post(`${BACKEND_URL}/admin/campaigns`, {
    headers: admin,
    data: { name: `AI18N-2 flash ${tag}`, campaign_identifier: `ai18n2-${tag}` },
  })
  expect(campaign.status(), "create campaign").toBe(200)
  const flashId: string = (await campaign.json()).campaign.id
  const saved = await request.post(`${BACKEND_URL}/admin/flash-sales/${flashId}/config`, {
    headers: admin,
    data: { per_customer_limit: 2, total_cap: 25 },
  })
  expect(saved.status(), "save flash sale config").toBe(200)
  return { groupBuyId: (await gb.json()).campaign.id as string, flashId }
}

/** ข้อความที่แสดงต้องเป็นไทย (th) หรือไม่มีอักษรไทย (en) */
const expectLang = (lng: Lng, shown: string | null) =>
  lng === "th" ? expect(shown).toMatch(THAI) : expect(shown).not.toMatch(THAI)

// AI18N-N2: แถบแบ่งหน้าของ DataTable (@medusajs/ui) ใน wrapper ที่มี testid — ข้อความจาก key ของ Medusa (`general.*` ของ dashboard)
const pagination = (lng: Lng, key: "of" | "results" | "pages" | "prev" | "next") => adminText(lng, "translation", `general.${key}`)
const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** "<from> — <to> <of> <count> <results>", "<page> <of> <pageCount> <pages>" และปุ่ม prev/next (role + ชื่อภายใน wrapper) ตามภาษา */
async function expectPagination(wrapper: Locator, lng: Lng) {
  const of = escapeRe(pagination(lng, "of"))
  const resultsRe = new RegExp(`\\d+ ${of} \\d+ ${escapeRe(pagination(lng, "results"))}`)
  const pagesRe = new RegExp(`\\d+ ${of} \\d+ ${escapeRe(pagination(lng, "pages"))}`)
  await expect(wrapper).toContainText(resultsRe)
  await expect(wrapper).toContainText(pagesRe)
  const prev = wrapper.getByRole("button", { name: pagination(lng, "prev"), exact: true })
  const next = wrapper.getByRole("button", { name: pagination(lng, "next"), exact: true })
  await expect(prev).toBeVisible()
  await expect(next).toBeVisible()
  // th: ไม่เหลือข้อความอังกฤษเดิมของ @medusajs/ui; en: รูปแบบเดิม (spec 08 กฎ 29a)
  if (lng === "th") await expect(wrapper).not.toContainText(PAGINATION_TEXT)
  else await expect(wrapper).toContainText(PAGINATION_TEXT)
  const shown = (await wrapper.textContent()) ?? ""
  for (const part of [shown.match(resultsRe)?.[0], shown.match(pagesRe)?.[0], await prev.textContent(), await next.textContent()])
    expectLang(lng, part ?? null)
}

async function run(page: Page, request: APIRequestContext, lng: Lng, step: (title: string, body: () => Promise<void>) => Promise<void>, shot: (name: string) => Promise<void>) {
  test.setTimeout(150_000)
  const admin = await adminHeaders(request)
  const { groupBuyId, flashId } = await seedCampaigns(request, admin, `${lng}-${Date.now()}`)
  const table = page.getByTestId("gb-campaigns-table")

  await step("/group-buying: ลิงก์เมนูด้านข้างและ heading ของตาราง", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/group-buying`)
    const nav = page.getByRole("complementary").getByRole("link", { name: text(lng, "nav.groupBuying"), exact: true })
    await expect(nav).toBeVisible()
    const heading = table.getByRole("heading", { name: text(lng, "list.heading"), exact: true })
    await expect(heading).toBeVisible()
    expectLang(lng, `${await nav.textContent()} ${await heading.textContent()}`)
    await shot("01-list")
  })

  await step("modal สร้างแคมเปญ: title + label ช่องชื่อ, error ใต้ช่อง target (testid เดิม) และ toast ชื่อว่าง", async () => {
    await table.getByRole("button", { name: text(lng, "list.create"), exact: true }).click()
    // FocusModal.Title = accessible name ของ dialog ที่ห่อฟอร์ม (หาแบบ admin-dialog-title.spec.ts)
    const name = page.getByTestId("gb-field-name")
    await expect(name).toBeVisible()
    const dialog = name.locator("xpath=ancestor::*[@role='dialog']")
    await expect(dialog).toHaveAccessibleName(text(lng, "form.title"))
    await expect(name).toHaveAccessibleName(text(lng, "form.labels.name"))
    // error ใต้ช่องจาก schema (lazy t) — ไม่ผ่าน schema จึงไม่ถึง toCampaignBody (ไม่มี toast ทับปุ่ม)
    await page.getByTestId("gb-field-target_value").fill("0")
    await page.getByTestId("gb-campaign-create-submit").click()
    const fieldError = page.getByTestId("gb-target-value-error")
    await expect(fieldError).toHaveText(text(lng, "form.errors.wholeNumber", { label: text(lng, "form.fieldNames.target") }))
    // error หายเมื่อแก้ค่า — เก็บข้อความไว้ตรวจภาษาก่อน
    const fieldErrorText = await fieldError.textContent()
    // ชื่อว่าง → toast ของ toCampaignBody (เดิมไม่มี error ใต้ช่องชื่อ)
    await page.getByTestId("gb-field-target_value").fill("3")
    await page.getByTestId("gb-campaign-create-submit").click()
    const toast = page.locator("[data-sonner-toast]").filter({ hasText: text(lng, "form.errors.nameRequired") })
    await expect(toast).toHaveCount(1)
    expectLang(lng, `${await dialog.getByRole("heading").first().textContent()} ${fieldErrorText} ${await toast.textContent()}`)
    // AI18N-N2: แถบแบ่งหน้าของตารางเลือกสินค้า
    await expectPagination(page.getByTestId("gb-product-picker"), lng)
    await shot("02-create-form")
  })

  await step("/group-buying/:id: breadcrumb แรกและ badge สถานะ", async () => {
    await page.goto(`${BACKEND_URL}/app/group-buying/${groupBuyId}`)
    const status = page.getByTestId("gb-campaign-status")
    await expect(status).toHaveText(text(lng, "status.draft"))
    // AI18N-N1: Breadcrumbs ของ dashboard 2.22.1 (shell.tsx) เป็น <ol> ไม่มี nav/aria-label และ Topbar ไม่มี role — หาด้วย role + ชื่อ
    // ภายใน container ไม่ได้ (link ชื่อเดียวกันอยู่ใน <nav> ของ sidebar) จึงคง <ol> แรกของหน้า (sidebar ไม่มี <ol>)
    const first = page.locator("ol").first().locator("li").first()
    await expect(first).toHaveText(text(lng, "nav.groupBuying"))
    expectLang(lng, `${await first.textContent()} ${await status.textContent()}`)
    await shot("03-detail")
  })

  await step("AI18N-N2 /group-buying/:id: แถบแบ่งหน้าของตารางกลุ่มและตารางสมาชิก", async () => {
    const activated = await request.post(`${BACKEND_URL}/admin/group-buy/campaigns/${groupBuyId}/status`, {
      headers: admin,
      data: { status: "active" },
    })
    expect(activated.status(), "activate group-buy campaign").toBe(200)
    const group = await request.post(`${BACKEND_URL}/admin/group-buy/campaigns/${groupBuyId}/groups`, {
      headers: admin,
      data: { name: `AI18N-N2 ${lng}` },
    })
    expect(group.status(), "create pool group").toBe(201)
    await page.reload()
    const groups = page.getByTestId("gb-groups-table")
    await expect(groups.locator("tbody tr")).toHaveCount(1)
    await expectPagination(groups, lng)
    await groups.locator("tbody tr").first().click()
    await expectPagination(page.getByTestId("gb-memberships-table"), lng)
  })

  await step("หน้า campaign ที่มี widget flash-sale-options: หัว widget และ title ของแถว Total cap", async () => {
    await page.goto(`${BACKEND_URL}/app/campaigns/${flashId}`)
    const widget = page.getByTestId("flash-sale-options")
    const totalCap = widget.getByTestId("flash-sale-row-total_cap")
    await expect(totalCap).toBeVisible({ timeout: 30_000 })
    const title = widget.getByRole("heading", { name: text(lng, "flashSale.title"), exact: true })
    await expect(title).toBeVisible()
    await expect(totalCap).toContainText(text(lng, "flashSale.fields.totalCap"))
    await expect(totalCap).toContainText("25")
    expectLang(lng, `${await title.textContent()} ${await totalCap.textContent()}`)
    await shot("04-flash-sale-widget")
  })
}

test.describe("lng=th", () => {
  test.use({ ...ADMIN_UI_OPTIONS_TH, evidenceTarget: { feature: "admin-i18n", taskId: "AI18N-2" } })

  test("AC-9: group buy + flash sale เป็นไทย (ค่า th ของ ecom-group-buy)", async ({ page, request, step, evidence }) => {
    await run(page, request, "th", step, evidence)
  })
})

test.describe("lng=en", () => {
  test.use({ ...ADMIN_UI_OPTIONS })

  test("AC-9: group buy + flash sale เป็นอังกฤษเดิม ไม่มีอักษรไทย", async ({ page, request, step }) => {
    expect([text("en", "nav.groupBuying"), text("en", "list.heading"), text("en", "status.draft")]).toEqual([
      "Group buying",
      "Group-buy campaigns",
      "draft",
    ])
    // AI18N-N2: ค่า en ของ key แถบแบ่งหน้า = ค่าเริ่มต้นเดิมของ Table.Pagination (@medusajs/ui)
    expect((["of", "results", "pages", "prev", "next"] as const).map((key) => pagination("en", key))).toEqual([
      "of",
      "results",
      "pages",
      "Prev",
      "Next",
    ])
    await run(page, request, "en", step, async () => undefined)
  })
})
