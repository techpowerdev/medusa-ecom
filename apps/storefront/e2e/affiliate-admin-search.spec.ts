import { Page, Response } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { createActiveAffiliate } from "./support/affiliate"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders } from "./support/medusa"

// ADM-40 (spec 08 กฎ 44, AC-45): ช่องค้นหาของ DataTable ในแท็บ Affiliates → `q` ของ `GET /admin/affiliate/affiliates` (ADM-17)
// เก็บใน URL (`affiliates_q`) reload แล้วคงค่า; ช่องค้นหาเป็นของ DataTable ของ dashboard (ใส่ data-testid ไม่ได้) จึงหาด้วย role `searchbox`
// ภายใน wrapper `affiliate-affiliates-table` แบบ product picker (group-buy-admin-form.spec.ts)
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-40" },
})

const AFFILIATES = "/admin/affiliate/affiliates"

/** รอ response ของรายการ affiliate ที่ `q` ตรงกับคำค้น (null = ไม่มี q) */
const listed = (page: Page, q: string | null) =>
  page.waitForResponse((r: Response) => {
    const url = new URL(r.url())
    return r.request().method() === "GET" && url.pathname === AFFILIATES && url.searchParams.get("q") === q
  })

test("AC-45: ค้นหาชื่อ affiliate → q ไปที่ API, เหลือ 1 แถว, อยู่ใน URL และคงหลัง reload; ล้างช่อง → แถวกลับ", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold)
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  // spec 08 กฎ 32f/33: `q` ของ Medusa แยกคำแล้ว AND ทีละคำ — tag ตัวอักษรล้วน (ไม่ชนคำค้นที่มีตัวเลข) ใช้ทั้งชื่อ, code และอีเมล
  const tag = `adm${String(Date.now()).replace(/\d/g, (digit) => "abcdefghij"[Number(digit)])}`
  const names = ["alpha", "bravo", "charlie"]
  // กฎ 44: คำค้นเปลี่ยนแล้วกลับหน้าแรก — ต้องมีอย่างน้อย 2 หน้า (PAGE_SIZE 20) จึงสร้างตัวเติมก่อน 3 รายที่ค้น (ใหม่สุดอยู่หน้าแรก)
  for (const filler of "abcdefghijklmnopqrst") {
    await createActiveAffiliate(request, admin, { name: `ADM40 ${tag} filler`, code: `${tag}-filler-${filler}` })
  }
  for (const name of names) {
    await createActiveAffiliate(request, admin, { name: `ADM40 ${tag} ${name}`, code: `${tag}-${name}` })
  }
  const term = `${tag} bravo`
  const table = page.getByTestId("affiliate-affiliates-table")
  const search = table.getByRole("searchbox")
  const rows = table.locator("tbody tr")

  await step("เปิดแท็บ Affiliates → แถวของ tag ครบ 3 ราย และมีช่องค้นหา", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await page.getByTestId("affiliate-admin-tab-affiliates").click()
    for (const name of names) {
      await expect(table.getByRole("row").filter({ hasText: `${tag} ${name}` })).toBeVisible({ timeout: 30_000 })
    }
    // ล้มเร็วพร้อมสาเหตุถ้าไม่มีช่องค้นหา (แทนการรอ response จน timeout ของ test)
    await expect(search).toBeVisible()
  })

  await step("อยู่หน้า 2 แล้วพิมพ์ชื่อหนึ่งราย → request มี q ตรงและ offset 0, count = 1, ตารางเหลือ 1 แถว และ URL มี affiliates_q", async () => {
    const second = page.waitForResponse((r) => new URL(r.url()).pathname === AFFILIATES && new URL(r.url()).searchParams.get("offset") === "20")
    await page.goto(`${BACKEND_URL}/app/affiliate?affiliates_offset=20`)
    await page.getByTestId("affiliate-admin-tab-affiliates").click()
    await second
    const searched = listed(page, term)
    await search.fill(term)
    const response = await searched
    expect(new URL(response.url()).searchParams.get("offset")).toBe("0")
    const body = await response.json()
    expect(body.count, `GET ${AFFILIATES}?q=${term}`).toBe(1)
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText(`${tag} bravo`)
    await expect.poll(() => new URL(page.url()).searchParams.get("affiliates_q")).toBe(term)
    expect(new URL(page.url()).searchParams.has("affiliates_offset")).toBe(false)
    await evidence("01-affiliates-search")
  })

  await step("reload → ช่องค้นหาและผลคงเดิม", async () => {
    // ADM-43 (กฎ 47c): แท็บอยู่ใน URL — reload แล้วตาราง Affiliates โหลดเองทันที จึงรอ response ตั้งแต่ก่อน reload
    const searched = listed(page, term)
    await page.reload()
    expect(new URL(page.url()).searchParams.get("affiliates_q")).toBe(term)
    await expect(page.getByTestId("affiliate-admin-tab-affiliates")).toHaveAttribute("aria-selected", "true")
    expect((await (await searched).json()).count).toBe(1)
    await expect(search).toHaveValue(term)
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText(`${tag} bravo`)
  })

  await step("คำค้นที่ไม่ตรงใคร → empty state 'ไม่พบผล' ของ Medusa ไม่ใช่ข้อความของตารางว่าง", async () => {
    const none = `${tag} zulu`
    const searched = listed(page, none)
    await search.fill(none)
    expect((await (await searched).json()).count).toBe(0)
    await expect(table).toContainText("No results")
    await expect(table).not.toContainText("No affiliates yet")
  })

  await step("ล้างช่อง → request ไม่มี q, แถวของ tag กลับมาครบ และ URL ไม่มี affiliates_q", async () => {
    const all = listed(page, null)
    await search.fill("")
    expect((await (await all).json()).count).toBeGreaterThanOrEqual(3)
    for (const name of names) {
      await expect(table.getByRole("row").filter({ hasText: `${tag} ${name}` })).toBeVisible()
    }
    await expect.poll(() => new URL(page.url()).searchParams.has("affiliates_q")).toBe(false)
  })
})

// ADM-43 (spec 08 กฎ 47, AC-48 (b)): ค้นด้วย code ได้ และแท็บที่เลือกอยู่ใน URL (`?tab=`) — reload แล้วไม่เด้งกลับ Programs
test.describe("ADM-43", () => {
  test.use({ evidenceTarget: { feature: "admin-ui", taskId: "ADM-43" } })

  test("AC-48: แท็บ Affiliates อยู่ใน URL คงหลัง reload และค้นด้วย code ได้; tab ผิด → Programs", async ({ page, request, step }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    // กฎ 33: tag ตัวอักษรล้วน; code ไม่อยู่ในชื่อ/อีเมล — ผลที่ได้มาจาก code เท่านั้น
    const tag = `adm${String(Date.now()).replace(/\d/g, (digit) => "abcdefghij"[Number(digit)])}`
    const code = `${tag}xray`
    await createActiveAffiliate(request, admin, { name: `ADM43 ${tag} target`, code, email: `${tag}-target@example.com` })
    await createActiveAffiliate(request, admin, { name: `ADM43 ${tag} other`, code: `${tag}yank`, email: `${tag}-other@example.com` })
    const table = page.getByTestId("affiliate-affiliates-table")
    const rows = table.locator("tbody tr")
    const tab = (key: string) => page.getByTestId(`affiliate-admin-tab-${key}`)

    await step("เลือกแท็บ Affiliates → URL มี tab=affiliates", async () => {
      await loginAdmin(page)
      await page.goto(`${BACKEND_URL}/app/affiliate`)
      await expect(tab("programs")).toHaveAttribute("aria-selected", "true")
      await tab("affiliates").click()
      await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe("affiliates")
    })

    await step("reload → แท็บ Affiliates ยังถูกเลือก (ไม่กลับ Programs)", async () => {
      await page.reload()
      await expect(tab("affiliates")).toHaveAttribute("aria-selected", "true")
      await expect(table.getByRole("row").filter({ hasText: `${tag} target` })).toBeVisible({ timeout: 30_000 })
    })

    await step("ค้นด้วย code → count 1 แถวเดียว; tab และ affiliates_q อยู่ใน URL พร้อมกัน", async () => {
      const searched = listed(page, code)
      await table.getByRole("searchbox").fill(code)
      expect((await (await searched).json()).count).toBe(1)
      await expect(rows).toHaveCount(1)
      await expect(rows.first()).toContainText(`${tag} target`)
      await expect.poll(() => new URL(page.url()).searchParams.get("affiliates_q")).toBe(code)
      expect(new URL(page.url()).searchParams.get("tab")).toBe("affiliates")
    })

    await step("สลับแท็บแล้วกลับมา → affiliates_q เดิมยังอยู่", async () => {
      await tab("ledger").click()
      await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe("ledger")
      expect(new URL(page.url()).searchParams.get("affiliates_q")).toBe(code)
      await tab("affiliates").click()
      await expect(table.getByRole("searchbox")).toHaveValue(code)
      await expect(rows).toHaveCount(1)
    })

    // qa #491 D-1: Radix Tabs (automatic) เรียก onValueChange ทั้ง mousedown และ focus ก่อน router commit → คลิกเดียวได้ 2 history entry
    await step("คลิกแท็บ 1 ครั้ง = history 1 รายการ; back 1 ครั้งย้อนไปแท็บก่อนหน้า", async () => {
      const before = await page.evaluate(() => history.length)
      await tab("payouts").click()
      await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe("payouts")
      expect(await page.evaluate(() => history.length)).toBe(before + 1)
      await page.goBack()
      await expect(tab("affiliates")).toHaveAttribute("aria-selected", "true")
      expect(new URL(page.url()).searchParams.get("tab")).toBe("affiliates")
      await page.goBack()
      await expect(tab("ledger")).toHaveAttribute("aria-selected", "true")
      expect(new URL(page.url()).searchParams.get("tab")).toBe("ledger")
    })

    await step("tab ที่ไม่รู้จัก → Programs", async () => {
      await page.goto(`${BACKEND_URL}/app/affiliate?tab=nope`)
      await expect(tab("programs")).toHaveAttribute("aria-selected", "true")
    })
  })
})
