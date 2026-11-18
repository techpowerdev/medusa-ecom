import { Locator, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"

// ADM-31 (spec 08 AC-36b, กฎ 35): ฟอร์ม FocusModal มี FocusModal.Title — dialog มี accessible name และ Radix ไม่ log
// console.error "`DialogContent` requires a `DialogTitle`"; ปุ่มเปิดฟอร์มอยู่ใน action ของ DataTable หาด้วย role + ชื่อ
// ภายใน wrapper ที่มี testid (กฎ 7c/18) ส่วน dialog หาจาก testid ของ element ในฟอร์ม (ไม่หาด้วยข้อความ)
// widgets/variant-evoucher-pool.tsx ครอบด้วย static ของ AC-36a เท่านั้น
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-31" },
})

type Case = {
  name: string
  open: (page: Page) => Promise<void>
  /** element ที่มี testid ภายในฟอร์ม — ใช้หา dialog ที่ห่ออยู่ */
  field: (page: Page) => Locator
}

const CASES: Case[] = [
  {
    name: "Create partner",
    open: async (page) => {
      await page.goto(`${BACKEND_URL}/app/evouchers`)
      await page.getByTestId("evoucher-partners-table").getByRole("button", { name: "Create partner" }).click()
    },
    field: (page) => page.getByTestId("evoucher-partner-save"),
  },
  {
    name: "Create program",
    open: async (page) => {
      await page.goto(`${BACKEND_URL}/app/affiliate`)
      await page.getByTestId("affiliate-programs-table").getByRole("button", { name: "Create program" }).click()
    },
    field: (page) => page.getByTestId("affiliate-program-field-name"),
  },
  {
    name: "Create payout",
    open: async (page) => {
      await page.goto(`${BACKEND_URL}/app/affiliate`)
      await page.getByTestId("affiliate-admin-tab-payouts").click()
      await page.getByTestId("affiliate-payouts-table").getByRole("button", { name: "Create payout" }).click()
    },
    field: (page) => page.getByTestId("affiliate-payout-save"),
  },
  {
    name: "Create campaign",
    open: async (page) => {
      await page.goto(`${BACKEND_URL}/app/group-buying`)
      await page.getByTestId("gb-campaigns-table").getByRole("button", { name: "Create campaign" }).click()
    },
    field: (page) => page.getByTestId("gb-field-name"),
  },
]

for (const c of CASES) {
  test(`AC-36: ฟอร์ม ${c.name} — dialog มี accessible name และไม่มี console error DialogTitle`, async ({ page, step }) => {
    const titleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("DialogTitle")) titleErrors.push(msg.text())
    })

    await step(`เปิดฟอร์ม ${c.name} → dialog ที่ห่อฟอร์มมี accessible name`, async () => {
      await loginAdmin(page)
      await c.open(page)
      await expect(c.field(page)).toBeVisible()
      const dialog = c.field(page).locator("xpath=ancestor::*[@role='dialog']")
      await expect(dialog).toHaveCount(1)
      // soft: ตรวจ console ในขั้นถัดไปต่อแม้ไม่มีชื่อ — red บน develop แสดงทั้งสองอาการ
      await expect.soft(dialog).toHaveAccessibleName(/\S/)
    })

    await step("ตลอด test ไม่มี console error ที่มีคำ DialogTitle", async () => {
      expect(titleErrors).toEqual([])
    })
  })
}
