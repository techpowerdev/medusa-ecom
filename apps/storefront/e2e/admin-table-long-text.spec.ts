import { APIRequestContext, Locator, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin, pageOffsetOf, waitMenuOpened } from "./support/admin"
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
const tag = () => `adm35-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`
type Step = (title: string, body: () => Promise<void>) => Promise<void>

/** ชื่อยาว 370 ตัวอักษร ไทยปนอังกฤษ — หลัง run tag เป็นช่วงไม่มีช่องว่างยาว ≥ 100 ตัว (ตัดบรรทัดไม่ได้) */
const longName = (run: string) => `${run} ${"ชื่อยาวมากLongName".repeat(30)}`.slice(0, 370)
/** ชื่อสั้น ≤ 20 ตัวอักษร (ไม่ถูกตัด) */
const shortName = () => `S-${Math.random().toString(36).slice(2, 10)}`

async function post(request: APIRequestContext, admin: Headers, path: string, data: Record<string, unknown>) {
  const res = await request.post(`${BACKEND_URL}${path}`, { headers: admin, data })
  expect(res.status(), `POST ${path}: ${await res.text()}`).toBe(200)
  return res.json()
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
  await expect(button).toBeVisible({ timeout: 30_000 })

  await step("แถวชื่อยาว: ปุ่ม … อยู่ในจอโดยไม่เลื่อนแนวนอน และเนื้อหา cell ชื่อกว้าง ≤ 250px", async () => {
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
    const tooltip = page.getByRole("tooltip")
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toHaveText(long)
  })

  await step("คลิก … → เมนู 1 ตัว → Escape ครั้งเดียวปิด (กฎ 37)", async () => {
    // ออกจากชื่อหลายจังหวะ: Radix Tooltip เปิดค้างใน "grace area" ระหว่างทางไป tooltip จนกว่าจะมี pointermove นอกพื้นที่นั้น
    await page.mouse.move(0, 0, { steps: 5 })
    await expect(page.getByRole("tooltip")).toHaveCount(0)
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
  trigger: string
  /** แท็บที่ต้องคลิกก่อนเห็นตาราง (ถ้ามี) */
  tab?: string
}

async function expectTable(
  page: Page,
  request: APIRequestContext,
  admin: Headers,
  t: Table,
  { longId, shortId, long, short, step }: { longId: string; shortId: string; long: string; short: string; step: Step }
) {
  const table = page.getByTestId(t.testid)
  const open = async (id: string) => {
    const offset = await pageOffsetOf(request, admin, { ...t.api, id })
    await page.goto(`${BACKEND_URL}${t.url}${offset ? `?${t.prefix}_offset=${offset}` : ""}`)
    if (t.tab) await page.getByTestId(t.tab).click()
  }
  // แถวสั้นและยาวอาจอยู่คนละหน้า (partners เรียงตามชื่อ) — เปิดหน้าของแต่ละแถวเอง
  await open(shortId)
  await expectShortRowFull(table, short, step)
  await open(longId)
  await expectLongRowContained(page, { table, trigger: t.trigger, long, step })
}

test("AC-40a: e-voucher partners — ชื่อยาวไม่ดันปุ่ม … ออกนอกจอ, tooltip ชื่อเต็ม", async ({ page, request, step, evidence }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const long = longName(tag())
  const short = shortName()
  const ids: string[] = []
  try {
    for (const name of [long, short]) ids.push((await post(request, admin, "/admin/evoucher/partners", { name })).partner.id)
    await loginAdmin(page)
    const table: Table = {
      api: { path: "/admin/evoucher/partners", key: "partners", query: "order=name" },
      url: "/app/evouchers",
      prefix: "partners",
      testid: "evoucher-partners-table",
      trigger: "evoucher-partner-row-actions",
    }
    await expectTable(page, request, admin, table, { longId: ids[0], shortId: ids[1], long, short, step })
    await evidence("01-partners-long-name")
  } finally {
    await deleteAllThenExpectOk(request, admin, ids.map((id) => `/admin/evoucher/partners/${id}`))
  }
})

test("AC-40a: affiliate programs — ชื่อยาวไม่ดันปุ่ม … ออกนอกจอ, tooltip ชื่อเต็ม", async ({ page, request, step, evidence }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const long = longName(tag())
  const short = shortName()
  const ids: string[] = []
  try {
    // draft: ลบได้ใน finally (โปรแกรม published/ended ลบไม่ได้)
    for (const name of [long, short]) {
      const { program } = await post(request, admin, "/admin/affiliate/programs", {
        name,
        starts_at: new Date(Date.now() + 30 * DAY).toISOString(),
        ends_at: new Date(Date.now() + 60 * DAY).toISOString(),
        commission_value: 10,
        scope: { all: true },
        status: "draft",
      })
      ids.push(program.id)
    }
    await loginAdmin(page)
    const table: Table = {
      // ลำดับเริ่มต้นของ API (-created_at, id) = ลำดับของตาราง (หน้า admin ไม่ส่ง order)
      api: { path: "/admin/affiliate/programs", key: "programs" },
      url: "/app/affiliate",
      prefix: "programs",
      testid: "affiliate-programs-table",
      trigger: "affiliate-program-row-actions",
    }
    await expectTable(page, request, admin, table, { longId: ids[0], shortId: ids[1], long, short, step })
    await evidence("02-programs-long-name")
  } finally {
    await deleteAllThenExpectOk(request, admin, ids.map((id) => `/admin/affiliate/programs/${id}`))
  }
})
