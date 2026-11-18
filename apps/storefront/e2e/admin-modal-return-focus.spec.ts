import { Locator, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders } from "./support/medusa"

// ADM-34 (spec 08 AC-39b, กฎ 38): FocusModal แบบ state (ไม่มี FocusModal.Trigger) ปิดแล้ว focus กลับปุ่มที่ใช้เปิด
// ไม่ใช่ BODY — ปุ่มเปิดอยู่ใน action ของ DataTable หาด้วย role + ชื่อภายใน wrapper ที่มี testid (กฎ 7c/18);
// Create pool อยู่ใน Header ของ widget หาด้วย role + ชื่อแบบ e2e เดิมของ widget (evoucher-admin-forms)
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "admin-ui", taskId: "ADM-34" },
})

const PARTNERS_PATH = "/admin/evoucher/partners"
const uniqueTag = () => `adm34${Date.now()}${Math.random().toString(36).slice(2, 8)}`

const dialog = (page: Page) => page.getByRole("dialog")
const alert = (page: Page) => page.getByRole("alertdialog")
/** "opener" เมื่อปุ่มคือ document.activeElement ไม่งั้นชื่อ tag ของ activeElement (บน develop = "BODY") */
const focusedOn = (opener: Locator) =>
  opener.evaluate((el) => (el === document.activeElement ? "opener" : (document.activeElement?.tagName ?? "null")))

type Case = {
  name: string
  goto: (page: Page) => Promise<void>
  opener: (page: Page) => Locator
  /** element ที่มี testid หรือ label ภายในฟอร์ม — รอให้ฟอร์มเปิดครบ */
  field: (page: Page) => Locator
}
/** มีช่องข้อความสำหรับทำให้ฟอร์ม dirty (regression ADM-27) */
type DirtyCase = Case & { text: (page: Page) => Locator }

const partnersCase: DirtyCase = {
  name: "Create partner",
  goto: async (page) => {
    await page.goto(`${BACKEND_URL}/app/evouchers`)
  },
  opener: (page) => page.getByTestId("evoucher-partners-table").getByRole("button", { name: "Create partner" }),
  field: (page) => page.getByTestId("evoucher-partner-save"),
  text: (page) => dialog(page).getByLabel("Name *", { exact: true }),
}

const programCase: DirtyCase = {
  name: "Create program",
  goto: async (page) => {
    await page.goto(`${BACKEND_URL}/app/affiliate`)
  },
  opener: (page) => page.getByTestId("affiliate-programs-table").getByRole("button", { name: "Create program" }),
  field: (page) => page.getByTestId("affiliate-program-field-name"),
  text: (page) => page.getByTestId("affiliate-program-field-name"),
}

const CASES: Case[] = [
  partnersCase,
  programCase,
  {
    name: "Create payout",
    goto: async (page) => {
      await page.goto(`${BACKEND_URL}/app/affiliate`)
      await page.getByTestId("affiliate-admin-tab-payouts").click()
    },
    opener: (page) => page.getByTestId("affiliate-payouts-table").getByRole("button", { name: "Create payout" }),
    field: (page) => page.getByTestId("affiliate-payout-save"),
  },
  {
    name: "Create campaign",
    goto: async (page) => {
      await page.goto(`${BACKEND_URL}/app/group-buying`)
    },
    opener: (page) => page.getByTestId("gb-campaigns-table").getByRole("button", { name: "Create campaign" }),
    field: (page) => page.getByTestId("gb-field-name"),
  },
]

async function openForm(page: Page, c: Case) {
  await expect(c.opener(page)).toBeVisible()
  await c.opener(page).click()
  await expect(c.field(page)).toBeVisible()
  await expect(dialog(page)).toHaveCount(1)
}

/** dialog หาย และปุ่มที่ใช้เปิดคือ document.activeElement (Radix คืน focus ใน setTimeout หลังปิด → poll) */
async function expectFocusBack(page: Page, c: Case) {
  await expect(dialog(page)).toHaveCount(0)
  await expect.poll(() => focusedOn(c.opener(page))).toBe("opener")
}

for (const c of CASES) {
  test(`AC-39b: ${c.name} — Escape (ไม่ dirty) ปิดแล้ว focus กลับปุ่มที่เปิด`, async ({ page, step }) => {
    test.setTimeout(120_000)
    await step(`เปิด ${c.name} ด้วยปุ่ม → Escape → dialog หาย ไม่มี prompt focus อยู่ที่ปุ่ม`, async () => {
      await loginAdmin(page)
      await c.goto(page)
      await openForm(page, c)
      await page.keyboard.press("Escape")
      await expect(alert(page)).toHaveCount(0)
      await expectFocusBack(page, c)
    })
  })
}

test("AC-39b: Create pool (หน้า variant ที่ยังไม่มี pool) — Escape ปิดแล้ว focus กลับปุ่ม", async ({ page, request, step }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const res = await request.post(`${BACKEND_URL}/admin/products`, {
    headers: admin,
    data: {
      title: `ADM-34 voucher ${uniqueTag()}`,
      options: [{ title: "Value", values: ["500"] }],
      variants: [{ title: "500 THB", options: { Value: "500" }, prices: [{ currency_code: "thb", amount: 500 }] }],
    },
  })
  expect(res.status(), await res.text()).toBe(200)
  const { product } = await res.json()
  const poolCase: Case = {
    name: "Create pool",
    goto: async (p) => {
      await p.goto(`${BACKEND_URL}/app/products/${product.id}/variants/${product.variants[0].id}`)
    },
    opener: (p) => p.getByRole("button", { name: "Create pool" }),
    field: (p) => p.getByLabel("How to use * (shown in the delivery email)", { exact: true }),
  }
  try {
    await step("เปิด Create pool → Escape → focus อยู่ที่ปุ่ม Create pool", async () => {
      await loginAdmin(page)
      await poolCase.goto(page)
      await openForm(page, poolCase)
      await page.keyboard.press("Escape")
      await expectFocusBack(page, poolCase)
    })
  } finally {
    const removed = await request.delete(`${BACKEND_URL}/admin/products/${product.id}`, { headers: admin })
    expect.soft(removed.ok(), `ลบ product ${product.id}`).toBe(true)
  }
})

test("AC-39b: Create partner — บันทึกสำเร็จแล้ว focus กลับปุ่ม Create partner", async ({ page, request, step }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const name = `000 ADM-34 ${uniqueTag()}`
  let partnerId: string | undefined
  try {
    await step("กรอก Name แล้ว Save → POST 200 → dialog หาย focus อยู่ที่ปุ่ม", async () => {
      await loginAdmin(page)
      await partnersCase.goto(page)
      await openForm(page, partnersCase)
      await partnersCase.text(page).fill(name)
      const created = page.waitForResponse(
        (r) => r.request().method() === "POST" && new URL(r.url()).pathname === PARTNERS_PATH
      )
      await partnersCase.field(page).click()
      const response = await created
      expect(response.status()).toBe(200)
      partnerId = (await response.json()).partner.id
      await expectFocusBack(page, partnersCase)
    })
  } finally {
    if (partnerId) {
      const removed = await request.delete(`${BACKEND_URL}${PARTNERS_PATH}/${partnerId}`, { headers: admin })
      expect.soft(removed.ok(), `ลบ partner ${partnerId}`).toBe(true)
    }
  }
})

// regression ADM-27 (กฎ 31): dirty → prompt → Leave แล้ว focus ยังกลับปุ่ม — partner (modal คงอยู่ เปิดด้วย state)
// และ program (component ถูกถอดเมื่อปิด)
for (const c of [partnersCase, programCase]) {
  test(`AC-39b: ${c.name} — dirty + Escape → Leave แล้ว focus กลับปุ่มที่เปิด`, async ({ page, step }) => {
    test.setTimeout(120_000)
    await step(`กรอก ${c.name} → Escape → alertdialog → Leave → focus อยู่ที่ปุ่ม`, async () => {
      await loginAdmin(page)
      await c.goto(page)
      await openForm(page, c)
      await c.text(page).fill(`ADM-34 ${uniqueTag()}`)
      await page.keyboard.press("Escape")
      await expect(alert(page)).toBeVisible()
      await alert(page).getByRole("button", { name: "Leave" }).click()
      await expect(alert(page)).toHaveCount(0)
      await expectFocusBack(page, c)
    })
  })
}
