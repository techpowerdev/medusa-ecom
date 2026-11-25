import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"
import { THAI } from "./support/thai-text"

// SFUI-4 (spec 09 กฎ 4, AC-14 ส่วน e2e): filter ของ /store (Accordion + Slider ของ shadcn) และแท็บบน PDP ใช้คีย์บอร์ดได้
// ข้อมูลตั้งต้นจาก seed (CORE-2): สินค้ามี option (Size/Color) → มีหัว filter ของ option และช่วงราคา; PDP t-shirt
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-4" } })

test("AC-14: Enter บนหัว filter เปิด/ปิดเนื้อหา และ ArrowRight บน thumb ช่วงราคาเปลี่ยนค่า", async ({
  page,
  step,
  evidence,
}) => {
  const heading = page.getByTestId("option-refinement-title").first()
  const trigger = page.getByRole("button").filter({ has: heading })

  await step("เปิด /store และรอหัว filter ของ option", async () => {
    await expect(async () => {
      await page.goto(`/${CC}/store`)
      await expect(heading).toBeVisible({ timeout: 5_000 })
    }).toPass({ intervals: [1_000, 2_000], timeout: 60_000 })
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  await step("Enter บนหัว filter → ปิด แล้ว Enter อีกครั้ง → เนื้อหาเปิด (data-state=open)", async () => {
    const contentId = await trigger.getAttribute("aria-controls")
    expect(contentId).toBeTruthy()
    const content = page.locator(`[id="${contentId}"]`)

    await trigger.focus()
    await page.keyboard.press("Enter")
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(content).toBeHidden()

    await page.keyboard.press("Enter")
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(content).toHaveAttribute("data-state", "open")
    await expect(content.getByTestId("option-refinement").first()).toBeVisible()
  })

  await step("ArrowRight บน thumb ราคาต่ำสุด → aria-valuenow และป้าย price-range-min เปลี่ยน", async () => {
    const range = page.getByTestId("price-range")
    await range.scrollIntoViewIfNeeded()
    const thumbs = range.getByRole("slider")
    await expect(thumbs).toHaveCount(2)
    // ชื่อ thumb เป็นไทย (Radix ตั้ง "Minimum"/"Maximum" เองถ้าไม่ส่ง aria-label)
    for (const name of [await thumbs.nth(0).getAttribute("aria-label"), await thumbs.nth(1).getAttribute("aria-label")]) {
      expect(name ?? "").toMatch(THAI)
    }

    const thumb = thumbs.first()
    const minLabel = page.getByTestId("price-range-min")
    const before = Number(await thumb.getAttribute("aria-valuenow"))
    const beforeLabel = (await minLabel.textContent()) ?? ""

    await thumb.focus()
    await page.keyboard.press("ArrowRight")
    await expect(thumb).toHaveAttribute("aria-valuenow", String(before + 1))
    await expect(minLabel).not.toHaveText(beforeLabel)
    await evidence("01-store-filter-keyboard")
  })
})

test("AC-14: แท็บบน PDP เป็น Accordion — ปุ่มมีชื่อไทย และ Enter เปิดเนื้อหา", async ({ page, step, evidence }) => {
  const tab = page.getByTestId("product-tab-information")
  const trigger = tab.getByRole("button")

  await step("เปิด PDP ของ t-shirt", async () => {
    await page.goto(`/${CC}/products/t-shirt`)
    await expect(tab).toBeVisible()
    await expect(tab).toHaveAttribute("data-state", "closed")
  })

  await step("Enter บนปุ่มแท็บ → data-state=open และเห็นเนื้อหา", async () => {
    await expect(trigger).toHaveAccessibleName(THAI)
    await trigger.focus()
    await page.keyboard.press("Enter")
    await expect(tab).toHaveAttribute("data-state", "open")
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    const contentId = await trigger.getAttribute("aria-controls")
    await expect(page.locator(`[id="${contentId}"]`)).toBeVisible()
    await evidence("02-pdp-tab-open")
  })
})
