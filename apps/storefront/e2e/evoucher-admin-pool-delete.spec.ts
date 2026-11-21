import { Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin, pageOffsetOf, rowAction } from "./support/admin"
import { call, createVoucher, placeCapturedOrder, waitDelivered } from "./support/evoucher"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, createCustomer, publishableKey } from "./support/medusa"

// EV-21 (spec 02 AC-51, กฎข้อ 37): ลบ voucher pool จาก ActionMenu ของตาราง pools (trigger `evoucher-pool-row-actions`)
// และของหน้า pool (`evoucher-pool-actions`) → usePrompt ระบุจำนวน code → ยืนยัน → toast; 400 ของ API → toast ข้อความนั้น
// menuitem/ปุ่มใน alertdialog หาด้วย role + ชื่อ และ toast ไม่มี testid (`[data-sonner-toast]`) — ข้อยกเว้นของ testid (ADR-018)
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "evoucher", taskId: "EV-21" } })

const POOLS_PATH = "/admin/evoucher/pools"

/** นับ DELETE ของ pool `poolId` */
const countDeletes = (page: Page, poolId: string) => {
  const urls: string[] = []
  page.on("request", (req) => {
    if (req.method() === "DELETE" && new URL(req.url()).pathname === `${POOLS_PATH}/${poolId}`) urls.push(req.url())
  })
  return urls
}

const toast = (page: Page, text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text })

/** เปิดหน้า E-vouchers ที่หน้าของตาราง pools ที่มี pool นี้ (ตารางเรียง created_at ASC และ DB ของ e2e ใช้ร่วมกัน) */
const openPoolsPageWith = async (page: Page, offset: number) => {
  await page.goto(`${BACKEND_URL}/app/evouchers${offset ? `?pools_offset=${offset}` : ""}`)
}

test("AC-51: ลบ pool ที่ยังไม่ส่ง code จากตาราง → prompt บอกจำนวน code → dblclick ยืนยัน = DELETE 1 ครั้ง, toast และแถวหาย", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold)
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const { poolId } = await createVoucher(request, admin, 3)
  const { pool } = await call(request, admin, `${POOLS_PATH}/${poolId}`)
  const offset = await pageOffsetOf(request, admin, { path: POOLS_PATH, key: "pools", id: poolId })
  const deletes = countDeletes(page, poolId)
  const row = page.locator("tbody tr").filter({ hasText: pool.name })

  await step("menuitem Delete ของแถว → prompt ระบุ 3 codes → Cancel ไม่มี DELETE", async () => {
    await loginAdmin(page)
    await openPoolsPageWith(page, offset)
    await expect(row).toHaveCount(1)
    await (await rowAction(row, "evoucher-pool-row-actions", "Delete")).click()
    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toContainText("3 codes")
    // คลิก trigger/menuitem ในแถวที่มี rowHref ต้องไม่พาไปหน้า pool
    await expect(page).toHaveURL(/\/app\/evouchers(\?|$)/)
    await evidence("01-delete-pool-prompt")
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toHaveCount(0)
    expect(deletes).toHaveLength(0)
    await expect(row).toHaveCount(1)
  })

  await step("Delete → dblclick ปุ่มยืนยัน → DELETE 1 ครั้ง, toast สำเร็จ และแถวหายจากตาราง", async () => {
    await (await rowAction(row, "evoucher-pool-row-actions", "Delete")).click()
    const removed = page.waitForResponse(
      (res) => res.request().method() === "DELETE" && new URL(res.url()).pathname === `${POOLS_PATH}/${poolId}`
    )
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).dblclick()
    expect((await removed).status()).toBe(200)
    await expect(toast(page, "Voucher pool deleted")).toBeVisible()
    await expect(row).toHaveCount(0)
    expect(deletes).toHaveLength(1)
    const res = await request.get(`${BACKEND_URL}${POOLS_PATH}/${poolId}`, { headers: admin })
    expect(res.status()).toBe(404)
  })
})

test("AC-51: pool ที่มี code ส่งแล้ว → ลบจากหน้า pool ได้ toast error ข้อความจาก API และ pool ยังอยู่", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // รอ subscriber ส่งมอบ code
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const { variantId, poolId } = await createVoucher(request, admin, 2)
  const orderId = await placeCapturedOrder(request, admin, pk, customer, variantId, 1)
  await waitDelivered(request, admin, orderId, 1)
  const deletes = countDeletes(page, poolId)

  await step("หน้า pool → evoucher-pool-actions → Delete → ยืนยัน → 400 และ toast ข้อความจาก API", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/evouchers/pools/${poolId}`)
    await page.getByTestId("evoucher-pool-actions").click()
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click()
    await expect(page.getByRole("alertdialog")).toContainText("2 codes")
    const removed = page.waitForResponse(
      (res) => res.request().method() === "DELETE" && new URL(res.url()).pathname === `${POOLS_PATH}/${poolId}`
    )
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()
    expect((await removed).status()).toBe(400)
    await expect(toast(page, "allocated or delivered to customers")).toBeVisible()
    await evidence("02-delete-pool-not-allowed")
  })

  await step("ยังอยู่หน้า pool และ pool ยังอยู่ใน API (code ครบ)", async () => {
    await expect(page).toHaveURL(new RegExp(`/app/evouchers/pools/${poolId}`))
    expect(deletes).toHaveLength(1)
    const { pool } = await call(request, admin, `${POOLS_PATH}/${poolId}`)
    expect(pool.total_codes).toBe(2)
  })
})

test("AC-51: pool ใหม่ไม่มี code → badge No codes (ไม่ใช่ Low stock) ทั้งตารางและหน้า pool; ลบจากหน้า pool แล้วกลับรายการ", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const { poolId } = await createVoucher(request, admin, 0)
  const { pool } = await call(request, admin, `${POOLS_PATH}/${poolId}`)
  expect(pool).toMatchObject({ total_codes: 0, low_stock: false })
  const offset = await pageOffsetOf(request, admin, { path: POOLS_PATH, key: "pools", id: poolId })
  const row = page.locator("tbody tr").filter({ hasText: pool.name })

  await step("ตาราง pools: แถวของ pool ว่างมี evoucher-pool-no-codes ไม่มี evoucher-pool-low-stock", async () => {
    await loginAdmin(page)
    await openPoolsPageWith(page, offset)
    await expect(row.getByTestId("evoucher-pool-no-codes")).toBeVisible()
    await expect(row.getByTestId("evoucher-pool-low-stock")).toHaveCount(0)
    await evidence("03-no-codes-badge-table")
  })

  await step("หน้า pool: badge No codes → Delete (prompt บอก no codes) → ยืนยัน → toast และกลับหน้ารายการ", async () => {
    await page.goto(`${BACKEND_URL}/app/evouchers/pools/${poolId}`)
    await expect(page.getByTestId("evoucher-pool-no-codes")).toBeVisible()
    await expect(page.getByTestId("evoucher-pool-low-stock")).toHaveCount(0)
    await page.getByTestId("evoucher-pool-actions").click()
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click()
    await expect(page.getByRole("alertdialog")).toContainText("no codes")
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()
    await expect(toast(page, "Voucher pool deleted")).toBeVisible()
    await expect(page).toHaveURL(/\/app\/evouchers(\?|$)/)
    const res = await request.get(`${BACKEND_URL}${POOLS_PATH}/${poolId}`, { headers: admin })
    expect(res.status()).toBe(404)
  })
})

// D1 (qa #454 — session หลักตัดสิน 2026-11-21): dialog ปิดตั้งแต่คลิกแรกของ dblclick แล้วคลิกที่สองตกลงบนแถวใต้ปุ่ม Delete
// → rowHref พาไปหน้า pool (บางครั้งเป็น pool ที่เพิ่งลบ) — ตารางต้องไม่นำทางจากคลิกแถวระหว่างลบหรือคลิกที่ต่อจาก dblclick
// จัดให้มีแถวใต้ปุ่ม: แทน GET รายการ pool ด้วย pool จริง (แถวแรก) + pool จำลอง 9 แถว (DB ของ e2e ใช้ร่วมกัน ลำดับไม่ตายตัว)
test.describe("D1: dblclick ยืนยันลบในตาราง pools ที่มีแถวใต้ปุ่ม", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test("AC-51: dblclick ปุ่ม Delete ใน prompt → DELETE 1 ครั้ง และไม่ถูกพาไปหน้า pool ของแถวใต้ปุ่ม", async ({ page, request, step }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const { poolId } = await createVoucher(request, admin, 2)
    const { pool } = await call(request, admin, `${POOLS_PATH}/${poolId}`)
    const fakes = Array.from({ length: 9 }, (_, i) => ({
      ...pool,
      id: `evpool_mock_d1_${i}`,
      name: `Mock pool D1 ${i}`,
      code_counts: { available: 50, allocated: 0, delivered: 0, void: 0 },
      total_codes: 50,
      low_stock: false,
    }))
    let deleted = false
    await page.route(
      (url) => url.pathname === POOLS_PATH,
      async (route) => {
        if (route.request().method() !== "GET") return route.fallback()
        const pools = deleted ? fakes : [pool, ...fakes]
        await route.fulfill({ json: { pools, count: pools.length, limit: 20, offset: 0 } })
      }
    )
    const deletes = countDeletes(page, poolId)
    page.on("response", (res) => {
      if (res.request().method() === "DELETE" && res.ok()) deleted = true
    })

    await step("Delete ของแถวแรก → dblclick ยืนยัน → DELETE 1 ครั้ง, toast และยังอยู่หน้า E-vouchers", async () => {
      await loginAdmin(page)
      await openPoolsPageWith(page, 0)
      const row = page.locator("tbody tr").filter({ hasText: pool.name })
      // ตาราง Partners ในหน้าเดียวกันก็มี tbody tr — นับเฉพาะแถว pool จำลอง
      const mockRows = page.locator("tbody tr").filter({ hasText: "Mock pool D1" })
      await expect(row).toHaveCount(1)
      await expect(mockRows).toHaveCount(9)
      await (await rowAction(row, "evoucher-pool-row-actions", "Delete")).click()
      const confirm = page.getByRole("alertdialog").getByRole("button", { name: "Delete" })
      await expect(confirm).toBeVisible()
      // ปุ่มยืนยันอยู่เหนือแถวของตารางจริง (เงื่อนไขของ D1)
      const box = (await confirm.boundingBox())!
      const under = await page.evaluate(
        ([x, y]) => Array.from(document.querySelectorAll("tbody tr")).some((tr) => {
          const r = tr.getBoundingClientRect()
          return y >= r.top && y <= r.bottom && x >= r.left && x <= r.right
        }),
        [box.x + box.width / 2, box.y + box.height / 2]
      )
      expect(under).toBe(true)
      await confirm.dblclick()
      await expect(toast(page, "Voucher pool deleted")).toBeVisible()
      await expect(row).toHaveCount(0)
      await expect(mockRows).toHaveCount(9)
      await expect(page).toHaveURL(/\/app\/evouchers(\?|$)/)
      expect(deletes).toHaveLength(1)
    })
  })
})
