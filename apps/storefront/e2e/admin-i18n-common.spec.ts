import { Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, ADMIN_UI_OPTIONS_TH, adminLabel, adminText, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { THAI } from "./support/thai-text"

// spec 10 AC-8 (AI18N-1, กฎ 6, 12–13): prompt ออกจากฟอร์ม (useConfirmDiscard ของ components/common) แสดงตามภาษาที่เลือกผ่านกลไกของ Medusa
// หัวข้อ/คำอธิบาย = key ของ Medusa (`th.json` ของ dashboard), ปุ่ม = `ecom-common` ของเรา — ค่าที่คาดสร้างจากไฟล์คำแปล (ไม่ hard-code ประโยคไทย)
// ปุ่มใน alertdialog/ปุ่มใน action ของ DataTable/ลิงก์เมนูของ Medusa หาด้วย role + ชื่อภายใน container ที่แคบที่สุด (ข้อยกเว้น — ADR-018)
// ปุ่มสร้าง partner/label ช่องชื่อ เป็นของกลุ่ม e-voucher (AI18N-3) — `adminLabel` ใช้ค่าไทยเมื่อกลุ่มนั้นแปลแล้ว ไม่งั้นข้อความอังกฤษเดิม

type Lng = "en" | "th"

const alert = (page: Page) => page.getByRole("alertdialog")
// alertdialog ของ Radix ตั้ง aria-hidden ให้ส่วนอื่นขณะเปิด — dialog ของฟอร์มจึงหาแบบ includeHidden
const form = (page: Page) => page.getByRole("dialog", { includeHidden: true })

async function openDirtyPartnerForm(page: Page, lng: Lng) {
  await loginAdmin(page)
  await page.goto(`${BACKEND_URL}/app/evouchers`)
  await page
    .getByTestId("evoucher-partners-table")
    .getByRole("button", { name: adminLabel(lng, "ecom-evoucher", "Create partner"), exact: true })
    .click()
  const name = form(page).getByLabel(adminLabel(lng, "ecom-evoucher", "Name *"), { exact: true })
  await expect(name).toBeVisible()
  await name.fill(`AI18N-1 ${Date.now()}`)
  await page.keyboard.press("Escape")
  await expect(alert(page)).toBeVisible()
}

const expected = (lng: Lng) => ({
  title: adminText(lng, "translation", "general.unsavedChangesTitle"),
  description: adminText(lng, "translation", "general.unsavedChangesDescription"),
  leave: adminText(lng, "ecom-common", "confirmDiscard.leave"),
  continueEditing: adminText(lng, "ecom-common", "confirmDiscard.continueEditing"),
})

async function expectPrompt(page: Page, lng: Lng) {
  const text = expected(lng)
  const dialog = alert(page)
  await expect(dialog.getByRole("heading")).toHaveText(text.title)
  await expect(dialog).toContainText(text.description)
  const leave = dialog.getByRole("button", { name: text.leave, exact: true })
  const cancel = dialog.getByRole("button", { name: text.continueEditing, exact: true })
  await expect(leave).toBeVisible()
  await expect(cancel).toBeVisible()
  const shown = [await dialog.getByRole("heading").textContent(), await leave.textContent(), await cancel.textContent()].join(" ")
  if (lng === "th") expect(shown).toMatch(THAI)
  else expect(`${shown} ${await dialog.textContent()}`).not.toMatch(THAI)
  // ยกเลิกแล้วฟอร์มยังเปิด (พฤติกรรมเดิม)
  await cancel.click()
  await expect(dialog).toHaveCount(0)
  await expect(form(page)).toBeVisible()
}

test.describe("lng=th", () => {
  test.use({
    ...ADMIN_UI_OPTIONS_TH,
    evidenceTarget: { feature: "admin-i18n", taskId: "AI18N-1" },
  })

  test("AC-8: prompt ออกจากฟอร์มเป็นไทย (key ของ Medusa + ecom-common) และเมนู Settings ของ Medusa เป็นไทย", async ({
    page,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    await step("เปิดฟอร์มสร้าง partner กรอกชื่อแล้ว Escape", () => openDirtyPartnerForm(page, "th"))
    await evidence("prompt-th")
    await step("หัวข้อ/คำอธิบาย = th.json ของ dashboard, ปุ่ม = ecom-common th", () => expectPrompt(page, "th"))
    await step("ลิงก์ Settings ในเมนูของ Medusa เป็นไทย (เลือกภาษาผ่านกลไกของ Medusa จริง)", async () => {
      const settings = adminText("th", "translation", "app.nav.settings.header")
      expect(settings).toMatch(THAI)
      await page.keyboard.press("Escape")
      await expect(alert(page)).toBeVisible()
      await alert(page).getByRole("button", { name: expected("th").leave, exact: true }).click()
      await expect(form(page)).toHaveCount(0)
      await expect(page.getByRole("complementary").getByRole("link", { name: settings, exact: true })).toBeVisible()
    })
  })
})

test.describe("lng=en", () => {
  test.use({ ...ADMIN_UI_OPTIONS })

  test("AC-8: prompt ออกจากฟอร์มเป็นอังกฤษเดิม (ค่า en) ไม่มีอักษรไทย", async ({ page, step }) => {
    test.setTimeout(120_000)
    await step("เปิดฟอร์มสร้าง partner กรอกชื่อแล้ว Escape", () => openDirtyPartnerForm(page, "en"))
    await step("ข้อความเท่าค่า en ของ dashboard/ecom-common", async () => {
      expect(expected("en")).toEqual({
        title: "Are you sure you want to leave this form?",
        description: "You have unsaved changes that will be lost if you exit this form.",
        leave: "Leave",
        continueEditing: "Continue editing",
      })
      await expectPrompt(page, "en")
    })
  })
})
