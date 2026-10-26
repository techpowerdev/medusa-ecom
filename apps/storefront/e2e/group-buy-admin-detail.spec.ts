import { APIRequestContext, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, Headers } from "./support/medusa"

// GB-6b1 (spec 04 Admin UI, AC-30, AC-31, กฎข้อ 17): หน้ารายละเอียดแคมเปญ group buying ใน Medusa admin
// admin UI เป็นภาษาอังกฤษ — หา element ด้วย data-testid ตาม spec
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "group-buying", taskId: "GB-6b1" } })

const HOUR = 60 * 60 * 1000
const BASE = `${BACKEND_URL}/admin/group-buy`

async function createCampaign(
  request: APIRequestContext,
  admin: Headers,
  group_mode: "pool" | "team" | "both",
  status: "draft" | "active" | "ended" = "draft",
  name = `GB-6b ${group_mode} ${status} ${Date.now()}`
): Promise<string> {
  const res = await request.post(`${BASE}/campaigns`, {
    headers: admin,
    data: {
      name,
      target_type: "orders",
      target_value: 3,
      group_mode,
      team_duration_hours: group_mode === "pool" ? null : 2,
      ends_at: new Date(Date.now() + 48 * HOUR).toISOString(),
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "each",
        max_quantity: 10,
        value: 10,
      },
    },
  })
  expect(res.status(), "create campaign").toBe(200)
  const id: string = (await res.json()).campaign.id
  for (const next of status === "draft" ? [] : status === "active" ? ["active"] : ["active", "ended"]) {
    const set = await request.post(`${BASE}/campaigns/${id}/status`, { headers: admin, data: { status: next } })
    expect(set.status(), `status ${next}`).toBe(200)
  }
  return id
}

/** นับ request ตาม method + path (ไม่รวม query) */
function countRequests(page: Page, method: string, path: string) {
  const seen: string[] = []
  page.on("request", (req) => {
    if (req.method() === method && new URL(req.url()).pathname === path) seen.push(req.url())
  })
  return seen
}

const openDetail = async (page: Page, id: string) => {
  await page.goto(`${BACKEND_URL}/app/group-buying/${id}`)
  await expect(page.getByTestId("gb-campaign-status")).toBeVisible()
}

test("AC-30: draft → activate ด้วยกล่องยืนยัน, ปุ่มตามสถานะ, ended ไม่มีปุ่ม", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(90_000)
  const admin = await adminHeaders(request)
  const draftId = await createCampaign(request, admin, "both")
  const endedId = await createCampaign(request, admin, "pool", "ended")
  const statusPosts = countRequests(page, "POST", `/admin/group-buy/campaigns/${draftId}/status`)

  await step("แคมเปญ draft: เห็น activate + delete ไม่เห็น end", async () => {
    await loginAdmin(page)
    await openDetail(page, draftId)
    await expect(page.getByTestId("gb-campaign-status")).toHaveText("draft")
    await expect(page.getByTestId("gb-campaign-activate")).toBeVisible()
    await expect(page.getByTestId("gb-campaign-delete")).toBeVisible()
    await expect(page.getByTestId("gb-campaign-end")).toHaveCount(0)
    await expect(page.getByTestId("gb-create-pool-group")).toHaveCount(0)
    await evidence("01-draft-actions")
  })

  await step("กด activate แล้วยืนยัน → POST status 1 ครั้ง, badge active, delete หาย, เห็น end", async () => {
    await page.getByTestId("gb-campaign-activate").click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Activate" }).click()
    await expect(page.getByTestId("gb-campaign-status")).toHaveText("active")
    await expect(page.getByTestId("gb-campaign-delete")).toHaveCount(0)
    await expect(page.getByTestId("gb-campaign-end")).toBeVisible()
    expect(statusPosts).toHaveLength(1)
  })

  await step("แคมเปญ ended: ไม่มีปุ่มเปลี่ยนสถานะ/ลบ", async () => {
    await openDetail(page, endedId)
    await expect(page.getByTestId("gb-campaign-status")).toHaveText("ended")
    for (const id of ["gb-campaign-activate", "gb-campaign-end", "gb-campaign-delete", "gb-create-pool-group"]) {
      await expect(page.getByTestId(id)).toHaveCount(0)
    }
  })
})

test("AC-30: ลบ draft — ยกเลิกไม่มี request, ยืนยันแล้ว DELETE 1 ครั้งและกลับหน้ารายการ", async ({
  page,
  request,
  step,
}) => {
  test.setTimeout(90_000)
  const admin = await adminHeaders(request)
  const name = `GB-6b delete ${Date.now()}`
  const id = await createCampaign(request, admin, "pool", "draft", name)
  const deletes = countRequests(page, "DELETE", `/admin/group-buy/campaigns/${id}`)
  const gets = countRequests(page, "GET", `/admin/group-buy/campaigns/${id}`)
  const errors: string[] = []
  page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()))

  await step("กดลบแล้วยกเลิก → ไม่มี DELETE", async () => {
    await loginAdmin(page)
    await openDetail(page, id)
    await page.getByTestId("gb-campaign-delete").click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click()
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    expect(deletes).toHaveLength(0)
  })

  await step("กดลบแล้วยืนยัน → DELETE 1 ครั้ง และกลับหน้ารายการที่ไม่มีแคมเปญนั้น", async () => {
    await page.getByTestId("gb-campaign-delete").click()
    const getsBeforeDelete = gets.length
    const errorsBeforeDelete = errors.length
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()
    await page.waitForURL((url) => url.pathname === "/app/group-buying")
    await expect(page.getByRole("heading", { name: "Group-buy campaigns" })).toBeVisible()
    await expect(page.getByText(name)).toHaveCount(0)
    expect(deletes).toHaveLength(1)
    // qa D-1: หลังลบต้องไม่ refetch แคมเปญที่ลบแล้ว (404 + error ใน console)
    await page.waitForLoadState("networkidle")
    expect(gets.length - getsBeforeDelete).toBe(0)
    expect(errors.slice(errorsBeforeDelete)).toEqual([])
    const res = await request.get(`${BASE}/campaigns/${id}`, { headers: admin })
    expect(res.status()).toBe(404)
  })
})

test("qa D-2: id ที่ไม่มีจริง → แสดง not found ไม่ค้าง Loading", async ({ page, step }) => {
  test.setTimeout(90_000)
  await step("เปิด /app/group-buying/<id ที่ไม่มี> → gb-campaign-not-found", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/group-buying/gbcamp_does_not_exist`)
    await expect(page.getByTestId("gb-campaign-not-found")).toBeVisible()
    await expect(page.getByTestId("gb-campaign-status")).toHaveCount(0)
  })
})

test("AC-31: ตารางกลุ่ม + dblclick สร้าง pool group ส่ง POST 1 ครั้ง; team/draft ไม่มีปุ่ม", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(90_000)
  const admin = await adminHeaders(request)
  const id = await createCampaign(request, admin, "both", "active")
  for (const name of ["Pool A", "Pool B"]) {
    const res = await request.post(`${BASE}/campaigns/${id}/groups`, { headers: admin, data: { name } })
    expect(res.status(), "create pool group").toBe(201)
  }
  const teamId = await createCampaign(request, admin, "team", "active")
  const groupsPath = `/admin/group-buy/campaigns/${id}/groups`
  const posts = countRequests(page, "POST", groupsPath)

  // หน่วง response ของ POST แรกไว้จนกว่า test ปล่อย เพื่อพิสูจน์ว่าปุ่ม disabled ระหว่างรอ (กฎข้อ 17)
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  let heldOnce = false
  await page.route(`**${groupsPath}*`, async (route) => {
    if (route.request().method() === "POST" && !heldOnce) {
      heldOnce = true
      await held
    }
    await route.continue()
  })

  const rows = page.getByTestId("gb-groups-table").locator("tbody tr")

  await step("แคมเปญ active both ที่มี 2 กลุ่ม → ตาราง 2 แถว แสดง kind/status/progress/ends", async () => {
    await loginAdmin(page)
    await openDetail(page, id)
    await expect(rows).toHaveCount(2)
    for (const text of ["pool", "open", "0 / 3 orders"]) {
      await expect(rows.first()).toContainText(text)
    }
    await evidence("02-groups-table")
  })

  await step("dblclick gb-create-pool-group → POST 1 ครั้ง ปุ่ม disabled ระหว่างรอ แล้วตาราง 3 แถว", async () => {
    const button = page.getByTestId("gb-create-pool-group")
    await button.dblclick()
    await expect(button).toBeDisabled()
    expect(posts).toHaveLength(1)
    const response = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === groupsPath
    )
    release()
    expect((await response).status()).toBe(201)
    await expect(rows).toHaveCount(3)
    await expect(button).toBeEnabled()
    expect(posts).toHaveLength(1)
    await evidence("03-pool-group-created")
  })

  await step("แคมเปญ group_mode=team → ไม่มี gb-create-pool-group", async () => {
    await openDetail(page, teamId)
    await expect(page.getByTestId("gb-campaign-status")).toHaveText("active")
    await expect(page.getByTestId("gb-create-pool-group")).toHaveCount(0)
  })
})
