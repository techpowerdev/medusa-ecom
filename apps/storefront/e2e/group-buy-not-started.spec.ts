import { Client } from "pg"

import { expect, test } from "./support/fixtures"
import { teamGroup } from "./support/group-buy"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"
import { expectThai } from "./support/thai-text"

// GB-24 (spec 04 กฎข้อ 47, 49, AC-66): แคมเปญที่ยังไม่เริ่มซ่อนฟอร์ม join + ลิงก์แชร์มี country code
test.use({ evidenceTarget: { feature: "group-buying", taskId: "GB-24" } })

const HOUR = 60 * 60 * 1000

/**
 * เลื่อน `starts_at` ของ Medusa campaign ใน DB ตรง (CI ตั้ง DATABASE_URL) — สร้างกลุ่มได้เฉพาะตอนแคมเปญอยู่ในช่วง (กฎข้อ 10)
 * จึงต้องเลื่อนหลังสร้างกลุ่ม; ไม่ใช้ `POST /admin/campaigns/:id` เพราะ GB-25 ล็อก route นั้นของแคมเปญ group buy ที่ไม่ใช่ draft (กฎข้อ 48)
 */
async function moveStartsAt(promotionCampaignId: string, startsAt: Date) {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    const { rowCount } = await db.query("UPDATE promotion_campaign SET starts_at = $1 WHERE id = $2", [
      startsAt,
      promotionCampaignId,
    ])
    expect(rowCount, "อัปเดต starts_at").toBe(1)
  } finally {
    await db.end()
  }
}

test.describe("หน้ากลุ่ม: แคมเปญยังไม่เริ่ม และลิงก์แชร์ (AC-66)", () => {
  test("(a) starts_at ในอนาคต → ไม่มีฟอร์ม join แสดงเวลาเริ่มเป็นภาษาไทย", async ({ page, request, evidence }) => {
    const ctx = await teamGroup(request, 3)
    await moveStartsAt(ctx.promotionCampaignId, new Date(Date.now() + 24 * HOUR))

    await page.goto(`/${CC}/g/${ctx.token}`)
    await expect(page.getByTestId("group-page")).toBeVisible()
    await expect(page.getByTestId("group-starts-at")).toContainText(/\d{1,2}:\d{2}/)
    await expectThai(page, ["group-starts-at"])
    await expect(page.getByTestId("group-join")).toHaveCount(0)
    await expect(page.getByTestId("group-join-button")).toHaveCount(0)
    await expect(page.getByTestId("group-create-team-button")).toHaveCount(0)
    await evidence("01-group-not-started")
  })

  test("(b) แคมเปญเริ่มแล้ว → group-share-link เป็น /th/g/<token> และมีฟอร์ม join", async ({ page, request }) => {
    const ctx = await teamGroup(request, 3)

    await page.goto(`/${CC}/g/${ctx.token}`)
    const href = await page.getByTestId("group-share-link").getAttribute("href")
    expect(new URL(href!).pathname).toBe(`/${CC}/g/${ctx.token}`)
    await expect(page.getByTestId("group-join-button")).toBeVisible()
    await expect(page.getByTestId("group-starts-at")).toHaveCount(0)
  })
})

// GB-27 (spec 04 กฎข้อ 52, AC-70): แคมเปญยังไม่เริ่ม → ไม่มีนับถอยหลัง แสดงเฉพาะเวลาเริ่ม (setup แบบ AC-66a)
test.describe("หน้ากลุ่ม: นับถอยหลังเมื่อแคมเปญยังไม่เริ่ม (AC-70)", () => {
  test.use({ evidenceTarget: { feature: "group-buying", taskId: "GB-27" } })

  test("(a) starts_at ในอนาคต → ไม่มี group-countdown มี group-starts-at", async ({ page, request, evidence }) => {
    const ctx = await teamGroup(request, 3)
    await moveStartsAt(ctx.promotionCampaignId, new Date(Date.now() + 24 * HOUR))

    await page.goto(`/${CC}/g/${ctx.token}`)
    await expect(page.getByTestId("group-starts-at")).toBeVisible()
    await expect(page.getByTestId("group-countdown")).toHaveCount(0)
    await evidence("01-no-countdown-before-start")
  })

  test("(b) แคมเปญเริ่มแล้ว → มี group-countdown ไม่มี group-starts-at", async ({ page, request }) => {
    const ctx = await teamGroup(request, 3)

    await page.goto(`/${CC}/g/${ctx.token}`)
    await expect(page.getByTestId("group-countdown")).toBeVisible()
    await expect(page.getByTestId("group-starts-at")).toHaveCount(0)
  })
})
