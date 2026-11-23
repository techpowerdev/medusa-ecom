import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"
import { expectThai, latinWordsOutsideAllowList, THAI } from "./support/thai-text"

// CORE-85: spec 01 AC-182 (กฎข้อ 141) — หน้า /<cc>/contact แสดงช่องทางติดต่อจริงที่ owner ส่ง (2026-11-23)
// แต่ละช่องทางมี testid contact-channel และมีลิงก์ mailto:/tel:/https:// ไม่มีเนื้อหาตัวอย่างของ starter
// ข้อความตัวอย่างที่ต้องไม่เหลือ (จากหน้าเดิม: starter CORE-1 + ฉบับแปล CORE-4c2 ที่มี PlaceholderNotice)
const STARTER_SAMPLE = [
  "policy-placeholder", // testid ของ PlaceholderNotice
  "ข้อความตัวอย่าง",
  "Questions about an order",
  "customer service",
  "example.com",
]

test.use({ evidenceTarget: { feature: "core", taskId: "CORE-85" } })

for (const viewport of [
  { width: 1280, height: 720, shot: "01" },
  { width: 375, height: 812, shot: "02" },
]) {
  test(`AC-182: /${CC}/contact มีช่องทางติดต่อจริงที่กดได้ (${viewport.width}px)`, async ({
    page,
    step,
    evidence,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })

    await step("เปิดหน้า contact → เห็นหัวข้อและคำอธิบายภาษาไทย", async () => {
      await page.goto(`/${CC}/contact`)
      await expect(page.getByTestId("policy-page")).toBeVisible()
      await expectThai(page, ["policy-title", "contact-intro", "contact-hours"])
    })

    await step("ทุก contact-channel มีป้ายไทยและลิงก์ mailto:/tel:/https:// (≥ 1 ช่องทาง)", async () => {
      const channels = page.getByTestId("contact-channel")
      const count = await channels.count()
      expect(count).toBeGreaterThanOrEqual(1)
      let linked = 0
      for (let i = 0; i < count; i++) {
        const channel = channels.nth(i)
        await expect(channel).toBeVisible()
        // ป้ายช่องทางเป็นไทยล้วน (ADR-014) — ค่าที่ลิงก์ (อีเมล, LINE ID) เป็นข้อมูลร้านจึงไม่ตรวจ
        const label = (await channel.getByTestId("contact-channel-label").textContent()) ?? ""
        expect(label).toMatch(THAI)
        expect(latinWordsOutsideAllowList(label), label).toEqual([])
        const links = channel.locator("a")
        for (let j = 0; j < (await links.count()); j++) {
          const href = (await links.nth(j).getAttribute("href")) ?? ""
          expect(href, `channel ${i} href`).toMatch(/^(mailto:|tel:|https:\/\/)/)
          // กดได้บนมือถือ: พื้นที่แตะสูง ≥ 44px
          expect((await links.nth(j).boundingBox())?.height ?? 0, `channel ${i} height`).toBeGreaterThanOrEqual(44)
          linked++
        }
      }
      expect(linked).toBeGreaterThanOrEqual(1)
      // ค่าที่ owner ส่ง (ตรวจว่าเป็นข้อมูลจริง ไม่ใช่ตัวอย่าง)
      await expect(page.locator('a[href="mailto:support@khumkha.com"]')).toBeVisible()
      await expect(page.locator('a[href="tel:+6628623331"]')).toBeVisible()
      await expect(page.locator('a[href="https://line.me/R/ti/p/%40khumkha"]')).toBeVisible()
      await expect(page.getByTestId("contact-hours")).toContainText("09:00")
    })

    await step("ช่องทางไม่ล้นจอ (ไม่มี scroll แนวนอน)", async () => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })

    await step("ไม่มีเนื้อหาตัวอย่างของ starter", async () => {
      await expect(page.getByTestId("policy-placeholder")).toHaveCount(0)
      const text = (await page.getByTestId("policy-content").textContent()) ?? ""
      for (const sample of STARTER_SAMPLE) expect(text, sample).not.toContain(sample)
      await evidence(`${viewport.shot}-contact-${viewport.width}`)
    })
  })
}
