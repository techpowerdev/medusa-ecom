import { APIRequestContext, Locator, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin, pageOffsetOf, waitMenuOpened } from "./support/admin"
import { createActiveAffiliate, insertApprovedEntry, insertDraftPayouts } from "./support/affiliate"
import { deleteAllThenExpectOk } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders } from "./support/medusa"

// ADM-35 (spec 08 AC-40a, กฎ 39): ข้อความยาวในคอลัมน์ข้อความของ `DataTable` ต้องไม่ดันปุ่ม `…` ออกนอกจอ
// ต้นเหตุ (qa #409 O-1): `DataTable` ของ @medusajs/ui ที่ไม่เปิด column order ใช้ table แบบ auto layout + cell `whitespace-nowrap`
// → คอลัมน์ขยายตามข้อความ (ชื่อ 370 ตัวอักษร ≈ ตารางกว้าง 3000px) — แก้ด้วย `size`/`maxSize` ของ column def (เนื้อหา 250px)
// และคง tooltip ของ `TruncatedCell` ของ Medusa ที่ขึ้นเมื่อข้อความถูกตัด
// หาแถวด้วย offset ของหน้าที่แถวอยู่ผ่าน admin API + `<prefix>_offset` ใน URL (ตารางปิดช่องค้นหา `q` — ตามคำตัดสิน session หลัก 2026-11-18)
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-35" },
})

const VIEWPORT_WIDTH = 1280
const CONTENT_MAX = 250
const DAY = 24 * 60 * 60 * 1000
/** run tag ไม่ซ้ำต่อ run — prefix ต่อ task (ADM-35 `adm35`, ADM-37 `adm37`, ADM-38 `adm38` — กฎ 42f) */
const tag = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`
type Step = (title: string, body: () => Promise<void>) => Promise<void>

/** ชื่อยาว 370 ตัวอักษร ไทยปนอังกฤษ — หลัง run tag เป็นช่วงไม่มีช่องว่างยาว ≥ 100 ตัว (ตัดบรรทัดไม่ได้) */
const longName = (run: string) => `${run} ${"ชื่อยาวมากLongName".repeat(30)}`.slice(0, 370)
/** reference ของ payout ≥ 300 ตัวอักษร ไทยปนอังกฤษ (ADM-37, ADM-41) */
const longReference = (run: string) => `${run} ${"เลขอ้างอิงยาวLongReference".repeat(20)}`.slice(0, 320)
/** ชื่อสั้น ≤ 20 ตัวอักษร (ไม่ถูกตัด) */
const shortName = () => `S-${Math.random().toString(36).slice(2, 10)}`

async function post(request: APIRequestContext, admin: Headers, path: string, data: Record<string, unknown>) {
  const res = await request.post(`${BACKEND_URL}${path}`, { headers: admin, data })
  expect(res.status(), `POST ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

/** อีเมล ≥ 80 ตัวอักษร — ยาวที่โดเมน (local part ≤ 64 ตาม RFC); `prefix` = prefix ของ task (กฎ 42f) */
const longEmail = (code: string, prefix: string) => `${code}@${`long-domain-${prefix}-`.repeat(2)}x.${"y".repeat(30)}.example.com`

/** affiliate active ชื่อ 370 ตัวอักษร + อีเมล ≥ 80 ตัวอักษร — `prefix` ของ run tag/โดเมน (เช่น `adm37`) และ `code` (เช่น `a37`) ต่อ task (กฎ 42f) */
async function createLongAffiliate(request: APIRequestContext, admin: Headers, { prefix, code: codePrefix }: { prefix: string; code: string }) {
  const name = longName(tag(prefix))
  const code = `${codePrefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`
  const email = longEmail(code, prefix)
  expect(email.length).toBeGreaterThanOrEqual(80)
  const { id } = await createActiveAffiliate(request, admin, { name, code, email })
  return { id, name, email }
}

/** เนื้อหาของ td (ไม่รวม padding) และ element ที่ `TruncatedCell` ห่อ (div `.truncate` ตัวแรกใน td) */
const cellMetrics = (cell: Locator) =>
  cell.evaluate((td) => {
    const style = getComputedStyle(td)
    const content = td.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const truncated = td.querySelector<HTMLElement>(".truncate")
    return {
      content,
      scrollWidth: truncated?.scrollWidth ?? -1,
      clientWidth: truncated?.clientWidth ?? -1,
    }
  })

/** กล่องเลื่อนแนวนอนของตาราง (บรรพบุรุษตัวแรกของ table ที่ overflow-x เป็น auto/scroll) — scrollLeft ต้องเป็น 0 */
const tableScrollLeft = (table: Locator) =>
  table.locator("table").evaluate((el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      if (["auto", "scroll"].includes(getComputedStyle(node).overflowX)) return node.scrollLeft
    }
    return window.scrollX
  })

/** แถวชื่อยาว: ปุ่ม `…` อยู่ในจอโดยไม่เลื่อนแนวนอน, เนื้อหา cell ชื่อ ≤ 250px, hover ชื่อ → tooltip ชื่อเต็ม, เมนูเปิดและปิดด้วย Escape (กฎ 37) */
async function expectLongRowContained(page: Page, { table, trigger, long, step }: { table: Locator; trigger: string; long: string; step: Step }) {
  const row = table.locator("tbody tr", { hasText: long })
  const button = row.getByTestId(trigger)
  const cell = row.locator("td").first()
  // tooltip ของ TruncatedCell ของแถวนี้ (ข้อความคือชื่อเต็ม) — ไม่ใช้ getByRole("tooltip") ทั้งหน้า (sidebar มี tooltip ของตัวเอง)
  const cellTooltip = page.getByRole("tooltip").filter({ hasText: long })
  await expect(button).toBeVisible({ timeout: 30_000 })

  await step("แถวชื่อยาว: ปุ่ม … อยู่ในจอโดยไม่เลื่อนแนวนอน และเนื้อหา cell ชื่อกว้าง ≤ 250px", async () => {
    // qa #416 D-1: ตาราง partners อยู่ใต้ตาราง pools — ข้อมูลสะสมใน DB ดันแถวลงใต้จอ → เลื่อนเฉพาะแนวตั้งให้แถวเข้าจอ
    // ด้วย cell ชื่อ (คอลัมน์แรก ชิดซ้ายของตาราง) + inline "start" — ไม่เลื่อนกล่องเลื่อนแนวนอนของตาราง (scrollLeft ยังต้องเป็น 0 ข้างล่าง)
    // ห้ามใช้ scrollIntoViewIfNeeded ของปุ่ม: จะเลื่อนแนวนอนตามปุ่มจน develop ผ่านโดยไม่ได้แก้
    await cell.evaluate((td) => td.scrollIntoView({ block: "center", inline: "start" }))
    await expect(button).toBeInViewport()
    expect(await tableScrollLeft(table)).toBe(0)
    const box = await button.boundingBox()
    expect(box, "boundingBox ของปุ่ม …").not.toBeNull()
    expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORT_WIDTH)
    const metrics = await cellMetrics(cell)
    expect(metrics.content).toBeLessThanOrEqual(CONTENT_MAX + 0.5)
    // ข้อความถูกตัดจริง (กัน test ผ่านเพราะชื่อไม่ยาวพอ)
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
  })

  await step("hover ชื่อที่ถูกตัด → tooltip ของ TruncatedCell แสดงชื่อเต็ม", async () => {
    await cell.locator(".truncate").first().hover()
    await expect(cellTooltip).toBeVisible()
    await expect(cellTooltip).toHaveText(long)
  })

  await step("คลิก … → เมนู 1 ตัว → Escape ครั้งเดียวปิด (กฎ 37)", async () => {
    // qa #416 D-1: ไม่ไป (0,0) — เส้นทางผ่าน sidebar เปิด tooltip ของเมนู ("Products G then P") ทันที (provider ข้าม delay
    // หลัง tooltip ของ cell เพิ่งปิด) และค้างได้ จึงตรวจเฉพาะ tooltip ของ cell นี้ และย้ายเมาส์ในคอลัมน์เดิม (ในเนื้อหาหน้า)
    // ไปทิศตรงข้ามกับ tooltip (Radix วางเหนือ cell หรือพลิกลงล่างเมื่อที่ไม่พอ) — ทางที่มุ่งไปหา tooltip อยู่ใน "grace area"
    // และตัว tooltip hover ได้ Radix จึงเปิดค้าง; หลายจังหวะ = มี pointermove หลังออกจาก cell (ไม่ใช่การรอเวลา)
    const box = await cell.boundingBox()
    const tip = await cellTooltip.locator("..").boundingBox()
    expect(box, "boundingBox ของ cell ชื่อ").not.toBeNull()
    expect(tip, "boundingBox ของ tooltip").not.toBeNull()
    const away = tip!.y + tip!.height / 2 < box!.y + box!.height / 2 ? 1 : -1
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + away * box!.height * 2, { steps: 5 })
    await expect(cellTooltip).toHaveCount(0)
    await button.click()
    await waitMenuOpened(page)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("menu")).toHaveCount(0, { timeout: 2_000 })
  })
}

/** แถวชื่อสั้น (≤ 20 ตัวอักษร) แสดงชื่อเต็ม — element ที่ `TruncatedCell` ห่อไม่ล้น */
async function expectShortRowFull(table: Locator, short: string, step: Step) {
  await step("แถวชื่อสั้นแสดงชื่อเต็ม (ไม่ถูกตัด)", async () => {
    const cell = table.locator("tbody tr", { hasText: short }).locator("td").first()
    await expect(cell).toHaveText(short, { timeout: 30_000 })
    const metrics = await cellMetrics(cell)
    expect(metrics.scrollWidth).toBeGreaterThan(0)
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth)
  })
}

type Table = {
  /** path ของ admin API รายการ + key ใน response + query ลำดับเดียวกับหน้า admin */
  api: { path: string; key: string; query?: string }
  /** หน้า admin และ prefix ของ `DataTable` (`<prefix>_offset`) */
  url: string
  prefix: string
  testid: string
  /** testid ของปุ่ม `…` ต่อแถว (ตาราง Ledger ไม่มีเมนูต่อแถว) */
  trigger?: string
  /** แท็บที่ต้องคลิกก่อนเห็นตาราง (ถ้ามี) */
  tab?: string
}

const PARTNERS: Table = {
  api: { path: "/admin/evoucher/partners", key: "partners", query: "order=name" },
  url: "/app/evouchers",
  prefix: "partners",
  testid: "evoucher-partners-table",
  trigger: "evoucher-partner-row-actions",
}
// ตาราง affiliate: ลำดับเริ่มต้นของ API (-created_at, id) = ลำดับของตาราง (หน้า admin ไม่ส่ง order)
const PROGRAMS: Table = {
  api: { path: "/admin/affiliate/programs", key: "programs" },
  url: "/app/affiliate",
  prefix: "programs",
  testid: "affiliate-programs-table",
  trigger: "affiliate-program-row-actions",
}
const AFFILIATES: Table = {
  api: { path: "/admin/affiliate/affiliates", key: "affiliates" },
  url: "/app/affiliate",
  prefix: "affiliates",
  testid: "affiliate-affiliates-table",
  trigger: "affiliate-row-actions",
  tab: "affiliate-admin-tab-affiliates",
}
const PAYOUTS: Table = {
  api: { path: "/admin/affiliate/payouts", key: "payouts" },
  url: "/app/affiliate",
  prefix: "payouts",
  testid: "affiliate-payouts-table",
  trigger: "affiliate-payout-row-actions",
  tab: "affiliate-admin-tab-payouts",
}
const LEDGER: Table = {
  api: { path: "/admin/affiliate/entries", key: "entries" },
  url: "/app/affiliate",
  prefix: "ledger",
  testid: "affiliate-ledger-table",
  tab: "affiliate-admin-tab-ledger",
}

/** โปรแกรม draft: ลบได้ใน finally (โปรแกรม published/ended ลบไม่ได้) — คืน id */
async function createDraftProgram(request: APIRequestContext, admin: Headers, name: string): Promise<string> {
  const { program } = await post(request, admin, "/admin/affiliate/programs", {
    name,
    starts_at: new Date(Date.now() + 30 * DAY).toISOString(),
    ends_at: new Date(Date.now() + 60 * DAY).toISOString(),
    commission_value: 10,
    scope: { all: true },
    status: "draft",
  })
  return program.id
}

/** เปิดหน้าของตาราง `t` ที่มีแถว `id` (offset ผ่าน admin API + `<prefix>_offset` ใน URL) แล้วคลิกแท็บ (ถ้ามี) */
async function openTableAt(page: Page, request: APIRequestContext, admin: Headers, t: Table, id: string) {
  const offset = await pageOffsetOf(request, admin, { ...t.api, id })
  await page.goto(`${BACKEND_URL}${t.url}${offset ? `?${t.prefix}_offset=${offset}` : ""}`)
  if (t.tab) await page.getByTestId(t.tab).click()
}

async function expectTable(
  page: Page,
  request: APIRequestContext,
  admin: Headers,
  t: Table,
  { longId, shortId, long, short, step }: { longId: string; shortId: string; long: string; short: string; step: Step }
) {
  const table = page.getByTestId(t.testid)
  const open = (id: string) => openTableAt(page, request, admin, t, id)
  // แถวสั้นและยาวอาจอยู่คนละหน้า (partners เรียงตามชื่อ) — เปิดหน้าของแต่ละแถวเอง
  await open(shortId)
  await expectShortRowFull(table, short, step)
  await open(longId)
  await expectLongRowContained(page, { table, trigger: t.trigger!, long, step })
}

test("AC-40a: e-voucher partners — ชื่อยาวไม่ดันปุ่ม … ออกนอกจอ, tooltip ชื่อเต็ม", async ({ page, request, step, evidence }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const long = longName(tag("adm35"))
  const short = shortName()
  const ids: string[] = []
  try {
    for (const name of [long, short]) ids.push((await post(request, admin, "/admin/evoucher/partners", { name })).partner.id)
    await loginAdmin(page)
    await expectTable(page, request, admin, PARTNERS, { longId: ids[0], shortId: ids[1], long, short, step })
    await evidence("01-partners-long-name")
  } finally {
    await deleteAllThenExpectOk(request, admin, ids.map((id) => `/admin/evoucher/partners/${id}`))
  }
})

test("AC-40a: affiliate programs — ชื่อยาวไม่ดันปุ่ม … ออกนอกจอ, tooltip ชื่อเต็ม", async ({ page, request, step, evidence }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const long = longName(tag("adm35"))
  const short = shortName()
  const ids: string[] = []
  try {
    for (const name of [long, short]) ids.push(await createDraftProgram(request, admin, name))
    await loginAdmin(page)
    await expectTable(page, request, admin, PROGRAMS, { longId: ids[0], shortId: ids[1], long, short, step })
    await evidence("02-programs-long-name")
  } finally {
    await deleteAllThenExpectOk(request, admin, ids.map((id) => `/admin/affiliate/programs/${id}`))
  }
})

// ADM-37 (spec 08 AC-42, กฎ 41): คอลัมน์ข้อความในตารางที่มีเมนูต่อแถวกว้าง ≤ 250px ทุกความกว้างจอ
// - payouts คอลัมน์ Affiliate (`AffiliateCell` ชื่อ + อีเมล) ไม่มี size/maxSize → ชื่อ 370 ตัวทำให้ตารางกว้างหลายพัน px (qa #416 O-1)
// - ที่ 1920 ทุก td ได้ width = size (ค่าเริ่มต้น 150 ของ tanstack) ผลรวมน้อยกว่าตาราง w-full → Chrome แจกส่วนเกินตามสัดส่วน
//   โดยไม่สน max-width (qa #416 O-3) — ต้องมีคอลัมน์ auto (ไม่มี width) รับส่วนเกิน
// affiliate ไม่มี API ลบ (spec 05) — affiliate ของ test เหล่านี้ลบไม่ได้ เหมือน e2e affiliate เดิม; payout draft ลบ (= ยกเลิก) ใน finally
test.describe("ADM-37: คอลัมน์ข้อความ ≤ 250px ทุกความกว้างจอ", () => {
  test.use({ evidenceTarget: { feature: "admin-ui", taskId: "ADM-37" } })

  const AFFILIATE_PREFIX = { prefix: "adm37", code: "a37" }

  /** แถวข้อความยาว: เนื้อหาทุก cell ข้อความ ≤ 250px และถูกตัดจริง, ปุ่ม `…` ในจอโดยไม่เลื่อนแนวนอน */
  async function expectCellsCapped(
    page: Page,
    { table, row, cells, trigger, step }: { table: Locator; row: Locator; cells: [string, Locator][]; trigger: string; step: Step }
  ) {
    const button = row.getByTestId(trigger)
    await expect(button).toBeVisible({ timeout: 30_000 })
    await step(`คอลัมน์ข้อความ (${cells.map(([name]) => name).join(", ")}) ≤ 250px และปุ่ม … อยู่ในจอโดยไม่เลื่อนแนวนอน`, async () => {
      // qa #416 D-1: เลื่อนเฉพาะแนวตั้งด้วย cell แรกของแถว (ชิดซ้ายของตาราง) + inline "start" — ไม่เลื่อนกล่องเลื่อนแนวนอน
      await row.locator("td").first().evaluate((td) => td.scrollIntoView({ block: "center", inline: "start" }))
      for (const [name, cell] of cells) {
        const metrics = await cellMetrics(cell)
        expect(metrics.content, `เนื้อหา cell ${name}`).toBeLessThanOrEqual(CONTENT_MAX + 0.5)
        // ข้อความถูกตัดจริง (กัน test ผ่านเพราะข้อความไม่ยาวพอ)
        expect(metrics.scrollWidth, `cell ${name} ถูกตัด`).toBeGreaterThan(metrics.clientWidth)
      }
      await expect(button).toBeInViewport()
      expect(await tableScrollLeft(table)).toBe(0)
      const box = await button.boundingBox()
      expect(box, "boundingBox ของปุ่ม …").not.toBeNull()
      expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    })
  }

  /** แถว payout ของ affiliate ชื่อยาว — cell Affiliate (รอชื่อโหลด: ก่อนโหลดแสดง affiliate_id) และ cell Reference */
  async function openPayoutRow(page: Page, request: APIRequestContext, admin: Headers, payoutId: string, name: string) {
    await openTableAt(page, request, admin, PAYOUTS, payoutId)
    const table = page.getByTestId(PAYOUTS.testid)
    const row = table.locator("tbody tr", { hasText: payoutId })
    const affiliateCell = row.locator("td").filter({ has: page.getByTestId("affiliate-row-affiliate") })
    await expect(affiliateCell).toContainText(name, { timeout: 30_000 })
    return { table, row, affiliateCell }
  }

  test("AC-42a1: payouts 1280 — คอลัมน์ Affiliate ชื่อ/อีเมลยาว ≤ 250px, tooltip \"ชื่อ อีเมล\", ปุ่ม … ในจอ", async ({ page, request, step, evidence }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const affiliate = await createLongAffiliate(request, admin, AFFILIATE_PREFIX)
    const ids = await insertDraftPayouts(affiliate.id, 1, new Date())
    try {
      await loginAdmin(page)
      const { table, row, affiliateCell } = await openPayoutRow(page, request, admin, ids[0], affiliate.name)
      await expectCellsCapped(page, { table, row, cells: [["Affiliate", affiliateCell]], trigger: PAYOUTS.trigger!, step })
      await step("hover cell Affiliate ที่ถูกตัด → tooltip ของ TruncatedCell เป็น \"ชื่อ อีเมล\" (กฎ 41b)", async () => {
        // tooltip ของ cell นี้เท่านั้น — sidebar มี tooltip ของตัวเอง
        const tooltip = page.getByRole("tooltip").filter({ hasText: affiliate.name })
        await affiliateCell.locator(".truncate").first().hover()
        await expect(tooltip).toBeVisible()
        await expect(tooltip).toHaveText(`${affiliate.name} ${affiliate.email}`)
      })
      await evidence("01-payouts-long-affiliate-1280")
    } finally {
      await deleteAllThenExpectOk(request, admin, ids.map((id) => `/admin/affiliate/payouts/${id}`))
    }
  })

  test.describe("1920×1080", () => {
    test.use({ viewport: { width: 1920, height: 1080 } })

    test("AC-42a2: programs — ชื่อยาว ≤ 250px, ปุ่ม … ในจอ", async ({ page, request, step }) => {
      test.setTimeout(120_000)
      const admin = await adminHeaders(request)
      const name = longName(tag("adm37"))
      const id = await createDraftProgram(request, admin, name)
      try {
        await loginAdmin(page)
        await openTableAt(page, request, admin, PROGRAMS, id)
        const table = page.getByTestId(PROGRAMS.testid)
        const row = table.locator("tbody tr", { hasText: name })
        await expectCellsCapped(page, { table, row, cells: [["Program", row.locator("td").first()]], trigger: PROGRAMS.trigger!, step })
      } finally {
        await deleteAllThenExpectOk(request, admin, [`/admin/affiliate/programs/${id}`])
      }
    })

    test("AC-42a2: affiliates — ชื่อและอีเมลยาว ≤ 250px, ปุ่ม … ในจอ", async ({ page, request, step }) => {
      test.setTimeout(120_000)
      const admin = await adminHeaders(request)
      const affiliate = await createLongAffiliate(request, admin, AFFILIATE_PREFIX)
      await loginAdmin(page)
      await openTableAt(page, request, admin, AFFILIATES, affiliate.id)
      const table = page.getByTestId(AFFILIATES.testid)
      const row = table.locator("tbody tr", { hasText: affiliate.email })
      const cells: [string, Locator][] = [
        ["Name", row.locator("td").first()],
        ["Email", row.locator("td").filter({ hasText: affiliate.email })],
      ]
      await expectCellsCapped(page, { table, row, cells, trigger: AFFILIATES.trigger!, step })
    })

    test("AC-42a2: payouts — Affiliate และ Reference ยาว ≤ 250px, ปุ่ม … ในจอ", async ({ page, request, step, evidence }) => {
      test.setTimeout(120_000)
      const admin = await adminHeaders(request)
      const affiliate = await createLongAffiliate(request, admin, AFFILIATE_PREFIX)
      const reference = longReference(tag("adm37"))
      // draft: payout ที่ paid ไม่มีปุ่ม … (กฎ 10)
      const ids = await insertDraftPayouts(affiliate.id, 1, new Date(), { reference })
      try {
        await loginAdmin(page)
        const { table, row, affiliateCell } = await openPayoutRow(page, request, admin, ids[0], affiliate.name)
        const cells: [string, Locator][] = [
          ["Affiliate", affiliateCell],
          ["Reference", row.locator("td").filter({ hasText: reference })],
        ]
        await expectCellsCapped(page, { table, row, cells, trigger: PAYOUTS.trigger!, step })
        await evidence("02-payouts-long-text-1920")
      } finally {
        await deleteAllThenExpectOk(request, admin, ids.map((id) => `/admin/affiliate/payouts/${id}`))
      }
    })

    test("AC-42a2: e-voucher partners (regression) — ชื่อและ support contact ยาว ≤ 250px, ปุ่ม … ในจอ", async ({ page, request, step }) => {
      test.setTimeout(120_000)
      const admin = await adminHeaders(request)
      const name = longName(tag("adm37"))
      const support = longName(tag("adm37"))
      const { partner } = await post(request, admin, "/admin/evoucher/partners", { name, support_contact: support })
      try {
        await loginAdmin(page)
        await openTableAt(page, request, admin, PARTNERS, partner.id)
        const table = page.getByTestId(PARTNERS.testid)
        const row = table.locator("tbody tr", { hasText: name })
        const cells: [string, Locator][] = [
          ["Name", row.locator("td").first()],
          ["Support contact", row.locator("td").filter({ hasText: support })],
        ]
        await expectCellsCapped(page, { table, row, cells, trigger: PARTNERS.trigger!, step })
      } finally {
        await deleteAllThenExpectOk(request, admin, [`/admin/evoucher/partners/${partner.id}`])
      }
    })
  })
})

// ADM-38 (spec 08 AC-43, กฎ 42): ตาราง Ledger (ไม่มีเมนูต่อแถว) คอลัมน์ Affiliate ≤ 250px ทุกความกว้างจอ (qa #418 O-2)
// เดิมไม่มี size/maxSize → ชื่อ affiliate ยาวทำให้คอลัมน์ Affiliate ~2600px ต้องเลื่อนแนวนอนจึงเห็น Status (คอลัมน์สุดท้าย)
// entry ใส่ตรงใน DB (ledger อ่านอย่างเดียว ไม่มี API ลบ — spec 05 กฎ 5) และ affiliate ไม่มี API ลบ → คงไว้แบบ e2e AF-14/ADM-8a เดิม;
// โปรแกรม draft (program_id ของ entry — ไม่มี FK) ลบใน finally
test.describe("ADM-38: Ledger คอลัมน์ Affiliate ≤ 250px ทุกความกว้างจอ", () => {
  test.use({ evidenceTarget: { feature: "admin-ui", taskId: "ADM-38" } })

  /** affiliate ชื่อ/อีเมลยาว + entry approved 1 แถว (`order_id` สั้นไม่ซ้ำต่อ run) → เปิดหน้าของแถวในแท็บ Ledger */
  async function openLongLedgerRow(page: Page, request: APIRequestContext, admin: Headers, programId: string) {
    const affiliate = await createLongAffiliate(request, admin, { prefix: "adm38", code: "a38" })
    const orderId = `order_${tag("adm38")}`
    const entryId = await insertApprovedEntry(affiliate.id, programId, orderId, new Date())
    await loginAdmin(page)
    await openTableAt(page, request, admin, LEDGER, entryId)
    const table = page.getByTestId(LEDGER.testid)
    const row = table.locator("tbody tr", { hasText: orderId })
    const affiliateCell = row.locator("td").filter({ has: page.getByTestId("affiliate-row-affiliate") })
    // รอชื่อโหลด (ก่อนโหลดแสดง affiliate_id)
    await expect(affiliateCell).toContainText(affiliate.name, { timeout: 30_000 })
    return { affiliate, table, row, affiliateCell, status: row.locator("td").last() }
  }

  /** เนื้อหา cell Affiliate ≤ 250px และถูกตัดจริง, td Status (คอลัมน์สุดท้าย) ในจอโดยไม่เลื่อนแนวนอน */
  async function expectLedgerRowCapped(
    page: Page,
    { table, row, affiliateCell, status, step }: { table: Locator; row: Locator; affiliateCell: Locator; status: Locator; step: Step }
  ) {
    await step("เนื้อหา cell Affiliate ≤ 250px และ td Status อยู่ในจอโดยไม่เลื่อนแนวนอน", async () => {
      // qa #416 D-1: เลื่อนเฉพาะแนวตั้งด้วย td แรกของแถว (ชิดซ้ายของตาราง) + inline "start" — ไม่เลื่อนกล่องเลื่อนแนวนอน
      await row.locator("td").first().evaluate((td) => td.scrollIntoView({ block: "center", inline: "start" }))
      const metrics = await cellMetrics(affiliateCell)
      expect(metrics.content, "เนื้อหา cell Affiliate").toBeLessThanOrEqual(CONTENT_MAX + 0.5)
      // ข้อความถูกตัดจริง (กัน test ผ่านเพราะข้อความไม่ยาวพอ)
      expect(metrics.scrollWidth, "cell Affiliate ถูกตัด").toBeGreaterThan(metrics.clientWidth)
      await expect(status).toBeInViewport()
      expect(await tableScrollLeft(table)).toBe(0)
      const box = await status.boundingBox()
      expect(box, "boundingBox ของ td Status").not.toBeNull()
      expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    })
  }

  test("AC-43a1: Ledger 1280 — คอลัมน์ Affiliate ชื่อ/อีเมลยาว ≤ 250px, tooltip \"ชื่อ อีเมล\", เห็น Status", async ({ page, request, step, evidence }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const programId = await createDraftProgram(request, admin, `ADM-38 ${tag("adm38")}`)
    try {
      const { affiliate, table, row, affiliateCell, status } = await openLongLedgerRow(page, request, admin, programId)
      await expectLedgerRowCapped(page, { table, row, affiliateCell, status, step })
      await step("hover cell Affiliate ที่ถูกตัด → tooltip ของ TruncatedCell เป็น \"ชื่อ อีเมล\" (กฎ 41b)", async () => {
        // tooltip ของ cell นี้เท่านั้น — sidebar มี tooltip ของตัวเอง; hover ตรงไปที่ cell (qa #416 O-5)
        const tooltip = page.getByRole("tooltip").filter({ hasText: affiliate.name })
        await affiliateCell.locator(".truncate").first().hover()
        await expect(tooltip).toBeVisible()
        await expect(tooltip).toHaveText(`${affiliate.name} ${affiliate.email}`)
      })
      await evidence("01-ledger-long-affiliate-1280")
    } finally {
      await deleteAllThenExpectOk(request, admin, [`/admin/affiliate/programs/${programId}`])
    }
  })

  test.describe("1920×1080", () => {
    test.use({ viewport: { width: 1920, height: 1080 } })

    test("AC-43a2: Ledger 1920 — คอลัมน์ Affiliate ≤ 250px, เห็น Status", async ({ page, request, step, evidence }) => {
      test.setTimeout(120_000)
      const admin = await adminHeaders(request)
      const programId = await createDraftProgram(request, admin, `ADM-38 ${tag("adm38")}`)
      try {
        const { table, row, affiliateCell, status } = await openLongLedgerRow(page, request, admin, programId)
        await expectLedgerRowCapped(page, { table, row, affiliateCell, status, step })
        await evidence("02-ledger-long-affiliate-1920")
      } finally {
        await deleteAllThenExpectOk(request, admin, [`/admin/affiliate/programs/${programId}`])
      }
    })
  })
})

// ADM-41 (spec 08 AC-46, กฎ 45): ตาราง Payouts ทั้งตารางไม่ล้นแนวนอนที่ 1280 และ 1440 (การทดสอบ manual เฟส 8: ตารางกว้าง 1417px
// ต้องเลื่อนในตาราง) — ADM-37 จำกัดเฉพาะคอลัมน์ Affiliate/Reference แต่ผลรวมของทุกคอลัมน์ยังเกินกล่อง
// วัดที่กล่องเลื่อนของ `DataTable` (div `overflow-auto` ภายใน wrapper `affiliate-payouts-table`) ด้วย: wrapper เองอยู่ใต้ div
// `overflow-hidden` ของ DataTable จึง `scrollWidth` เท่ากับ `clientWidth` เสมอ (assert อย่างเดียวจะผ่านแม้ตารางล้น)

/** scrollWidth/clientWidth ของ wrapper และของกล่องเลื่อนตัวแรกระหว่าง table กับ wrapper */
const overflowOf = (wrapper: Locator) =>
  wrapper.evaluate((el) => {
    let box: HTMLElement | null = el.querySelector("table")
    for (box = box?.parentElement ?? null; box && box !== el; box = box.parentElement) {
      if (["auto", "scroll"].includes(getComputedStyle(box).overflowX)) break
    }
    const scroller = box && box !== el ? box : null
    return {
      wrapper: { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth },
      scroller: scroller ? { scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth } : null,
      table: el.querySelector("table")?.getBoundingClientRect().width ?? -1,
    }
  })

type Viewport = { width: number; height: number }

/**
 * payout draft ของ affiliate ชื่อยาวที่ `viewport`: ตารางไม่ล้นแนวนอน, ปุ่ม … ทุกแถวในจอ, tooltip ชื่อเต็ม (AC-46)
 * `affiliateCell` (ถ้ามี) ตรวจความกว้างของ cell Affiliate เพิ่ม (AC-50) ก่อนตรวจ tooltip — ข้อมูลของ run ใช้ prefix/code ต่อ task (กฎ 42f)
 */
async function expectPayoutsFit(
  { page, request, step, evidence }: { page: Page; request: APIRequestContext; step: Step; evidence: (name: string) => Promise<void> },
  viewport: Viewport,
  { prefix, code, affiliateCell: checkAffiliateCell }: { prefix: string; code: string; affiliateCell?: (cell: Locator) => Promise<void> },
) {
  const admin = await adminHeaders(request)
  const affiliate = await createLongAffiliate(request, admin, { prefix, code })
  // แถวที่ใกล้ข้อมูลจริง: reference ยาว (ถูกตัดที่ maxSize), period หลายวัน, id ยาวเท่า id จริง — draft เพื่อให้มีปุ่ม … (กฎ 10)
  const ids = await insertDraftPayouts(affiliate.id, 1, new Date(), { reference: longReference(tag(prefix)), periodDays: 45 })
  try {
    await loginAdmin(page)
    await openTableAt(page, request, admin, PAYOUTS, ids[0])
    const table = page.getByTestId(PAYOUTS.testid)
    const row = table.locator("tbody tr", { hasText: ids[0] })
    const affiliateCell = row.locator("td").filter({ has: page.getByTestId("affiliate-row-affiliate") })
    // รอชื่อโหลด (ก่อนโหลดแสดง affiliate_id) — ความกว้างวัดหลังข้อความจริงอยู่ใน cell
    await expect(affiliateCell).toContainText(affiliate.name, { timeout: 30_000 })

    await step("ตาราง Payouts ไม่ล้นแนวนอน (scrollWidth ≤ clientWidth + 1)", async () => {
      const o = await overflowOf(table)
      expect(o.scroller, "กล่องเลื่อนของ DataTable ภายใน wrapper").not.toBeNull()
      expect(o.wrapper.scrollWidth, `wrapper ${JSON.stringify(o)}`).toBeLessThanOrEqual(o.wrapper.clientWidth + 1)
      expect(o.scroller!.scrollWidth, `กล่องเลื่อน ${JSON.stringify(o)}`).toBeLessThanOrEqual(o.scroller!.clientWidth + 1)
      expect(await tableScrollLeft(table)).toBe(0)
    })

    await step("ปุ่ม … ของทุกแถวอยู่ในจอแนวนอน", async () => {
      const buttons = table.getByTestId(PAYOUTS.trigger!)
      // อย่างน้อยแถวของ test นี้ (draft) — กัน vacuous
      expect(await buttons.count()).toBeGreaterThanOrEqual(1)
      for (const button of await buttons.all()) {
        const box = await button.boundingBox()
        expect(box, "boundingBox ของปุ่ม …").not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
      }
    })

    if (checkAffiliateCell) await checkAffiliateCell(affiliateCell)

    await step("hover cell Affiliate ที่ถูกตัด → tooltip ของ TruncatedCell แสดงชื่อเต็ม", async () => {
      await row.locator("td").first().evaluate((td) => td.scrollIntoView({ block: "center", inline: "start" }))
      const metrics = await cellMetrics(affiliateCell)
      // ข้อความถูกตัดจริง (กัน tooltip ไม่ขึ้นเพราะชื่อไม่ยาวพอ)
      expect(metrics.scrollWidth, "cell Affiliate ถูกตัด").toBeGreaterThan(metrics.clientWidth)
      const tooltip = page.getByRole("tooltip").filter({ hasText: affiliate.name })
      await affiliateCell.locator(".truncate").first().hover()
      await expect(tooltip).toBeVisible()
      await expect(tooltip).toHaveText(`${affiliate.name} ${affiliate.email}`)
    })
    await evidence(`01-payouts-fit-${viewport.width}`)
  } finally {
    await deleteAllThenExpectOk(request, admin, ids.map((id) => `/admin/affiliate/payouts/${id}`))
  }
}

test.describe("ADM-41: ตาราง Payouts ไม่ล้นแนวนอนที่ 1280/1440", () => {
  test.use({ evidenceTarget: { feature: "admin-ui", taskId: "ADM-41" } })

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    test.describe(`${viewport.width}×${viewport.height}`, () => {
      test.use({ viewport })

      test(`AC-46: payouts ${viewport.width} — ตารางไม่ล้นแนวนอน, ปุ่ม … ทุกแถวในจอ, tooltip ชื่อเต็ม`, async ({ page, request, step, evidence }) => {
        test.setTimeout(120_000)
        await expectPayoutsFit({ page, request, step, evidence }, viewport, { prefix: "adm41", code: "a41" })
      })
    })
  }
})

// ADM-45 (spec 08 AC-50, กฎ 49): คอลัมน์ Affiliate ของ Payouts ที่ ADM-41 ลดเหลือเนื้อหา 126px ทุกจอ (qa ADM-41: เห็นชื่อ ~15 ตัวแม้จอใหญ่)
// → ที่ 1920 เนื้อหา cell กว้าง 240–250.5px (เพดานกฎ 41) ขณะที่ 1280/1440 ยังไม่ล้น (กฎ 45) และ tooltip ยังแสดงชื่อเต็ม
test.describe("ADM-45: คอลัมน์ Affiliate ของ Payouts กว้างขึ้นที่จอใหญ่", () => {
  test.use({ evidenceTarget: { feature: "admin-ui", taskId: "ADM-45" } })
  const WIDE_MIN = 240

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
  ]) {
    test.describe(`${viewport.width}×${viewport.height}`, () => {
      test.use({ viewport })

      test(`AC-50: payouts ${viewport.width} — คอลัมน์ Affiliate ตามความกว้างจอ, ตารางไม่ล้น, tooltip ชื่อเต็ม`, async ({ page, request, step, evidence }) => {
        test.setTimeout(120_000)
        await expectPayoutsFit({ page, request, step, evidence }, viewport, {
          prefix: "adm45",
          code: "a45",
          affiliateCell: (cell) =>
            step(`เนื้อหา cell Affiliate ${viewport.width >= 1920 ? `∈ [${WIDE_MIN}, 250.5]` : "≤ 250.5"}px`, async () => {
              const { content } = await cellMetrics(cell)
              expect(content, "เนื้อหา cell Affiliate (ไม่รวม padding)").toBeLessThanOrEqual(CONTENT_MAX + 0.5)
              if (viewport.width >= 1920) expect(content, "เนื้อหา cell Affiliate ที่ 1920").toBeGreaterThanOrEqual(WIDE_MIN)
            }),
        })
      })
    })
  }
})
