import { APIRequestContext, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, fillDatePicker, loginAdmin, rowAction } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, ok } from "./support/medusa"

// ADM-44 (spec 08 กฎ 48, AC-49): ฟอร์ม program
// (a) แก้ starts_at หลังกด Save แล้ว ends_at ถูกตรวจใหม่ทันที (error ข้ามช่องไม่ค้าง) และ (c) DatePicker ที่ error ได้ focus เมื่อ Save
// (b) ฟอร์มแก้ไขเป็น Drawer แบบ state (ADR-018 Q5) — container ของ Drawer มี testid `affiliate-program-drawer`
// menuitem ของ ActionMenu / ปุ่มใน alertdialog ของ usePrompt หาด้วย role + ชื่อ (ข้อยกเว้นของ testid — ADR-018)
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-44" },
})

const PROGRAMS = "/admin/affiliate/programs"
const DAY = 24 * 60 * 60 * 1000

const uniqueTag = () => `adm44${Date.now()}${Math.random().toString(36).slice(2, 8)}`
const field = (page: Page, key: string) => page.getByTestId(`affiliate-program-field-${key}`)
const error = (page: Page, key: string) => page.getByTestId(`affiliate-program-error-${key}`)
const alert = (page: Page) => page.getByRole("alertdialog")

test("AC-49a/48c: ends_at < starts_at กด Save → error ใต้ ends_at และ focus ที่ ends_at; เลื่อน starts_at ให้ถูก → error หายโดยไม่กด Save", async ({
  page,
  step,
  evidence,
}) => {
  const posts: string[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname.startsWith(PROGRAMS)) posts.push(req.url())
  })

  await step("เปิด Create program กรอกครบยกเว้นลำดับวัน (ends_at ก่อน starts_at) แล้วกด Save", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)
    await page.getByTestId("affiliate-programs-table").getByRole("button", { name: "Create program" }).click()
    await field(page, "name").fill(`ADM-44 ${uniqueTag()}`)
    await fillDatePicker(field(page, "starts_at"), "2030-01-10T10:00")
    await fillDatePicker(field(page, "ends_at"), "2030-01-01T10:00")
    await field(page, "commission_value").fill("8")
    await page.getByTestId("affiliate-program-save").click()
    await expect(error(page, "ends_at")).toHaveText("End must be after start")
    // กฎ 48c: ช่องแรกที่ error คือ DatePicker ของ ends_at — focus อยู่ที่ segment ของมัน
    await expect(field(page, "ends_at").getByRole("spinbutton").first()).toBeFocused()
    await evidence("01-ends-at-error-focused")
  })

  await step("เลื่อน starts_at ไปก่อน ends_at → error ของ ends_at หายภายใน 1 วินาทีโดยไม่กด Save", async () => {
    await fillDatePicker(field(page, "starts_at"), "2029-12-01T10:00")
    await expect(error(page, "ends_at")).toHaveCount(0, { timeout: 1_000 })
    await evidence("02-ends-at-error-cleared")
  })

  await step("เลื่อน starts_at กลับไปหลัง ends_at → error กลับมาโดยไม่กด Save (ตรวจใหม่ ไม่ใช่แค่ล้าง)", async () => {
    await fillDatePicker(field(page, "starts_at"), "2030-01-05T10:00")
    await expect(error(page, "ends_at")).toHaveText("End must be after start", { timeout: 1_000 })
    expect(posts).toEqual([])
  })
})

test("AC-49b: แก้ไข program เปิดใน Drawer — Escape ขณะ dirty ถาม prompt, dblclick Save ยิง POST 1 ครั้ง", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const name = `ADM-44 edit ${uniqueTag()}`
  const { program } = await ok(
    await request.post(`${BACKEND_URL}${PROGRAMS}`, {
      headers: admin,
      data: {
        name,
        starts_at: new Date(Date.now() + 10 * DAY).toISOString(),
        ends_at: new Date(Date.now() + 20 * DAY).toISOString(),
        commission_value: 5,
        scope: { all: true },
      },
    }),
    "สร้าง program",
  )
  const path = `${PROGRAMS}/${program.id}`
  const posts: string[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === path) posts.push(path)
  })
  // alertdialog ของ Radix ตั้ง aria-hidden ให้ส่วนอื่นขณะเปิด — หา Drawer แบบ includeHidden
  const drawer = page.getByRole("dialog", { includeHidden: true }).and(page.getByTestId("affiliate-program-drawer"))

  try {
    await step("Edit จากเมนูต่อแถว → เปิด Drawer (Drawer.Content ของ @medusajs/ui) ไม่ใช่ FocusModal", async () => {
      await loginAdmin(page)
      await page.goto(`${BACKEND_URL}/app/affiliate`)
      const row = page.getByTestId("affiliate-programs-table").getByRole("row").filter({ hasText: name })
      await (await rowAction(row, "affiliate-program-row-actions", "Edit")).click()
      await expect(drawer).toBeVisible()
      // class เฉพาะของ Drawer.Content (@medusajs/ui 4.2.8) — FocusModal.Content เต็มจอ (inset-2) ไม่มี max-w นี้
      await expect(drawer).toHaveClass(/sm:max-w-\[560px\]/)
      await expect(page.getByRole("dialog", { includeHidden: true })).toHaveCount(1)
      await expect(drawer.getByTestId("affiliate-program-field-name")).toHaveValue(name)
      await evidence("03-edit-program-drawer")
    })

    await step("แก้ชื่อแล้ว Escape → alertdialog (กฎ 31) และ Drawer ยังเปิด; Continue editing", async () => {
      await drawer.getByTestId("affiliate-program-field-name").fill(`${name} v2`)
      await page.keyboard.press("Escape")
      await expect(alert(page)).toBeVisible()
      await expect(drawer).toBeVisible()
      await alert(page).getByRole("button", { name: "Continue editing" }).click()
      await expect(alert(page)).toHaveCount(0)
    })

    await step("dblclick Save → POST 1 ครั้ง, Drawer ปิด และชื่อใหม่อยู่ในตาราง", async () => {
      const saved = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === path)
      await drawer.getByTestId("affiliate-program-save").dblclick()
      expect((await saved).status()).toBe(200)
      await expect(drawer).toHaveCount(0)
      await expect(page.getByTestId("affiliate-programs-table").getByRole("row").filter({ hasText: `${name} v2` })).toBeVisible()
      expect(posts).toEqual([path])
    })
  } finally {
    const res = await request.delete(`${BACKEND_URL}${path}`, { headers: admin })
    expect(res.ok(), `ลบ program ${program.id}`).toBe(true)
  }
})

// qa #499 O-1 (spec 08 กฎ 38): ฟอร์มแก้ program (Drawer) เปิดจาก ActionMenu ของแถว — ปิดแล้ว focus กลับปุ่ม … ของแถว
const createProgram = async (request: APIRequestContext, admin: Record<string, string>, name: string) => {
  const { program } = await ok(
    await request.post(`${BACKEND_URL}${PROGRAMS}`, {
      headers: admin,
      data: {
        name,
        starts_at: new Date(Date.now() + 10 * DAY).toISOString(),
        ends_at: new Date(Date.now() + 20 * DAY).toISOString(),
        commission_value: 5,
        scope: { all: true },
      },
    }),
    "สร้าง program",
  )
  return program as { id: string }
}

const deleteProgram = async (request: APIRequestContext, admin: Record<string, string>, id: string) => {
  const res = await request.delete(`${BACKEND_URL}${PROGRAMS}/${id}`, { headers: admin })
  expect(res.ok(), `ลบ program ${id}`).toBe(true)
}

const editDrawer = (page: Page) =>
  page.getByRole("dialog", { includeHidden: true }).and(page.getByTestId("affiliate-program-drawer"))

test("qa #499 O-1 (กฎ 38): ปิด Drawer แก้ไข (Cancel ไม่ dirty / Escape / Leave ของ prompt / Save สำเร็จ) → focus กลับปุ่ม … ของแถว ไม่ใช่ BODY", async ({
  page,
  request,
  step,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const name = `ADM-44 focus ${uniqueTag()}`
  const program = await createProgram(request, admin, name)
  const row = page.getByTestId("affiliate-programs-table").getByRole("row").filter({ hasText: name })
  const trigger = row.getByTestId("affiliate-program-row-actions")
  const focused = () =>
    trigger.evaluate((el) => (el === document.activeElement ? "opener" : (document.activeElement?.tagName ?? "null")))
  const open = async () => {
    await (await rowAction(row, "affiliate-program-row-actions", "Edit")).click()
    await expect(editDrawer(page)).toBeVisible()
  }

  try {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/affiliate`)

    await step("Cancel (ไม่ dirty) → focus ที่ปุ่ม … ของแถว", async () => {
      await open()
      await editDrawer(page).getByRole("button", { name: "Cancel" }).click()
      await expect(editDrawer(page)).toHaveCount(0)
      await expect.poll(focused).toBe("opener")
    })

    await step("Escape (ไม่ dirty) → focus ที่ปุ่ม … ของแถว", async () => {
      await open()
      await page.keyboard.press("Escape")
      await expect(editDrawer(page)).toHaveCount(0)
      await expect.poll(focused).toBe("opener")
    })

    await step("dirty → Escape → prompt → Leave → focus ที่ปุ่ม … ของแถว", async () => {
      await open()
      await editDrawer(page).getByTestId("affiliate-program-field-name").fill(`${name} draft`)
      await page.keyboard.press("Escape")
      await expect(alert(page)).toBeVisible()
      await alert(page).getByRole("button", { name: "Leave" }).click()
      await expect(editDrawer(page)).toHaveCount(0)
      await expect.poll(focused).toBe("opener")
    })

    await step("Save สำเร็จ → focus ที่ปุ่ม … ของแถว", async () => {
      await open()
      await editDrawer(page).getByTestId("affiliate-program-field-name").fill(name)
      await editDrawer(page).getByTestId("affiliate-program-field-announce_text").fill("focus")
      await editDrawer(page).getByTestId("affiliate-program-save").click()
      await expect(editDrawer(page)).toHaveCount(0)
      await expect.poll(focused).toBe("opener")
    })
  } finally {
    await deleteProgram(request, admin, program.id)
  }
})
