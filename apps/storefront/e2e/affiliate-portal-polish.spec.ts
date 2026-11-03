import { Page } from "@playwright/test"
import crypto from "node:crypto"
import { Client } from "pg"

import { createActiveAffiliate } from "./support/affiliate"
import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, adminHeaders } from "./support/medusa"
import { expectThai } from "./support/thai-text"

// AF-N3 (spec 05 กฎ 40, AC-47): หน้าเกินจำนวนของ Programs/Payouts และยอด reversed ขึ้นต้นด้วย − (U+2212)
// ตรวจที่จอ 375px — หา element ด้วย data-testid (ADR-014)
test.use({ evidenceTarget: { feature: "affiliate", taskId: "AF-N3" }, viewport: { width: 375, height: 812 } })

/** entry reversed ใส่ตรงใน DB (CI ตั้ง DATABASE_URL ให้ job e2e) — ได้ผ่าน flow จริงต้องมี order ที่ถูกคืนเงินหลัง attribution */
async function insertReversedEntry(affiliateId: string, amount: number) {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    const id = crypto.randomBytes(6).toString("hex")
    await db.query(
      `insert into affiliate_commission_entry
         (id, affiliate_id, program_id, order_id, amount, raw_amount, currency, status, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, 'thb', 'reversed', now(), now())`,
      [
        `affcom_e2eafn3${id}`,
        affiliateId,
        `prog_e2e_afn3_${id}`,
        `order_e2e_afn3_${id}`,
        amount,
        JSON.stringify({ value: String(amount), precision: 20 }),
      ]
    )
  } finally {
    await db.end()
  }
}

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto(`/${CC}/affiliate/login`)
  await page.getByTestId("affiliate-login-email").fill(who.email)
  await page.getByTestId("affiliate-login-password").fill(who.password)
  await page.getByTestId("affiliate-login-submit").click()
  await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate(\\?|$)`))
}

const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)

test("AC-47: ?page=99 ของ Payouts/Programs → affiliate-page-out-of-range ไทย + ลิงก์หน้าแรก; reversed ขึ้นต้นด้วย −", async ({
  page,
  request,
  step,
  evidence,
}) => {
  const admin = await adminHeaders(request)
  const ann = await createActiveAffiliate(request, admin, "e2e-afn3")
  await insertReversedEntry(ann.id, -20.5)
  await login(page, ann)

  await step("/th/affiliate/payouts?page=99 → affiliate-page-out-of-range ไม่ใช่ ยังไม่มี…", async () => {
    await page.goto(`/${CC}/affiliate/payouts?page=99`)
    await expectThai(page, ["affiliate-page-out-of-range"])
    await expect(page.getByTestId("affiliate-payouts-empty")).toHaveCount(0)
    await noHorizontalScroll(page)
    await evidence("01-payouts-out-of-range-375")
  })

  await step("ลิงก์กลับหน้าแรก → Payouts หน้า 1 (ว่าง → ยังไม่มีรายการ)", async () => {
    await page.getByTestId("affiliate-page-out-of-range-first").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate/payouts$`))
    await expectThai(page, ["affiliate-payouts-empty"])
    await expect(page.getByTestId("affiliate-page-out-of-range")).toHaveCount(0)
  })

  await step("/th/affiliate/programs?page=99 → affiliate-page-out-of-range", async () => {
    await page.goto(`/${CC}/affiliate/programs?page=99`)
    await expectThai(page, ["affiliate-page-out-of-range"])
    await expect(page.getByTestId("affiliate-programs-empty")).toHaveCount(0)
    await expect(page.getByTestId("affiliate-page-out-of-range-first")).toHaveAttribute(
      "href",
      `/${CC}/affiliate/programs`
    )
  })

  await step("Earnings: ยอด reversed −฿20.50 (U+2212) และสถานะที่ไม่มีแถวเป็น ฿0", async () => {
    await page.goto(`/${CC}/affiliate/earnings`)
    await expect(page.getByTestId("affiliate-earnings-reversed")).toContainText("−฿20.50")
    await expect(page.getByTestId("affiliate-earnings-reversed")).not.toContainText("-฿")
    await expect(page.getByTestId("affiliate-earnings-pending")).toHaveText(/฿0(?![\d.,])/)
    await noHorizontalScroll(page)
    await evidence("02-earnings-reversed-375")
  })
})
