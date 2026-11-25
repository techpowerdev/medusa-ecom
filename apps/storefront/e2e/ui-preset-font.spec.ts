import { expect, test } from "./support/fixtures"

// SFUI-1a (spec 09 กฎ 8, AC-3 — แทน spec 01 AC-25 ของ CORE-8): หลังเลิก @medusajs/ui-preset ฟอนต์มาจาก `--font-sans` ใน @theme
// ทุก element หลัก (body, h1, h2, p, button, input) และ class txt-*/*-webs ที่ยังเหลือ ต้องได้ Noto Sans Thai ก่อน Inter
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-1a" } })

type FontSample = { label: string; fontFamily: string }

test("AC-3: body, h1, h2, p, button, input และ class txt-*/*-webs บนหน้าแรกใช้ Noto Sans Thai ก่อน Inter", async ({
  page,
  step,
  evidence,
}) => {
  let samples: FontSample[] = []

  await step("เปิดหน้าแรก", async () => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
  })

  await step("อ่าน computed font-family ของ element หลักและ class typography ของ preset", async () => {
    samples = await page.evaluate(() => {
      const font = (el: Element) => getComputedStyle(el).fontFamily
      const tags = ["body", "h1", "h2", "p", "button", "input"].flatMap((selector) => {
        const el = document.querySelector(selector)
        return el ? [{ label: selector, fontFamily: font(el) }] : []
      })
      const legacy = Array.from(document.querySelectorAll<HTMLElement>("[class]"))
        .filter((el) => Array.from(el.classList).some((c) => /(^|:)txt-|-webs$/.test(c)))
        .map((el) => ({ label: el.className, fontFamily: font(el) }))
      return [...tags, ...legacy]
    })

    expect(samples.length).toBeGreaterThan(0)
    expect(samples.map((s) => s.label)).toContain("body")
    for (const { label, fontFamily } of samples) {
      const noto = fontFamily.indexOf("Noto Sans Thai")
      const inter = fontFamily.indexOf("Inter")
      expect(noto, `${label}: ${fontFamily}`).toBeGreaterThanOrEqual(0)
      if (inter >= 0) {
        expect(noto, `${label}: ${fontFamily}`).toBeLessThan(inter)
      }
    }
    await evidence("01-home-noto-sans-thai")
  })
})
