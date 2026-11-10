import { expect, test } from "./support/fixtures"

// spec 01 "Follow-up จาก review/qa" business rule 14, AC-25 (CORE-8)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-8" } })

type FontSample = { className: string; fontFamily: string }

test("class txt-*/*-webs บนหน้าแรกใช้ Noto Sans Thai ก่อน Inter", async ({
  page,
  step,
  evidence,
}) => {
  let samples: FontSample[] = []

  await step("เปิดหน้าแรก", async () => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
  })

  await step(
    "อ่าน computed font-family ของทุก element ที่ใช้ class ของ ui-preset",
    async () => {
      samples = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("[class]"))
          .filter((el) =>
            Array.from(el.classList).some((c) => /(^|:)txt-|-webs$/.test(c))
          )
          .map((el) => ({
            className: el.className,
            fontFamily: getComputedStyle(el).fontFamily,
          }))
      )

      expect(samples.length).toBeGreaterThan(0)
      for (const { className, fontFamily } of samples) {
        const noto = fontFamily.indexOf("Noto Sans Thai")
        const inter = fontFamily.indexOf("Inter")
        expect(noto, `${className}: ${fontFamily}`).toBeGreaterThanOrEqual(0)
        if (inter >= 0) {
          expect(noto, `${className}: ${fontFamily}`).toBeLessThan(inter)
        }
      }
      await evidence("01-home-noto-sans-thai")
    }
  )
})
