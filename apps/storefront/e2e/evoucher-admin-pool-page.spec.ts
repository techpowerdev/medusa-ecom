import { Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { call, createVoucher, placeCapturedOrder, waitDelivered } from "./support/evoucher"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, createCustomer, publishableKey } from "./support/medusa"

// ADM-4 (spec 08 AC-7, กฎ 9–10): หน้า pool ใช้ DataTable ของ dashboard — หน้าปัจจุบันอยู่ใน URL (`codes_offset`),
// กรองสถานะด้วย filter ของ DataTable และ Reveal ต่อแถวอยู่ใน ActionMenu (trigger `evoucher-code-row-actions`)
// ปุ่ม Next / ปุ่ม filter / ตัวเลือกใน filter เป็น component ของ Medusa ที่ใส่ testid ไม่ได้ จึงหาด้วย role + ชื่อ
// ภายในตาราง Codes (`evoucher-codes`) ส่วน menuitem หาด้วย role + ชื่อตามกฎ 10
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "admin-ui", taskId: "ADM-4" } })

const codesRequest = (page: Page, poolId: string, match: (params: URLSearchParams) => boolean) =>
  page.waitForResponse((res) => {
    const url = new URL(res.url())
    return url.pathname === `/admin/evoucher/pools/${poolId}/codes` && match(url.searchParams)
  })

test("AC-7: Codes ของ pool 60 code (delivered 5) แบ่งหน้าใน URL, กรอง delivered ด้วย filter และ Reveal ผ่าน ActionMenu", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold) + รอ subscriber ส่งมอบ
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const { variantId } = await createVoucher(request, admin, 60)
  const orderId = await placeCapturedOrder(request, admin, pk, customer, variantId, 5)
  await waitDelivered(request, admin, orderId, 5)
  const { pools } = await call(request, admin, `/admin/evoucher/pools?variant_id=${variantId}&limit=1&offset=0`)
  const poolId: string = pools[0].id

  const codes = page.getByTestId("evoucher-codes")
  const rows = codes.locator("tbody tr")

  await step("เปิดหน้า pool → หน้าแรกของ Codes 50 แถว", async () => {
    await loginAdmin(page)
    const first = codesRequest(page, poolId, (p) => p.get("offset") === "0")
    await page.goto(`${BACKEND_URL}/app/evouchers/pools/${poolId}`)
    expect((await first).status()).toBe(200)
    await expect(rows).toHaveCount(50)
  })

  await step("กด Next → URL มี codes_offset=50 และ reload แล้วยังเป็นหน้าเดิม", async () => {
    const second = codesRequest(page, poolId, (p) => p.get("offset") === "50")
    await codes.getByRole("button", { name: "Next" }).click()
    expect((await second).status()).toBe(200)
    await expect(page).toHaveURL(/[?&]codes_offset=50(&|$)/)
    await expect(rows).toHaveCount(10)

    const reloaded = codesRequest(page, poolId, (p) => p.get("offset") === "50")
    await page.reload()
    expect((await reloaded).status()).toBe(200)
    await expect(page).toHaveURL(/[?&]codes_offset=50(&|$)/)
    await expect(rows).toHaveCount(10)
  })

  await step("กรองสถานะ delivered ผ่าน filter ของ DataTable → 5 แถว ทุกแถว delivered", async () => {
    const filtered = codesRequest(page, poolId, (p) => p.get("status") === "delivered" && p.get("offset") === "0")
    // ปุ่ม filter (Funnel) เป็น trigger ของ dropdown ตัวแรกใน toolbar ของตาราง (trigger ต่อแถวอยู่ใน tbody)
    await codes.locator('button[aria-haspopup="menu"]').first().click()
    await page.getByRole("menuitem", { name: "Status" }).click()
    await page.getByRole("listitem").filter({ hasText: /^delivered$/ }).click()
    expect((await filtered).status()).toBe(200)
    // ตัวเลือกของ filter เป็น popover ที่ยังเปิดอยู่หลังเลือก — ปิดก่อนกดปุ่มในแถว
    await page.keyboard.press("Escape")
    await expect(page.getByRole("listitem").filter({ hasText: /^delivered$/ })).toHaveCount(0)
    await expect(rows).toHaveCount(5)
    for (const row of await rows.all()) {
      await expect(row.getByText("delivered", { exact: true })).toBeVisible()
    }
    await expect(page).not.toHaveURL(/codes_offset=/)
    await evidence("01-codes-filter-delivered")
  })

  await step("เปิด evoucher-code-row-actions ของแถว → menuitem Reveal → ยืนยัน → เห็น evoucher-revealed-code (กดซ้ำระหว่างรอ = 1 request)", async () => {
    const reveals: string[] = []
    page.on("request", (req) => {
      if (/\/admin\/evoucher\/codes\/[^/]+\/reveal$/.test(new URL(req.url()).pathname)) reveals.push(req.url())
    })
    // หน่วง response ของ reveal จนกว่า test ปล่อย เพื่อพิสูจน์ว่าเปิดเมนูกด Reveal ซ้ำระหว่างรอไม่ได้ (กฎ 4)
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route("**/admin/evoucher/codes/*/reveal", async (route) => {
      await held
      await route.continue()
    })

    const trigger = rows.first().getByTestId("evoucher-code-row-actions")
    await trigger.click()
    await page.getByRole("menuitem", { name: "Reveal" }).click()
    await page.getByRole("button", { name: "Reveal" }).click()
    await expect.poll(() => reveals.length).toBe(1)

    await trigger.click()
    await expect(page.getByRole("menuitem", { name: "Reveal" })).toBeDisabled()
    await page.keyboard.press("Escape")

    const response = page.waitForResponse((res) => /\/reveal$/.test(new URL(res.url()).pathname))
    release()
    expect((await response).status()).toBe(200)
    await expect(page.getByTestId("evoucher-revealed-code")).toBeVisible()
    await expect(page.getByTestId("evoucher-revealed-code")).not.toHaveText(/\*/)
    expect(reveals).toHaveLength(1)
    await evidence("02-code-revealed")
  })
})
