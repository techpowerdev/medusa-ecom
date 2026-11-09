import { Locator, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"

// ADM-14 (spec 08 AC-18, กฎ 18): ปุ่มสร้างของ Partners/Programs/Payouts อยู่ใน `action` ของ DataTable แถวเดียวกับหัวตาราง
// `action` ใส่ data-testid ไม่ได้ จึงหาด้วย role + ชื่อภายใน wrapper testid (ข้อยกเว้นที่สองของ CLAUDE.md)
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-14" },
})

const CASES: {
  title: string
  path: string
  tab?: string
  wrapper: string
  heading: string
  subHeading?: string
  button: string
  shot: string
  field: (page: Page) => Locator
}[] = [
  {
    title: "Partners",
    path: "/app/evouchers",
    wrapper: "evoucher-partners-table",
    heading: "Partners",
    button: "Create partner",
    shot: "01-partners-toolbar",
    field: (page) => page.getByLabel("Name *", { exact: true }),
  },
  {
    title: "Programs",
    path: "/app/affiliate",
    wrapper: "affiliate-programs-table",
    heading: "Programs",
    subHeading: "Only draft programs can be deleted.",
    button: "Create program",
    shot: "02-programs-toolbar",
    field: (page) => page.getByTestId("affiliate-program-field-name"),
  },
  {
    title: "Payouts",
    path: "/app/affiliate",
    tab: "affiliate-admin-tab-payouts",
    wrapper: "affiliate-payouts-table",
    heading: "Payouts",
    subHeading: "Draft payouts can be marked paid or cancelled.",
    button: "Create payout",
    shot: "03-payouts-toolbar",
    field: (page) => page.getByTestId("affiliate-payout-field-affiliate_id"),
  },
]

for (const c of CASES) {
  test(`AC-18: ${c.title} — ปุ่มสร้างอยู่แถวเดียวกับหัวตารางใน ${c.wrapper} และเปิด modal เดิม`, async ({
    page,
    step,
    evidence,
  }) => {
    // โหลด admin bundle ครั้งแรกหลัง start (cold)
    test.setTimeout(120_000)
    const table = page.getByTestId(c.wrapper)
    const heading = table.getByRole("heading", { name: c.heading, exact: true })
    const create = table.getByRole("button", { name: c.button, exact: true })

    await step("เปิดหน้า → ใน wrapper มี heading 1 ตัว ปุ่ม 1 ตัว", async () => {
      await loginAdmin(page)
      await page.goto(`${BACKEND_URL}${c.path}`)
      if (c.tab) await page.getByTestId(c.tab).click()
      await expect(heading).toHaveCount(1, { timeout: 30_000 })
      await expect(create).toHaveCount(1)
    })

    await step("centerY ปุ่มกับบล็อกหัวตารางต่างกัน ≤ 8px และไม่มีแถว toolbar ว่าง (ขอบบน wrapper ถึง heading ≤ 24px)", async () => {
      const block = heading.locator("..")
      if (c.subHeading) await expect(block).toContainText(c.subHeading)
      // กัน test ผ่านลอยๆ ถ้า parent กลายเป็นแถวที่ครอบปุ่มด้วย
      await expect(block.getByRole("button", { name: c.button })).toHaveCount(0)
      const [wrapperBox, blockBox, headingBox, createBox] = await Promise.all([
        table.boundingBox(),
        block.boundingBox(),
        heading.boundingBox(),
        create.boundingBox(),
      ])
      if (!wrapperBox || !blockBox || !headingBox || !createBox) throw new Error("ไม่พบตำแหน่งของหัวตารางหรือปุ่มสร้าง")
      const centerY = (box: { y: number; height: number }) => box.y + box.height / 2
      expect(Math.abs(centerY(createBox) - centerY(blockBox))).toBeLessThanOrEqual(8)
      expect(headingBox.y - wrapperBox.y).toBeLessThanOrEqual(24)
      await evidence(c.shot)
    })

    await step("กดปุ่ม → modal เดิมเปิด; กดซ้ำขณะเปิดอยู่ไม่เปิดซ้อนและไม่ล้างค่าที่กรอก (กฎ 18)", async () => {
      // ถือ element ไว้ก่อนเปิด modal: หลังเปิด Radix ตั้ง aria-hidden ให้ส่วนอื่น getByRole จึงหาไม่เจอ
      const handle = await create.elementHandle()
      if (!handle) throw new Error("ไม่พบปุ่มสร้าง")
      await create.click()
      await expect(c.field(page)).toBeVisible()
      await c.field(page).fill("ADM-14")
      await handle.evaluate((el: HTMLElement) => el.click())
      await expect(page.getByRole("dialog")).toHaveCount(1)
      await expect(c.field(page)).toHaveValue("ADM-14")
    })
  })
}
