import { expect, test } from "./support/fixtures"
import { joinAsNewCustomer, teamGroup } from "./support/group-buy"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"
import { expectThai } from "./support/thai-text"

// GB-7a1 (spec 04 กฎข้อ 29b, AC-16a): หน้ากลุ่ม `/<cc>/g/<token>` อ่านอย่างเดียว สาธารณะ — ข้อมูลจาก GB-11 แบบ no-store
test.use({ evidenceTarget: { feature: "group-buying", taskId: "GB-7a1" } })

/** "HH:MM:SS" หรือ "N วัน HH:MM:SS" → วินาที */
const seconds = (label: string) => {
  const days = Number(/(\d+)\s*วัน/.exec(label)?.[1] ?? 0)
  const [h, m, s] = /(\d+):(\d+):(\d+)/.exec(label)!.slice(1).map(Number)
  return ((days * 24 + h) * 60 + m) * 60 + s
}

test.describe("หน้ากลุ่ม (AC-16a)", () => {
  test("ไม่ login: จำนวนสมาชิก ความคืบหน้า นับถอยหลัง ลิงก์แชร์ และ reload หลังคนที่ 3 join", async ({ page, request, evidence }) => {
    test.setTimeout(120_000)
    const ctx = await teamGroup(request, 3)
    await joinAsNewCustomer(request, ctx)
    await joinAsNewCustomer(request, ctx)

    // ลิงก์แชร์ไม่มี country — middleware เติมให้ (กฎข้อ 29b)
    await page.goto(`/g/${ctx.token}`)
    await expect(page).toHaveURL(new RegExp(`/${CC}/g/${ctx.token}$`))
    await expect(page.getByTestId("group-member-count")).toContainText("2")
    const progress = page.getByTestId("group-progress")
    await expect(progress).toContainText("2")
    await expect(progress).toContainText("3")
    await expect(page.getByTestId("group-product")).toBeVisible()
    await expect(page.getByTestId("group-discount")).toContainText("10%")
    await expect(page.getByTestId("group-share-link")).toHaveAttribute("href", new RegExp(`/g/${ctx.token}$`))
    // หน้าอ่านอย่างเดียว — ปุ่ม join เป็นของ GB-7a2
    await expect(page.getByTestId("group-join-button")).toHaveCount(0)

    const countdown = page.getByTestId("group-countdown")
    await expect(countdown).toContainText(/\d+:\d{2}:\d{2}/)
    const before = seconds((await countdown.textContent())!)
    await page.waitForTimeout(2_500)
    const after = seconds((await countdown.textContent())!)
    expect(after).toBeLessThan(before)
    expect(before).toBeLessThanOrEqual(24 * 3600)

    await expectThai(page, ["group-member-count", "group-progress", "group-countdown", "group-discount"])

    // ปุ่มคัดลอก (ShareLinkButton ร่วม) — ผลแสดงใน status แยกจากปุ่ม
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
    await page.getByTestId("group-share-copy").click()
    await expectThai(page, ["group-share-copy-status"])
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`/g/${ctx.token}$`))
    await evidence("01-group-page-2-of-3")

    await joinAsNewCustomer(request, ctx)
    await page.reload()
    await expect(page.getByTestId("group-member-count")).toContainText("3")
    await expect(page.getByTestId("group-progress")).toContainText("3")
    await evidence("02-group-page-after-third-join")
  })

  test("375px: ไม่เลื่อนแนวนอน", async ({ page, request, evidence }) => {
    const ctx = await teamGroup(request, 3)
    await joinAsNewCustomer(request, ctx)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/${CC}/g/${ctx.token}`)
    await expect(page.getByTestId("group-member-count")).toContainText("1")
    expect(await page.evaluate(() => document.documentElement.scrollWidth), "หน้าไม่เลื่อนแนวนอน").toBeLessThanOrEqual(375)
    await expect(page.getByTestId("group-product").locator("img")).toHaveJSProperty("complete", true)
    await evidence("03-group-page-375")
  })

  test("token ไม่มีจริง → หน้าไม่พบ", async ({ page }) => {
    const res = await page.goto(`/${CC}/g/does-not-exist-gb7a1`)
    expect(res?.status()).toBe(404)
  })
})
