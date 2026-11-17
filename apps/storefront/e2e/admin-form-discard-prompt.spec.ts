import { Locator, Page } from "@playwright/test"
import { Client } from "pg"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders } from "./support/medusa"

// ADM-27 (spec 08 AC-32, กฎ 31): ฟอร์มที่กรอกแล้ว (dirty) ใน FocusModal/Drawer แบบ state ถามยืนยันด้วย usePrompt ก่อนปิด
// ปุ่มใน alertdialog ของ usePrompt และปุ่มสร้างใน action ของ DataTable หาด้วย role + ชื่อ (ข้อยกเว้นของ testid — ADR-018)
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-27" },
})

const PARTNERS_PATH = "/admin/evoucher/partners"

// Date.now() ชนกันได้เมื่อรัน --repeat-each หลาย worker พร้อมกัน
const uniqueTag = () => `adm27${Date.now()}${Math.random().toString(36).slice(2, 8)}`

async function sql(text: string, values: unknown[]) {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    await db.query(text, values)
  } finally {
    await db.end()
  }
}

const alert = (page: Page) => page.getByRole("alertdialog")
// alertdialog ของ Radix ตั้ง aria-hidden ให้ส่วนอื่นขณะเปิด — dialog ของฟอร์มจึงต้องหาแบบ includeHidden (ยังมองเห็นอยู่หลัง overlay)
const form = (page: Page) => page.getByRole("dialog", { includeHidden: true })

const cancelPrompt = async (page: Page) => {
  await alert(page).getByRole("button", { name: "Continue editing" }).click()
  await expect(alert(page)).toHaveCount(0)
}

const confirmPrompt = async (page: Page) => {
  await alert(page).getByRole("button", { name: "Leave" }).click()
  await expect(alert(page)).toHaveCount(0)
}

type Case = {
  name: string
  open: (page: Page) => Promise<void>
  field: (page: Page) => Locator
}

const CASES: Case[] = [
  {
    name: "สร้าง partner",
    open: async (page) => {
      await page.goto(`${BACKEND_URL}/app/evouchers`)
      await page.getByTestId("evoucher-partners-table").getByRole("button", { name: "Create partner" }).click()
    },
    field: (page) => form(page).getByLabel("Name *", { exact: true }),
  },
  {
    name: "สร้างแคมเปญ",
    open: async (page) => {
      await page.goto(`${BACKEND_URL}/app/group-buying`)
      await page.getByTestId("gb-campaigns-table").getByRole("button", { name: "Create campaign" }).click()
    },
    field: (page) => page.getByTestId("gb-field-name"),
  },
  {
    name: "สร้าง program",
    open: async (page) => {
      await page.goto(`${BACKEND_URL}/app/affiliate`)
      await page.getByTestId("affiliate-programs-table").getByRole("button", { name: "Create program" }).click()
    },
    field: (page) => page.getByTestId("affiliate-program-field-name"),
  },
]

for (const c of CASES) {
  test(`AC-32: ฟอร์ม${c.name} — dirty + Escape ถามก่อน (ยกเลิกค่าคงอยู่ / ยืนยันปิดและเปิดใหม่ว่าง); ไม่ dirty ปิดทันที`, async ({
    page,
    request,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    await adminHeaders(request)
    const value = `ADM-27 ${uniqueTag()}`

    await step("กรอกช่องข้อความแล้ว Escape → alertdialog และฟอร์มยังเปิด", async () => {
      await loginAdmin(page)
      await c.open(page)
      await expect(c.field(page)).toBeVisible()
      await c.field(page).fill(value)
      await page.keyboard.press("Escape")
      await expect(alert(page)).toBeVisible()
      await expect(alert(page)).toContainText("Are you sure you want to leave this form?")
      await expect(alert(page)).toContainText("You have unsaved changes that will be lost if you exit this form.")
      await expect(form(page)).toBeVisible()
      if (c === CASES[0]) await evidence("01-partner-discard-prompt")
    })

    await step("ยกเลิก prompt → ฟอร์มยังเปิดและค่าคงอยู่", async () => {
      await cancelPrompt(page)
      await expect(form(page)).toBeVisible()
      await expect(c.field(page)).toHaveValue(value)
    })

    await step("Escape อีกครั้งแล้วยืนยัน → ฟอร์มปิด; เปิดใหม่ช่องว่าง", async () => {
      await page.keyboard.press("Escape")
      await confirmPrompt(page)
      await expect(form(page)).toHaveCount(0)
      await c.open(page)
      await expect(c.field(page)).toHaveValue("")
    })

    await step("ไม่ได้กรอก → Escape ปิดทันทีโดยไม่มี alertdialog", async () => {
      await page.keyboard.press("Escape")
      await expect(form(page)).toHaveCount(0)
      await expect(alert(page)).toHaveCount(0)
    })
  })
}

test("AC-32: Drawer แก้ partner — กรอกแล้วคลิกปุ่ม close ของ Drawer → alertdialog; Escape 2 ครั้งติดกันที่ฟอร์มสร้าง → alertdialog ตัวเดียว; บันทึกสำเร็จไม่ถาม", async ({
  page,
  request,
  step,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const name = `ADM-27 partner ${uniqueTag()}`
  const created: string[] = []
  const res = await request.post(`${BACKEND_URL}${PARTNERS_PATH}`, { headers: admin, data: { name } })
  expect(res.status(), await res.text()).toBe(200)
  created.push((await res.json()).partner.id)
  try {
    await step("Edit → แก้ชื่อ → คลิกปุ่ม close (X) ที่หัว Drawer → alertdialog; ยืนยัน → Drawer ปิด", async () => {
      await loginAdmin(page)
      await page.goto(`${BACKEND_URL}/app/evouchers`)
      const row = page.getByTestId("evoucher-partners-table").locator("tbody tr", { hasText: name })
      await row.getByTestId("evoucher-partner-row-actions").click()
      await page.getByRole("menuitem", { name: "Edit" }).click()
      const drawer = form(page)
      await expect(drawer.getByText("Edit partner")).toBeVisible()
      await drawer.getByLabel("Name *", { exact: true }).fill(`${name} v2`)
      // ปุ่ม X ของ Drawer.Header (@medusajs/ui) ไม่มีชื่อ/testid — อยู่ถัดจาก kbd "esc"
      await drawer.locator("kbd + button").click()
      await expect(alert(page)).toBeVisible()
      await expect(drawer).toBeVisible()
      await confirmPrompt(page)
      await expect(drawer).toHaveCount(0)
      await expect(page.locator("body")).not.toHaveCSS("pointer-events", "none")
    })

    await step("ฟอร์มสร้าง partner dirty → Escape 2 ครั้งติดกัน → alertdialog 1 ตัว", async () => {
      await page.getByTestId("evoucher-partners-table").getByRole("button", { name: "Create partner" }).click()
      await form(page).getByLabel("Name *", { exact: true }).fill(`${name} new`)
      // กดสองครั้งใน tick เดียวกัน (ก่อน prompt render) — ทดสอบ in-flight flag ไม่ให้เปิด prompt ซ้อน (กฎ 31c)
      await page.evaluate(() => {
        for (let i = 0; i < 2; i++) {
          document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))
        }
      })
      await expect(alert(page)).toHaveCount(1)
      await expect(form(page)).toBeVisible()
      await cancelPrompt(page)
    })

    await step("Save สำเร็จ → ฟอร์มปิดโดยไม่มี alertdialog", async () => {
      const saved = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === PARTNERS_PATH)
      await form(page).getByRole("button", { name: "Save" }).click()
      const response = await saved
      expect(response.status()).toBe(200)
      created.push((await response.json()).partner.id)
      await expect(form(page)).toHaveCount(0)
      await expect(alert(page)).toHaveCount(0)
    })
  } finally {
    for (const id of created) {
      const del = await request.delete(`${BACKEND_URL}${PARTNERS_PATH}/${id}`, { headers: admin })
      expect.soft(del.ok(), `ลบ partner ของ test ${id}: ${del.status()}`).toBe(true)
    }
  }
})

test("AC-32: ฟอร์ม payout dirty + Combobox ขยาย → Escape ไม่มี alertdialog และ dialog ยังเปิด (กฎ 31d)", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  await adminHeaders(request)
  const tag = uniqueTag()
  const combobox = page.getByTestId("affiliate-payout-field-affiliate_id")
  await sql(
    `insert into affiliate (id, email, name, code, status, created_at, updated_at)
     values ($1, $2, $3, $4, 'active', now(), now())`,
    [`aff_${tag}`, `${tag}@example.com`, `ADM27 ${tag}`, tag],
  )
  try {
    await step("เลือก affiliate (dirty) แล้วเปิดรายการอีกครั้ง → Escape: ไม่มี alertdialog และ dialog ยังเปิด", async () => {
      await loginAdmin(page)
      await page.goto(`${BACKEND_URL}/app/affiliate`)
      await page.getByTestId("affiliate-admin-tab-payouts").click()
      await page.getByTestId("affiliate-payouts-table").getByRole("button", { name: "Create payout" }).click()
      await expect(form(page)).toBeVisible()
      await combobox.fill(tag)
      await page.getByRole("option").filter({ hasText: tag }).click()
      await expect(page.getByRole("listbox")).toBeHidden()
      await combobox.click()
      await expect(page.getByRole("listbox")).toBeVisible()
      await expect(combobox).toHaveAttribute("aria-expanded", "true")
      await page.keyboard.press("Escape")
      await expect(form(page)).toBeVisible()
      await expect(alert(page)).toHaveCount(0)
    })

    await step("ปิดรายการ (คลิก heading) แล้ว Escape → alertdialog (กฎ 31a)", async () => {
      await form(page).getByRole("heading", { name: "Create payout" }).click()
      await expect(page.getByRole("listbox")).toBeHidden()
      await page.keyboard.press("Escape")
      await expect(alert(page)).toBeVisible()
      await evidence("02-payout-discard-prompt")
      await confirmPrompt(page)
      await expect(form(page)).toHaveCount(0)
    })
  } finally {
    await sql(`delete from affiliate where id = $1`, [`aff_${tag}`])
  }
})
