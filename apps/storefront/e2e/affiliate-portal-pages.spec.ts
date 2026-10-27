import { APIRequestContext, Page } from "@playwright/test"
import crypto from "node:crypto"
import { Client } from "pg"

import { createActiveAffiliate } from "./support/affiliate"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, Headers, adminHeaders } from "./support/medusa"
import { THAI, expectThai } from "./support/thai-text"

// AF-8b (spec 05 กฎ 33, AC-40): แถบนำทางของ portal + หน้า Programs / Earnings / Payouts / Profile
// และ `affiliate-status-notice` ตามสิทธิ์ Q6 — หา element ด้วย data-testid (ADR-014)
test.use({ evidenceTarget: { feature: "affiliate", taskId: "AF-8b" } })

const DAY = 24 * 60 * 60 * 1000

/**
 * entry ใส่ตรงใน DB (CI ตั้ง DATABASE_URL ให้ job e2e) แบบเดียวกับ AF-6: entry approved/reversed ผ่าน flow จริง
 * ต้องรอ maturity job รายวัน (AF-4) ซึ่ง e2e สั่งรันไม่ได้ — payout สร้าง/จ่ายผ่าน admin API จริง
 */
async function insertEntries(
  affiliateId: string,
  programId: string,
  entries: { status: string; amount: number; createdAt: Date }[]
) {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    for (const e of entries) {
      const id = crypto.randomBytes(6).toString("hex")
      await db.query(
        `insert into affiliate_commission_entry
           (id, affiliate_id, program_id, order_id, amount, raw_amount, currency, status, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, 'thb', $7, $8, $8)`,
        [
          `affcom_e2eaf8b${id}`,
          affiliateId,
          programId,
          `order_e2e_af8b_${id}`,
          e.amount,
          JSON.stringify({ value: String(e.amount), precision: 20 }),
          e.status,
          e.createdAt,
        ]
      )
    }
  } finally {
    await db.end()
  }
}

async function post(request: APIRequestContext, admin: Headers, path: string, data: Record<string, unknown>) {
  const res = await request.post(`${BACKEND_URL}${path}`, { headers: admin, data })
  expect(res.status(), `POST ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto(`/${CC}/affiliate/login`)
  await page.getByTestId("affiliate-login-email").fill(who.email)
  await page.getByTestId("affiliate-login-password").fill(who.password)
  await page.getByTestId("affiliate-login-submit").click()
  await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate(\\?|$)`))
}

/** ยอดเงินตรงตัว: "฿30" ไม่ match "฿300" / "฿30.5" */
const money = (text: string) => new RegExp(`${text.replace("-", "[-−]")}(?![\\d.,])`)

test("AC-40: nav ของ portal → Programs, Earnings (reversed แยกติดลบ), Payouts ไม่มี reference, Profile", async ({
  page,
  request,
  step,
  evidence,
}) => {
  const admin = await adminHeaders(request)
  const ann = await createActiveAffiliate(request, admin, "e2e-af8b")
  const run = crypto.randomBytes(3).toString("hex")
  const names = { active: `E2E AF-8b active ${run}`, upcoming: `E2E AF-8b upcoming ${run}` }

  await step("ข้อมูลตาม AC-40: โปรแกรม active 1 + upcoming 1, entry และ payout paid ที่มี reference", async () => {
    const program = (name: string, startsIn: number, endsIn: number) =>
      post(request, admin, "/admin/affiliate/programs", {
        name,
        starts_at: new Date(Date.now() + startsIn).toISOString(),
        ends_at: new Date(Date.now() + endsIn).toISOString(),
        commission_value: 10,
        announce_text: `ประกาศ ${run}`,
        // variant ที่ไม่มีจริง: โปรแกรมขึ้นใน /affiliate/me/programs แต่ไม่ไปแย่งการ์ดสินค้าของ e2e อื่น (AF-8a, tracking)
        scope: { variant_ids: [`variant_e2e_af8b_${run}`] },
        status: "published",
      })
    const { program: active } = await program(names.active, -30 * DAY, 2 * DAY)
    await program(names.upcoming, DAY, 5 * DAY)

    // ฿100 approved ในงวดของ payout → mark paid → paid ฿100; ที่เหลือสร้างหลังงวด จึงไม่อยู่ใน payout
    await insertEntries(ann.id, active.id, [{ status: "approved", amount: 100, createdAt: new Date(Date.now() - 10 * DAY) }])
    const { payout } = await post(request, admin, "/admin/affiliate/payouts", {
      affiliate_id: ann.id,
      period_from: new Date(Date.now() - 15 * DAY).toISOString(),
      period_to: new Date(Date.now() - 5 * DAY).toISOString(),
    })
    await post(request, admin, `/admin/affiliate/payouts/${payout.id}/mark-paid`, { reference: "TRX-AC40" })
    await insertEntries(ann.id, active.id, [
      { status: "pending", amount: 30, createdAt: new Date() },
      { status: "approved", amount: 50, createdAt: new Date() },
      { status: "reversed", amount: -20, createdAt: new Date() },
    ])
  })

  await step("login → แถบนำทางของ portal ครบ 5 เมนูเป็นภาษาไทย", async () => {
    await login(page, ann)
    await expectThai(page, [
      "affiliate-nav-products",
      "affiliate-nav-programs",
      "affiliate-nav-earnings",
      "affiliate-nav-payouts",
      "affiliate-nav-profile",
    ])
  })

  await step("Programs: แถวของโปรแกรม active และ upcoming พร้อมป้ายสถานะ", async () => {
    await page.getByTestId("affiliate-nav-programs").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate/programs`))
    const rows = page.getByTestId("affiliate-program-row")
    expect(await rows.count()).toBeGreaterThanOrEqual(2)
    for (const [state, name] of Object.entries(names)) {
      const row = rows.filter({ hasText: name })
      await expect(row).toHaveCount(1)
      await expect(row).toHaveAttribute("data-state", state)
      await expect(row.getByTestId("affiliate-program-state")).toHaveText(THAI)
      await expect(row).toContainText("10%")
      await expect(row).toContainText(`ประกาศ ${run}`)
    }
    await expect(page.getByTestId("affiliate-programs-page")).toHaveText(THAI)
    await evidence("01-programs")
  })

  await step("Earnings: ยอดต่อสถานะตามแถวของ API — approved ฿50 (ไม่หัก reversed) และ reversed −฿20 แยก", async () => {
    await page.getByTestId("affiliate-nav-earnings").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate/earnings`))
    await expect(page.getByTestId("affiliate-earnings-pending")).toHaveText(money("฿30"))
    await expect(page.getByTestId("affiliate-earnings-approved")).toHaveText(money("฿50"))
    await expect(page.getByTestId("affiliate-earnings-paid")).toHaveText(money("฿100"))
    await expect(page.getByTestId("affiliate-earnings-reversed")).toHaveText(money("-฿20"))
    await expectThai(page, ["affiliate-earnings-reversed-note"])
    await evidence("02-earnings")
  })

  await step("Payouts: 1 แถว และไม่มี reference ในหน้า (Q14)", async () => {
    await page.getByTestId("affiliate-nav-payouts").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate/payouts`))
    await expect(page.getByTestId("affiliate-payout-row")).toHaveCount(1)
    await expect(page.getByTestId("affiliate-payout-row")).toHaveText(money("฿100"))
    await expect(page.getByTestId("affiliate-payouts-page")).toHaveText(THAI)
    expect(await page.textContent("body")).not.toContain("TRX-AC40")
    await evidence("03-payouts")
  })

  await step("Profile: ลิงก์เริ่มต้น /r/<code> คัดลอกได้ และสถานะข้อมูลรับเงินเป็นไทย", async () => {
    await page.getByTestId("affiliate-nav-profile").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate/profile`))
    await expect(page.getByTestId("affiliate-default-link")).toHaveText(new RegExp(`/r/${ann.code}$`))
    await expectThai(page, ["affiliate-payout-info-status"])
    await expect(page.getByTestId("affiliate-profile-page")).toContainText(ann.email)
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
    await page.getByTestId("affiliate-default-link-copy").click()
    await expect(page.getByTestId("affiliate-default-link-status")).toHaveText(THAI)
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`/r/${ann.code}$`))
    await evidence("04-profile")
  })
})

test("AC-40: affiliate ที่ถูกระงับ → Products/Programs แสดง affiliate-status-notice, Earnings/Payouts เปิดได้", async ({
  page,
  request,
  step,
  evidence,
}) => {
  const admin = await adminHeaders(request)
  const bob = await createActiveAffiliate(request, admin, "e2e-af8b-bob")
  await post(request, admin, `/admin/affiliate/affiliates/${bob.id}`, { status: "suspended" })

  await step("login แล้ว Products และ Programs แสดงข้อความสถานะเป็นไทย ไม่ใช่หน้า error", async () => {
    await login(page, bob)
    await expectThai(page, ["affiliate-status-notice"])
    for (const path of ["", "/programs"]) {
      const res = await page.goto(`/${CC}/affiliate${path}`)
      expect(res?.status(), path).toBeLessThan(500)
      await expectThai(page, ["affiliate-status-notice"])
      await expect(page.getByTestId("affiliate-program-row")).toHaveCount(0)
    }
    await evidence("05-suspended-notice")
  })

  await step("Earnings เปิดได้ — ไม่มี entry reversed → ฿0", async () => {
    await page.getByTestId("affiliate-nav-earnings").click()
    await expect(page.getByTestId("affiliate-status-notice")).toHaveCount(0)
    await expect(page.getByTestId("affiliate-earnings-reversed")).toHaveText(money("฿0"))
  })

  await step("Payouts เปิดได้ (ยังไม่มีรายการ)", async () => {
    await page.getByTestId("affiliate-nav-payouts").click()
    await expect(page.getByTestId("affiliate-status-notice")).toHaveCount(0)
    await expectThai(page, ["affiliate-payouts-empty"])
  })
})
