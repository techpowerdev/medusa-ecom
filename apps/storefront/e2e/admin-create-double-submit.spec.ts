import { APIRequestContext, Locator, Page } from "@playwright/test"
import { Client } from "pg"

import { ADMIN_UI_OPTIONS, fillDatePicker, loginAdmin } from "./support/admin"
import { createActiveAffiliate } from "./support/affiliate"
import { call, createVoucher, Json } from "./support/evoucher"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, Headers } from "./support/medusa"

// ADM-39 (spec 08 กฎ 43, AC-44 — bug ADM-B1): ฟอร์มสร้างที่ปิด FocusModal หลังสำเร็จ — lock ค้างจน modal ปิด และปล่อยเมื่อเปิดใหม่
// (a) ดับเบิลคลิก Save เว้น 100ms (คลิกที่สองโดนปุ่มระหว่าง modal กำลังปิด) → POST 1 ครั้ง
// (b) Save แล้วกด ⌘/Ctrl+Enter ทันทีหลัง response ระหว่าง modal กำลังปิด → POST 1 ครั้ง
// (c) API ตอบ 500 (route mock) → modal ยังเปิด กด Save ได้อีกและ POST ครั้งที่ 2 เกิด
// (d) เปิดฟอร์มใหม่หลังสร้างสำเร็จ → Save ส่ง POST ได้ (ขั้น b และ c เปิดฟอร์มใหม่หลังขั้นก่อนหน้าสำเร็จ)
// นับ request ด้วย page.on("request") ตาม AC; ปุ่มใน action ของ DataTable หาด้วย role + ชื่อภายใน wrapper ที่มี testid (ADR-018)
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-39" },
})

const HOUR = 60 * 60 * 1000
const uniqueTag = () => `adm39${Date.now()}${Math.random().toString(36).slice(2, 8)}`
const FAIL_500 = { status: 500, json: { type: "unknown_error", message: "An unknown error occurred." } }

/** POST ไปยัง pathname ตรงตัว (ไม่รวม query) */
function countPosts(page: Page, path: string) {
  const posts: string[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === path) posts.push(req.url())
  })
  return posts
}

/**
 * POST ของ `path`: `failNext()` = ครั้งถัดไปตอบ 500 (ขั้น c); `ok` = ตอบสำเร็จด้วย body นี้ (ฟอร์มที่การสร้างจริงต้องเตรียมข้อมูลหนัก
 * หรือสร้างได้ครั้งเดียวต่อ variant — lock เป็นพฤติกรรมฝั่ง UI ล้วน; response เร็วสุดคือกรณีที่ race เกิดง่ายสุด) ไม่ระบุ = backend จริง
 */
async function routePosts(page: Page, path: string, ok?: Json) {
  let fail = false
  await page.route(`**${path}`, async (route) => {
    if (route.request().method() !== "POST") return route.continue()
    if (fail) {
      fail = false
      return route.fulfill(FAIL_500)
    }
    return ok ? route.fulfill({ status: 200, json: ok }) : route.continue()
  })
  return { failNext: () => (fail = true) }
}

/**
 * ดับเบิลคลิกแบบคน (ADM-M-14 เว้น 80–150ms): คลิกแรก → คลิกที่สอง (event.detail 2 แบบ dblclick จริง) ที่พิกัดเดิม เมื่อครบ 100ms
 * **และ** `afterResponse` จบ (response กลับแล้ว + UI รับผลแล้ว เช่น modal เริ่มปิด) — ADM-B1 เกิดเมื่อ response กลับก่อนคลิกที่สอง
 * ถ้า backend ตอบช้ากว่า 100ms คลิกที่สองจะโดน lock ระหว่างรอ (ผ่านบน develop โดยไม่ได้ทดสอบ bug) จึงรอ response ด้วย
 * page.mouse ไม่รอ actionability (Locator.click จะรอปุ่มที่กำลัง animate ปิดจนหายไปแล้วค่อยล้ม) จึงโดนปุ่มระหว่าง modal ปิดตามจริง
 * ช่วงเว้นคือสิ่งที่ทดสอบ (ไม่ใช่การรอ UI) จึงใช้ waitForTimeout
 */
async function humanDoubleClick(page: Page, target: Locator, afterResponse: () => Promise<unknown>) {
  const box = await target.boundingBox()
  if (!box) throw new Error("humanDoubleClick: ไม่พบปุ่มบนจอ")
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
  await page.mouse.click(x, y)
  await Promise.all([page.waitForTimeout(100), afterResponse()])
  // mouse.click({ clickCount: 2 }) กดสองรอบ (detail 1 แล้ว 2) — ส่ง down/up ครั้งเดียวที่ clickCount 2 แบบคลิกที่สองของ dblclick จริง
  await page.mouse.down({ clickCount: 2 })
  await page.mouse.up({ clickCount: 2 })
}

const postResponse = (page: Page, path: string) =>
  page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === path)

/**
 * ADM-46 (spec 08 กฎ 50, AC-51 (a)): เริ่มเฝ้าปุ่มก่อนคลิก — ทุก requestAnimationFrame หลัง response ของ POST `path` กลับ
 * (resource timing ของ fetch ที่เริ่มหลังจุดนี้) บันทึก `disabled` ของปุ่มจนปุ่มถูกถอดจาก DOM (modal ปิดจบ) หรือครบ 3 วินาที
 * ตรวจใน browser เอง เพราะ waitForResponse ฝั่ง node มาถึงช้ากว่า frame ที่ต้องดู; คืน disabled ของทุก frame ที่ปุ่มยังอยู่
 */
async function watchDisabledAfterResponse(target: Locator, path: string) {
  const handle = await target.elementHandle()
  if (!handle) throw new Error("watchDisabledAfterResponse: ไม่พบปุ่ม")
  await handle.evaluate((button, path) => {
    const since = performance.now()
    const responded = () =>
      performance
        .getEntriesByType("resource")
        .some((e) => e.startTime >= since && new URL(e.name).pathname === path && (e as PerformanceResourceTiming).responseEnd > 0)
    const frames: boolean[] = []
    ;(window as unknown as { __adm46: Promise<boolean[]> }).__adm46 = new Promise((resolve) => {
      const tick = () => {
        if (!button.isConnected || performance.now() - since > 3000) return resolve(frames)
        if (responded()) frames.push((button as HTMLButtonElement).disabled)
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }, path)
  return () => target.page().evaluate(() => (window as unknown as { __adm46: Promise<boolean[]> }).__adm46)
}

const dialog = (page: Page) => page.getByRole("dialog")
/** modal เริ่มปิดแล้ว (data-state=closed ระหว่างแอนิเมชัน) หรือถูกถอดไปแล้ว — ไม่มี dialog ที่ open */
const openDialog = (page: Page) => page.locator('[role="dialog"][data-state="open"]')

async function sql(text: string, values: unknown[]) {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    await db.query(text, values)
  } finally {
    await db.end()
  }
}

type ModalForm = {
  /** POST ที่ฟอร์มส่ง */
  path: string
  /** ตอบสำเร็จด้วย mock (ดู routePosts) */
  ok?: Json
  open: (page: Page) => Promise<void>
  /** ปุ่มที่เปิดฟอร์ม (ได้ focus คืนเมื่อปิด — useRestoreOpenerFocus) */
  opener: (page: Page) => Locator
  /** กรอกค่าที่ผ่าน validation — `n` ต่างกันต่อขั้น */
  fill: (page: Page, n: number) => Promise<void>
  save: (page: Page) => Locator
  /** id จาก response 200 ของ backend จริง — ลบใน cleanup */
  idOf?: (body: Json) => string
  cleanup: (ids: string[]) => Promise<void>
}

/**
 * `closesWithAnimation` = FocusModal ปิดด้วยแอนิเมชัน (ไม่ถูกถอดทันที) — ขั้น (e) ต้องมี frame หลัง response ให้ตรวจ (nit #513)
 * `rule52a` = ฟอร์มในกฎ 52a (ADM-48) — ทดสอบ Enter ค้างบน Save (AC-53)
 */
type ModalCase = {
  name: string
  closesWithAnimation?: boolean
  rule52a?: boolean
  setup: (request: APIRequestContext, admin: Headers) => Promise<ModalForm>
}

const PARTNERS = "/admin/evoucher/partners"
const PROGRAMS = "/admin/affiliate/programs"

const CASES: ModalCase[] = [
  {
    name: "Create partner (backend จริง — ADM-B1)",
    closesWithAnimation: true,
    rule52a: true,
    setup: async (request, admin) => {
      const tag = uniqueTag()
      const opener = (page: Page) =>
        page.getByTestId("evoucher-partners-table").getByRole("button", { name: "Create partner" })
      return {
        path: PARTNERS,
        opener,
        open: async (page) => {
          await page.goto(`${BACKEND_URL}/app/evouchers`)
          await opener(page).click()
        },
        fill: (page, n) => dialog(page).getByLabel("Name *", { exact: true }).fill(`ADM-39 partner ${tag} ${n}`),
        save: (page) => page.getByTestId("evoucher-partner-save"),
        idOf: (body) => body.partner.id,
        cleanup: async (ids) => {
          for (const id of ids) {
            const res = await request.delete(`${BACKEND_URL}${PARTNERS}/${id}`, { headers: admin })
            expect.soft(res.ok(), `ลบ partner ${id}`).toBe(true)
          }
        },
      }
    },
  },
  {
    name: "Create program (backend จริง)",
    rule52a: true,
    setup: async (request, admin) => {
      const tag = uniqueTag()
      const field = (page: Page, key: string) => page.getByTestId(`affiliate-program-field-${key}`)
      const opener = (page: Page) =>
        page.getByTestId("affiliate-programs-table").getByRole("button", { name: "Create program" })
      return {
        path: PROGRAMS,
        opener,
        open: async (page) => {
          await page.goto(`${BACKEND_URL}/app/affiliate`)
          await opener(page).click()
        },
        fill: async (page, n) => {
          await field(page, "name").fill(`ADM-39 program ${tag} ${n}`)
          await fillDatePicker(field(page, "starts_at"), "2031-01-01T00:00")
          await fillDatePicker(field(page, "ends_at"), "2031-02-01T00:00")
          await field(page, "commission_value").fill("5")
        },
        save: (page) => page.getByTestId("affiliate-program-save"),
        idOf: (body) => body.program.id,
        cleanup: async (ids) => {
          for (const id of ids) {
            const res = await request.delete(`${BACKEND_URL}${PROGRAMS}/${id}`, { headers: admin })
            expect.soft(res.ok(), `ลบ program ${id}`).toBe(true)
          }
        },
      }
    },
  },
  {
    name: "Create payout (mock สำเร็จ — payout จริงต้องมี commission entry ใหม่ทุกครั้ง)",
    rule52a: true,
    setup: async (request, admin) => {
      const affiliate = await createActiveAffiliate(request, admin, { prefix: "e2e-adm39" })
      const field = (page: Page) => page.getByTestId("affiliate-payout-field-affiliate_id")
      const opener = (page: Page) =>
        page.getByTestId("affiliate-payouts-table").getByRole("button", { name: "Create payout" })
      return {
        path: "/admin/affiliate/payouts",
        ok: { payout: { id: "afpay_adm39_mock" } },
        opener,
        open: async (page) => {
          await page.goto(`${BACKEND_URL}/app/affiliate`)
          await page.getByTestId("affiliate-admin-tab-payouts").click()
          await opener(page).click()
        },
        fill: async (page) => {
          await field(page).click()
          await field(page).fill(affiliate.email)
          await page.getByRole("option").filter({ hasText: affiliate.email }).click()
        },
        save: (page) => page.getByTestId("affiliate-payout-save"),
        cleanup: async () => {
          await sql("delete from affiliate where id = $1", [affiliate.id]).catch((e: Error) =>
            expect.soft(e.message, `ลบ affiliate ${affiliate.id}`).toBe("")
          )
        },
      }
    },
  },
  {
    name: "Create campaign (mock สำเร็จ — แคมเปญลบผ่าน API ไม่ได้)",
    closesWithAnimation: true,
    setup: async (request, admin) => {
      const title = `ADM39 product ${uniqueTag()}`
      const { shipping_profiles } = await call(request, admin, "/admin/shipping-profiles?type=default")
      const { product } = await call(request, admin, "/admin/products", {
        title,
        status: "published",
        shipping_profile_id: shipping_profiles[0].id,
        options: [{ title: "Default", values: ["Default"] }],
        variants: [{ title: "Default", options: { Default: "Default" }, prices: [{ currency_code: "thb", amount: 100 }] }],
      })
      const ends = new Date(Date.now() + 48 * HOUR + 7 * HOUR).toISOString().slice(0, 16)
      const opener = (page: Page) => page.getByTestId("gb-campaigns-table").getByRole("button", { name: "Create campaign" })
      return {
        path: "/admin/group-buy/campaigns",
        ok: { campaign: { id: "gbcamp_adm39_mock" } },
        opener,
        open: async (page) => {
          await page.goto(`${BACKEND_URL}/app/group-buying`)
          await opener(page).click()
        },
        fill: async (page, n) => {
          const values: Record<string, string> = { name: `ADM-39 campaign ${n}`, target_value: "3", discount_value: "10" }
          for (const [key, value] of Object.entries(values)) {
            await page.getByTestId(`gb-field-${key}`).fill(value)
          }
          await fillDatePicker(page.getByTestId("gb-field-ends_at"), ends)
          const picker = page.getByTestId("gb-product-picker")
          await picker.getByRole("searchbox").fill(title)
          const row = picker.locator("tbody tr").filter({ hasText: title })
          await row.getByRole("checkbox").click()
          await expect(row.getByRole("checkbox")).toBeChecked()
        },
        save: (page) => page.getByTestId("gb-campaign-create-submit"),
        cleanup: async () => {
          const res = await request.delete(`${BACKEND_URL}/admin/products/${product.id}`, { headers: admin })
          expect.soft(res.ok(), `ลบ product ${product.id}`).toBe(true)
        },
      }
    },
  },
  {
    name: "Create pool บนหน้า variant (mock สำเร็จ — pool จริงสร้างได้ครั้งเดียวต่อ variant)",
    closesWithAnimation: true,
    rule52a: true,
    setup: async (request, admin) => {
      const tag = uniqueTag()
      const { product } = await call(request, admin, "/admin/products", {
        title: `ADM-39 voucher ${tag}`,
        options: [{ title: "Value", values: ["500"] }],
        variants: [{ title: "500 THB", options: { Value: "500" }, prices: [{ currency_code: "thb", amount: 500 }] }],
      })
      const { partner } = await call(request, admin, PARTNERS, { name: `ADM-39 pool partner ${tag}` })
      const opener = (page: Page) => page.getByRole("button", { name: "Create pool" })
      return {
        path: "/admin/evoucher/pools",
        ok: { pool: { id: "evpool_adm39_mock" } },
        opener,
        open: async (page) => {
          await page.goto(`${BACKEND_URL}/app/products/${product.id}/variants/${product.variants[0].id}`)
          await opener(page).click()
        },
        fill: async (page, n) => {
          await page.getByLabel("Partner *", { exact: true }).click()
          await page.getByRole("option", { name: partner.name }).click()
          await page.getByLabel("Name *", { exact: true }).fill(`ADM-39 pool ${n}`)
          await page.getByLabel("How to use * (shown in the delivery email)", { exact: true }).fill("Show the code")
        },
        save: (page) => dialog(page).getByRole("button", { name: "Save" }),
        cleanup: async () => {
          for (const path of [`/admin/products/${product.id}`, `${PARTNERS}/${partner.id}`]) {
            const res = await request.delete(`${BACKEND_URL}${path}`, { headers: admin })
            expect.soft(res.ok(), `DELETE ${path}`).toBe(true)
          }
        },
      }
    },
  },
]

for (const c of CASES) {
  test(`AC-44: ${c.name} — dblclick 100ms / ⌘+Enter ระหว่างปิด = POST 1 ครั้ง, 500 แล้วกดใหม่ได้, เปิดใหม่ Save ได้`, async ({
    page,
    request,
    step,
  }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const form = await c.setup(request, admin)
    const posts = countPosts(page, form.path)
    const ids: string[] = []
    if (form.idOf) {
      const idOf = form.idOf
      page.on("response", async (res) => {
        if (res.request().method() === "POST" && new URL(res.url()).pathname === form.path && res.status() === 200) {
          ids.push(idOf(await res.json()))
        }
      })
    }
    const { failNext } = await routePosts(page, form.path, form.ok)
    try {
      await step("(a) ดับเบิลคลิก Save เว้น 100ms → modal ปิด และ POST 1 ครั้ง", async () => {
        await loginAdmin(page)
        await form.open(page)
        await form.fill(page, 1)
        const created = postResponse(page, form.path)
        await humanDoubleClick(page, form.save(page), async () => {
          expect((await created).status()).toBe(200)
          await expect(openDialog(page)).toHaveCount(0)
        })
        await expect(dialog(page)).toHaveCount(0)
        expect(posts).toHaveLength(1)
      })

      await step("(d)+(b) เปิดฟอร์มใหม่ → Save ส่งได้; ⌘/Ctrl+Enter ทันทีหลัง response ระหว่าง modal ปิด → ไม่มี POST เพิ่ม", async () => {
        await form.open(page)
        await form.fill(page, 2)
        const created = postResponse(page, form.path)
        await form.save(page).click()
        expect((await created).status()).toBe(200)
        await expect(openDialog(page)).toHaveCount(0)
        await page.keyboard.press("ControlOrMeta+Enter")
        await expect(dialog(page)).toHaveCount(0)
        expect(posts).toHaveLength(2)
      })

      await step("(c) API ตอบ 500 → modal ยังเปิด กด Save อีกครั้งได้และ POST ครั้งที่ 2 สำเร็จ", async () => {
        await form.open(page)
        await form.fill(page, 3)
        failNext()
        const failed = postResponse(page, form.path)
        await form.save(page).click()
        expect((await failed).status()).toBe(500)
        await expect(openDialog(page)).toHaveCount(1)
        const created = postResponse(page, form.path)
        await form.save(page).click()
        expect((await created).status()).toBe(200)
        await expect(dialog(page)).toHaveCount(0)
        expect(posts).toHaveLength(4)
      })

      await step("(e) AC-51: หลัง POST สำเร็จ ระหว่าง modal ปิด ปุ่ม Save disabled ทุก frame (กฎ 50)", async () => {
        await form.open(page)
        await form.fill(page, 4)
        const frames = await watchDisabledAfterResponse(form.save(page), form.path)
        const created = postResponse(page, form.path)
        await form.save(page).click()
        expect((await created).status()).toBe(200)
        await expect(dialog(page)).toHaveCount(0)
        const seen = await frames()
        test.info().annotations.push({ type: "AC-51 frames หลัง response", description: JSON.stringify(seen) })
        // nit #513: modal ที่ปิดด้วยแอนิเมชันต้องมี frame ให้ตรวจ (ไม่งั้น assert ด้านล่างผ่านเปล่า)
        if (c.closesWithAnimation) expect(seen.length, "มี frame หลัง response").toBeGreaterThan(0)
        expect(seen.filter((disabled) => !disabled), `frame ที่ Save กดได้: ${JSON.stringify(seen)}`).toEqual([])
        expect(posts).toHaveLength(5)
      })
    } finally {
      await form.cleanup(ids)
    }
  })
}

/**
 * นับ dialog ที่ถูกเพิ่มเข้า DOM นับจากจุดนี้ (MutationObserver) — ฟอร์มที่เปิดจาก repeat อาจถูกปิดทันทีด้วย repeat ถัดไป
 * (focus เข้าไปที่ปุ่มปิด X ของ FocusModal) ตรวจแค่ "ตอนจบไม่มี dialog" จึงไม่พอ
 */
async function watchDialogOpens(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __adm48: number }
    w.__adm48 = 0
    new MutationObserver((records) => {
      for (const r of records) {
        for (const node of Array.from(r.addedNodes)) {
          if (node instanceof Element && (node.matches('[role="dialog"]') || node.querySelector('[role="dialog"]'))) w.__adm48++
        }
      }
    }).observe(document.body, { childList: true, subtree: true })
  })
  return async () => {
    // รอ 2 frame ให้ React render ผลของ keydown ที่เพิ่ง dispatch
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    return page.evaluate(() => (window as unknown as { __adm48: number }).__adm48)
  }
}

// ADM-48 (spec 08 กฎ 52a, AC-53): กด Enter ค้างบน Save — keydown แรก submit; modal ปิดแล้ว focus คืนปุ่มเปิด (useRestoreOpenerFocus)
// keydown ที่ repeat ต่อจากนั้นตกที่ปุ่มเปิด → ต้องไม่เปิดฟอร์มใหม่ (ล้มบน develop) และ focus ยังอยู่ที่ปุ่มเปิด (กฎ 38)
// ส่ง repeat หลัง modal ปิดจบ = กรณีที่ lock/disabled ของ Save ไม่ช่วย (ปุ่ม Save ถูกถอดแล้ว)
for (const c of CASES.filter((c) => c.rule52a)) {
  test(`AC-53: ${c.name} — Enter ค้างบน Save (keydown 1 + repeat 5) = POST 1 ครั้ง และไม่เปิดฟอร์มใหม่`, async ({
    page,
    request,
    step,
  }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const form = await c.setup(request, admin)
    const posts = countPosts(page, form.path)
    const ids: string[] = []
    if (form.idOf) {
      const idOf = form.idOf
      page.on("response", async (res) => {
        if (res.request().method() === "POST" && new URL(res.url()).pathname === form.path && res.status() === 200) {
          ids.push(idOf(await res.json()))
        }
      })
    }
    await routePosts(page, form.path, form.ok)
    try {
      await step("focus Save → keydown Enter → response 200 → modal ปิด → keydown repeat 5 ครั้ง → keyup", async () => {
        await loginAdmin(page)
        await form.open(page)
        await form.fill(page, 1)
        await form.save(page).focus()
        const created = postResponse(page, form.path)
        await page.keyboard.down("Enter")
        expect((await created).status()).toBe(200)
        await expect(dialog(page)).toHaveCount(0)
        await expect(form.opener(page)).toBeFocused()
        const opened = await watchDialogOpens(page)
        // keyboard.down ซ้ำโดยไม่ up = keydown ที่ repeat === true (แบบกดปุ่มค้างจริง)
        for (let i = 0; i < 5; i++) {
          await page.keyboard.down("Enter")
        }
        await page.keyboard.up("Enter")
        expect(await opened(), "จำนวนครั้งที่ dialog เปิดขึ้นจาก keydown repeat").toBe(0)
        await expect(dialog(page)).toHaveCount(0)
        await expect(form.opener(page)).toBeFocused()
        expect(posts).toHaveLength(1)
      })

      await step("ปล่อยแล้วกด Enter ใหม่ที่ปุ่มเปิด → เปิดฟอร์มได้ตามปกติ (ไม่กลืน keydown ที่ไม่ใช่ repeat)", async () => {
        await page.keyboard.press("Enter")
        await expect(openDialog(page)).toHaveCount(1)
        expect(posts).toHaveLength(1)
      })
    } finally {
      await form.cleanup(ids)
    }
  })
}

/** แคมเปญ pool ที่ active ของ seed (t-shirt) — `status("ended")` จบแคมเปญใน cleanup */
async function createActivePoolCampaign(request: APIRequestContext, admin: Headers) {
  const { products } = await call(request, admin, "/admin/products?handle=t-shirt&fields=id")
  const { campaign } = await call(request, admin, "/admin/group-buy/campaigns", {
    name: `ADM-39 pool ${uniqueTag()}`,
    target_type: "orders",
    target_value: 3,
    group_mode: "pool",
    team_duration_hours: null,
    ends_at: new Date(Date.now() + 48 * HOUR).toISOString(),
    application_method: {
      type: "percentage",
      target_type: "items",
      allocation: "each",
      max_quantity: 10,
      value: 10,
      target_rules: [{ attribute: "items.product.id", operator: "in", values: [products[0].id] }],
    },
  })
  const status = (next: string) => call(request, admin, `/admin/group-buy/campaigns/${campaign.id}/status`, { status: next })
  await status("active")
  return { campaign, status }
}

test("AC-44: Create pool group (ปุ่มบนหน้าแคมเปญ ไม่มี modal) — ดับเบิลคลิกเว้น 100ms = POST 1 ครั้ง; 500 แล้วกดใหม่ได้; คลิกแยกครั้งใหม่สร้างได้", async ({
  page,
  request,
  step,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const { campaign, status } = await createActivePoolCampaign(request, admin)
  const path = `/admin/group-buy/campaigns/${campaign.id}/groups`
  const posts = countPosts(page, path)
  // mock สำเร็จ: POST จริงช้ากว่า 100ms (workflow) คลิกที่สองจึงโดน lock ระหว่างรอเสมอ — response เร็ว = กรณีที่ ADM-B1 เกิด
  const { failNext } = await routePosts(page, path, { group: { id: "gbgrp_adm39_mock" } })
  const button = page.getByTestId("gb-create-pool-group")
  try {
    await step("(a) ดับเบิลคลิกเว้น 100ms → POST 1 ครั้ง", async () => {
      await loginAdmin(page)
      await page.goto(`${BACKEND_URL}/app/group-buying/${campaign.id}`)
      await expect(button).toBeEnabled()
      const created = postResponse(page, path)
      await humanDoubleClick(page, button, async () => expect((await created).status()).toBe(200))
      await expect(button).toBeEnabled()
      expect(posts).toHaveLength(1)
    })

    await step("(c)+(d) 500 → กดอีกครั้งได้ POST ครั้งที่ 2; คลิกแยกอีกครั้งสร้างได้ (pool group สร้างเพิ่มได้ตั้งใจ)", async () => {
      failNext()
      const failed = postResponse(page, path)
      await button.click()
      expect((await failed).status()).toBe(500)
      await expect(button).toBeEnabled()
      for (const expected of [3, 4]) {
        const created = postResponse(page, path)
        await button.click()
        expect((await created).status()).toBe(200)
        await expect(button).toBeEnabled()
        expect(posts).toHaveLength(expected)
      }
    })
  } finally {
    await status("ended").catch((e: Error) => expect.soft(e.message, "จบแคมเปญของ test").toBe(""))
  }
})

test("AC-51 (b): Create pool group — กด Enter ค้าง (keydown repeat) = POST 1 ครั้ง; คลิกแยก 2 ครั้งหลัง response = 2 group", async ({
  page,
  request,
  step,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const { campaign, status } = await createActivePoolCampaign(request, admin)
  const path = `/admin/group-buy/campaigns/${campaign.id}/groups`
  const posts = countPosts(page, path)
  // mock สำเร็จแบบเคส AC-44: response เร็ว = keydown ที่ repeat มาถึงหลัง response กลับแล้ว (กรณีที่ lock in-flight ไม่ช่วย)
  await routePosts(page, path, { group: { id: "gbgrp_adm46_mock" } })
  const button = page.getByTestId("gb-create-pool-group")
  try {
    await step("โฟกัสปุ่มแล้วกด Enter ค้าง: keydown แรก → response กลับ → keydown repeat อีก 4 ครั้ง → POST 1 ครั้ง", async () => {
      await loginAdmin(page)
      await page.goto(`${BACKEND_URL}/app/group-buying/${campaign.id}`)
      await expect(button).toBeEnabled()
      await button.focus()
      const created = postResponse(page, path)
      await page.keyboard.down("Enter")
      expect((await created).status()).toBe(200)
      await expect(button).toBeEnabled()
      await button.focus()
      // keyboard.down ซ้ำโดยไม่ up = keydown ที่ repeat === true (แบบกดปุ่มค้างจริง)
      for (let i = 0; i < 4; i++) {
        await page.keyboard.down("Enter")
      }
      await page.keyboard.up("Enter")
      await expect(button).toBeEnabled()
      expect(posts).toHaveLength(1)
    })

    await step("คลิกแยก 2 ครั้งหลัง response → POST 2 ครั้ง (regression กฎ 43)", async () => {
      for (const expected of [2, 3]) {
        const created = postResponse(page, path)
        await button.click()
        expect((await created).status()).toBe(200)
        await expect(button).toBeEnabled()
        expect(posts).toHaveLength(expected)
      }
    })
  } finally {
    await status("ended").catch((e: Error) => expect.soft(e.message, "จบแคมเปญของ test").toBe(""))
  }
})

test("AC-44: Import codes (หน้า pool) — ดับเบิลคลิกเว้น 100ms = POST 1 ครั้ง; 500 แล้วกดใหม่ได้; เลือกไฟล์ใหม่ import ได้", async ({
  page,
  request,
  step,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const voucher = await createVoucher(request, admin, 1)
  const { pools } = await call(request, admin, `/admin/evoucher/pools?variant_id=${voucher.variantId}`)
  const path = `/admin/evoucher/pools/${pools[0].id}/import`
  const posts = countPosts(page, path)
  const { failNext } = await routePosts(page, path)
  const tag = uniqueTag()
  const button = page.getByRole("button", { name: "Import", exact: true })
  const choose = (n: number) =>
    page.getByLabel("CSV file").setInputFiles({
      name: `codes-${n}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(`${tag}-${n},1234\n`),
    })

  await step("(a) ดับเบิลคลิก Import เว้น 100ms → POST 1 ครั้ง", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/evouchers/pools/${pools[0].id}`)
    await choose(1)
    const created = postResponse(page, path)
    await humanDoubleClick(page, button, async () => expect((await created).status()).toBe(200))
    await expect(page.getByTestId("evoucher-import-result")).toContainText("Imported 1 codes")
    expect(posts).toHaveLength(1)
  })

  await step("(c)+(d) เลือกไฟล์ใหม่ → 500 → กดอีกครั้งได้ POST ครั้งที่ 2 สำเร็จ", async () => {
    await choose(2)
    failNext()
    const failed = postResponse(page, path)
    await button.click()
    expect((await failed).status()).toBe(500)
    // AC-51 (a) (กฎ 50): ไม่มี modal — สำเร็จแล้วปุ่ม Import disabled ทุก frame หลัง response จนเลือกไฟล์ใหม่
    const frames = await watchDisabledAfterResponse(button, path)
    const created = postResponse(page, path)
    await button.click()
    expect((await created).status()).toBe(200)
    await expect(page.getByTestId("evoucher-import-result")).toContainText("Imported 1 codes")
    expect(posts).toHaveLength(3)
    const seen = await frames()
    expect(seen.length, "มี frame หลัง response").toBeGreaterThan(0)
    expect(seen.filter((disabled) => !disabled), `frame ที่ Import กดได้: ${JSON.stringify(seen)}`).toEqual([])
  })
})
