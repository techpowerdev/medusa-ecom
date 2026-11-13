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
    // review nit 1: ระหว่างเปลี่ยน filter จากหน้า 2 ต้องไม่มี request ใดของ status=delivered ที่ยังพา offset หน้าเก่า (50) ไป
    // (เคยรั่ว 1 request ใน render ที่ loader ของ router revalidate ก่อน URL ลบ codes_offset) — เก็บทุก request ตั้งแต่ก่อนกด filter
    const deliveredOffsets: string[] = []
    const onCodesRequest = (req: { url: () => string }) => {
      const url = new URL(req.url())
      if (url.pathname === `/admin/evoucher/pools/${poolId}/codes` && url.searchParams.get("status") === "delivered") {
        deliveredOffsets.push(url.searchParams.get("offset") ?? "")
      }
    }
    page.on("request", onCodesRequest)
    // หน่วง GET pool ที่ loader ของหน้า revalidate ทุกครั้งที่ search เปลี่ยน — เครื่องเร็ว loader เสร็จก่อนจน race ไม่เกิด
    // หน่วงไว้ให้หน้าต่างระหว่าง "loader กำลังโหลด" กับ "URL อัปเดต" กว้างพอเหมือนเครือข่ายจริง
    const isPoolLoader = (url: URL) => url.pathname === `/admin/evoucher/pools/${poolId}`
    const slowLoader = async (route: { continue: () => Promise<void> }) => {
      await new Promise((resolve) => setTimeout(resolve, 800))
      await route.continue()
    }
    await page.route(isPoolLoader, slowLoader)
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
    page.off("request", onCodesRequest)
    await page.unroute(isPoolLoader, slowLoader)
    expect(deliveredOffsets.length).toBeGreaterThan(0)
    expect(deliveredOffsets.filter((offset) => offset !== "0")).toEqual([])
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

// ADM-10 (spec 08 AC-14, กฎ 13): `<prefix>_offset` ที่ผู้ใช้แก้เองผ่าน usePageOffset — normalize/clamp แล้วแก้ URL แบบ replace
test.describe("ADM-10: offset ใน URL ที่ผิดรูป", () => {
  test.use({ viewport: { width: 1280, height: 800 }, evidenceTarget: { feature: "admin-ui", taskId: "ADM-10" } })

  test("AC-14: codes_offset = abc / -50 / 99999999 และ pools_offset = abc ถูก normalize/clamp", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    test.setTimeout(180_000)
    const admin = await adminHeaders(request)
    const { variantId } = await createVoucher(request, admin, 60)
    const { pools } = await call(request, admin, `/admin/evoucher/pools?variant_id=${variantId}&limit=1&offset=0`)
    const poolUrl = `${BACKEND_URL}/app/evouchers/pools/${pools[0].id}`

    const codes = page.getByTestId("evoucher-codes")
    const rows = codes.locator("tbody tr")
    const offsetOf = () => new URL(page.url()).searchParams.get("codes_offset")

    await step("?codes_offset=abc → ไม่มี codes_offset (replace), 50 แถว, ไม่มี NaN; Next → codes_offset=50 + 10 แถว", async () => {
      await loginAdmin(page)
      await page.goto(poolUrl)
      await expect(rows).toHaveCount(50)
      const before = await page.evaluate(() => history.length)
      await page.goto(`${poolUrl}?codes_offset=abc`)
      await page.waitForURL((url) => !url.searchParams.has("codes_offset"))
      await expect(rows).toHaveCount(50)
      await expect(codes).not.toContainText(/NaN/)
      // goto เพิ่ม entry เอง 1 ครั้ง — การแก้ URL ต้องเป็น replace (ไม่เพิ่ม entry ที่สอง)
      expect(await page.evaluate(() => history.length)).toBe(before + 1)
      await evidence("01-codes-offset-abc")

      await codes.getByRole("button", { name: "Next" }).click()
      await page.waitForURL((url) => url.searchParams.get("codes_offset") === "50")
      await expect(rows).toHaveCount(10)
    })

    await step("?codes_offset=-50 → ไม่มี codes_offset; กด Next ครั้งเดียว → codes_offset=50", async () => {
      await page.goto(`${poolUrl}?codes_offset=-50`)
      await page.waitForURL((url) => !url.searchParams.has("codes_offset"))
      await expect(rows).toHaveCount(50)
      await codes.getByRole("button", { name: "Next" }).click()
      await page.waitForURL((url) => url.searchParams.get("codes_offset") === "50")
      await expect(rows).toHaveCount(10)
    })

    await step("?codes_offset=99999999 → codes_offset=50 (หน้าสุดท้าย), 10 แถว, ไม่ใช่ empty state", async () => {
      await page.goto(`${poolUrl}?codes_offset=99999999`)
      await page.waitForURL((url) => url.searchParams.get("codes_offset") === "50")
      await expect(rows).toHaveCount(10)
      await expect(codes).not.toContainText("Import a CSV to add codes.")
      expect(offsetOf()).toBe("50")
      await evidence("02-codes-offset-clamped")
    })

    await step("/app/evouchers?pools_offset=abc → ไม่มี pools_offset", async () => {
      const list = page.waitForResponse((res) => {
        const url = new URL(res.url())
        return url.pathname === "/admin/evoucher/pools" && url.searchParams.get("offset") === "0"
      })
      await page.goto(`${BACKEND_URL}/app/evouchers?pools_offset=abc`)
      expect((await list).status()).toBe(200)
      await page.waitForURL((url) => !url.searchParams.has("pools_offset"))
      await expect(page.locator("body")).not.toContainText(/NaN/)
    })
  })

  // hotfix: DataTable ของ dashboard parseInt ค่าดิบเอง ("-50" → pageIndex -1 → Next ได้หน้า 0, "abc" → NaN) จนกว่า render ที่ URL ถูกแก้แล้วจะ commit
  // ปุ่ม Next ที่กดในช่วงนั้นหาย (CI run 42582257796) — หน่วง loader ให้ช่วงนั้นกว้างพอจะกดได้ทุกครั้ง เหมือนเครือข่ายจริงหรือ render ที่ช้า
  test("AC-14: offset ผิดรูปไม่ถึง DataTable — Next หลังตารางแสดงไปหน้า 2 เสมอ", async ({ page, request, step }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const { variantId } = await createVoucher(request, admin, 60)
    const { pools } = await call(request, admin, `/admin/evoucher/pools?variant_id=${variantId}&limit=1&offset=0`)
    const poolId: string = pools[0].id
    const poolUrl = `${BACKEND_URL}/app/evouchers/pools/${poolId}`

    const codes = page.getByTestId("evoucher-codes")
    const rows = codes.locator("tbody tr")

    await loginAdmin(page)
    await page.route(
      (url) => url.pathname === `/admin/evoucher/pools/${poolId}`,
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 800))
        await route.continue()
      }
    )

    for (const raw of ["-50", "abc"]) {
      await step(`?codes_offset=${raw} → ตารางแสดงแล้วกด Next → codes_offset=50 + 10 แถว`, async () => {
        await page.goto(`${poolUrl}?codes_offset=${raw}`)
        await expect(rows).toHaveCount(50)
        await codes.getByRole("button", { name: "Next" }).click()
        await expect(page).toHaveURL(/[?&]codes_offset=50(&|$)/)
        await expect(rows).toHaveCount(10)
      })
    }
  })
})

// ADM-16 (spec 08 AC-20, กฎ 20b): `?codes_offset=` เกินจำนวนแถว — request แรกได้ 0 แถว (count 60) ก่อน usePageOffset clamp
// เคยแสดง empty state "Import a CSV to add codes." จนกว่าหน้าที่ clamp แล้วโหลดเสร็จ (qa #315 O-1) → ตารางต้องอยู่ในสถานะ loading แทน
test.describe("ADM-16: empty state ไม่กระพริบตอน offset เกิน", () => {
  test.use({ viewport: { width: 1280, height: 800 }, evidenceTarget: { feature: "admin-ui", taskId: "ADM-16" } })

  const EMPTY_TEXT = "Import a CSV to add codes."
  const emptySeen = (page: Page) => page.evaluate(() => (window as unknown as { __emptySeen: number[] }).__emptySeen)

  test("AC-20: ?codes_offset=99999999 + GET /codes หน่วง 800ms → ไม่มี empty state ตลอด 2 วินาทีแรก และจบที่ codes_offset=50 10 แถว", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const { variantId } = await createVoucher(request, admin, 60)
    const { pools } = await call(request, admin, `/admin/evoucher/pools?variant_id=${variantId}&limit=1&offset=0`)
    const poolId: string = pools[0].id
    const rows = page.getByTestId("evoucher-codes").locator("tbody tr")

    await loginAdmin(page)
    // MutationObserver บันทึกทุกครั้งที่ DOM เปลี่ยนแล้วมีข้อความ empty state (กระพริบ 1 frame ก็นับ) ตั้งแต่ก่อน script ของหน้า
    await page.addInitScript((text) => {
      const w = window as unknown as { __emptySeen: number[] }
      w.__emptySeen = []
      new MutationObserver(() => {
        if (document.body?.textContent?.includes(text)) w.__emptySeen.push(performance.now())
      }).observe(document, { childList: true, subtree: true, characterData: true })
    }, EMPTY_TEXT)
    await page.route(
      (url) => url.pathname === `/admin/evoucher/pools/${poolId}/codes`,
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 800))
        await route.continue()
      }
    )

    await step("เปิด ?codes_offset=99999999 → 2 วินาทีแรกไม่มี empty state", async () => {
      await page.goto(`${BACKEND_URL}/app/evouchers/pools/${poolId}?codes_offset=99999999`)
      await page.waitForTimeout(2_000)
      expect(await emptySeen(page)).toEqual([])
    })

    await step("จบที่ codes_offset=50 (หน้าสุดท้าย) 10 แถว และยังไม่เคยมี empty state", async () => {
      await page.waitForURL((url) => url.searchParams.get("codes_offset") === "50")
      await expect(rows).toHaveCount(10)
      await expect(page.getByTestId("evoucher-codes")).not.toContainText(EMPTY_TEXT)
      expect(await emptySeen(page)).toEqual([])
      await evidence("01-codes-offset-clamped-no-empty-flash")
    })
  })
})
