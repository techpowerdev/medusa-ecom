import { APIRequestContext, APIResponse, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, createCustomer, Headers, publishableKey, STOREFRONT_COUNTRY, variantOf } from "./support/medusa"

// GB-6c (spec 04 Admin UI, AC-35, กฎข้อ 17): membership ของกลุ่ม + succeed/fail แบบ manual ในหน้ารายละเอียดแคมเปญ
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "group-buying", taskId: "GB-6c2" } })

const HOUR = 60 * 60 * 1000
const BASE = `${BACKEND_URL}/admin/group-buy`

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin/store API ใน e2e
async function ok(res: APIResponse, what: string, status = 200): Promise<any> {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(status)
  return res.json()
}

/** แคมเปญ active (pool, เป้า 5 orders ไม่ครบเอง) + pool group 1 กลุ่ม — คืน campaign id และ group */
async function activePoolGroup(request: APIRequestContext, admin: Headers, productId: string) {
  const { campaign } = await ok(
    await request.post(`${BASE}/campaigns`, {
      headers: admin,
      data: {
        name: `GB-6c ${Date.now()}`,
        target_type: "orders",
        target_value: 5,
        group_mode: "pool",
        ends_at: new Date(Date.now() + 48 * HOUR).toISOString(),
        application_method: {
          type: "percentage",
          target_type: "items",
          allocation: "each",
          max_quantity: 10,
          value: 10,
          target_rules: [{ attribute: "items.product.id", operator: "in", values: [productId] }],
        },
        rules: [{ attribute: "currency_code", operator: "in", values: ["thb"] }],
      },
    }),
    "create campaign"
  )
  await ok(
    await request.post(`${BASE}/campaigns/${campaign.id}/status`, { headers: admin, data: { status: "active" } }),
    "activate"
  )
  const { group } = await ok(
    await request.post(`${BASE}/campaigns/${campaign.id}/groups`, { headers: admin, data: { name: "Pool M" } }),
    "create pool group",
    201
  )
  return { campaignId: campaign.id as string, group: group as { id: string; join_token: string } }
}

/** ลูกค้าใหม่สร้าง cart ที่มีสินค้าในแคมเปญแล้ว join กลุ่ม — คืนอีเมลและ order_id */
async function join(request: APIRequestContext, pk: string, variantId: string, joinToken: string) {
  const customer = await createCustomer(request, pk)
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const { regions } = await ok(await request.get(`${BACKEND_URL}/store/regions`, { headers }), "regions")
  const region = regions.find((r: { countries: { iso_2: string }[] }) =>
    r.countries.some((c) => c.iso_2 === STOREFRONT_COUNTRY)
  )
  const { cart } = await ok(
    await request.post(`${BACKEND_URL}/store/carts`, {
      headers,
      data: { region_id: region.id, items: [{ variant_id: variantId, quantity: 1 }] },
    }),
    "create cart"
  )
  const res = await ok(
    await request.post(`${BACKEND_URL}/store/group-buy/groups/${joinToken}/join`, {
      headers,
      data: { cart_id: cart.id },
    }),
    "join",
    201
  )
  return { email: customer.email, orderId: res.membership.order_id as string }
}

function countRequests(page: Page, method: string, path: string) {
  const seen: string[] = []
  page.on("request", (req) => {
    if (req.method() === method && new URL(req.url()).pathname === path) seen.push(req.url())
  })
  return seen
}

test("AC-35: แถวกลุ่มเปิดรายการ membership พร้อมลิงก์ order; dblclick succeed + ยืนยัน → POST 1 ครั้ง ปุ่มหาย", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const { productId, variantId } = await variantOf(request, pk, "t-shirt")
  const { campaignId, group } = await activePoolGroup(request, admin, productId)
  const members = [
    await join(request, pk, variantId, group.join_token),
    await join(request, pk, variantId, group.join_token),
  ]
  const succeedPath = `/admin/group-buy/groups/${group.id}/succeed`
  const succeedPosts = countRequests(page, "POST", succeedPath)

  const groupRows = page.getByTestId("gb-groups-table").locator("tbody tr")
  const memberRows = page.getByTestId("gb-memberships-table").locator("tbody tr")

  await step("คลิกแถวกลุ่ม → gb-memberships-table แสดงสมาชิก 2 คน ลิงก์ไป /draft-orders/<order_id>", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/group-buying/${campaignId}`)
    await expect(groupRows).toHaveCount(1)
    await expect(page.getByTestId("gb-memberships-table")).toHaveCount(0)
    await groupRows.first().click()
    await expect(memberRows).toHaveCount(2)
    for (const m of members) {
      const row = memberRows.filter({ hasText: m.email })
      await expect(row).toContainText("joined")
      await expect(row).toContainText("not_paid")
      await expect(row.getByTestId("gb-membership-order-link")).toHaveAttribute(
        "href",
        `/app/draft-orders/${m.orderId}`
      )
    }
    await expect(page.getByTestId("gb-group-succeed")).toBeVisible()
    await expect(page.getByTestId("gb-group-fail")).toBeVisible()
    await page.getByTestId("gb-memberships-table").scrollIntoViewIfNeeded()
    await evidence("01-memberships-table")
  })

  await step("dblclick gb-group-succeed → กล่องยืนยันเดียว ยืนยันแล้ว POST 1 ครั้ง กลุ่ม succeeded ปุ่มหาย", async () => {
    await page.getByTestId("gb-group-succeed").dblclick()
    await expect(page.getByRole("alertdialog")).toHaveCount(1)
    await page.getByRole("alertdialog").getByRole("button", { name: "Succeed" }).click()
    await expect(groupRows.first()).toContainText("succeeded")
    await expect(page.getByTestId("gb-group-succeed")).toHaveCount(0)
    await expect(page.getByTestId("gb-group-fail")).toHaveCount(0)
    await expect(memberRows.first()).toContainText("awaiting_payment")
    expect(succeedPosts).toHaveLength(1)
    const res = await request.get(`${BASE}/campaigns/${campaignId}/groups`, { headers: admin })
    expect((await res.json()).groups[0].status).toBe("succeeded")
    await page.getByTestId("gb-memberships-table").scrollIntoViewIfNeeded()
    await evidence("02-group-succeeded")
  })
})

test("AC-35: กลุ่มที่ไม่ใช่ open ไม่มีปุ่ม succeed/fail; fail ยกเลิกไม่มี request", async ({ page, request, step }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const { productId } = await variantOf(request, pk, "t-shirt")
  const { campaignId, group } = await activePoolGroup(request, admin, productId)
  const failPosts = countRequests(page, "POST", `/admin/group-buy/groups/${group.id}/fail`)
  const groupRows = page.getByTestId("gb-groups-table").locator("tbody tr")

  await step("กด fail แล้วยกเลิก → ไม่มี POST", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/group-buying/${campaignId}`)
    await groupRows.first().click()
    await page.getByTestId("gb-group-fail").click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click()
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    expect(failPosts).toHaveLength(0)
  })

  await step("กลุ่ม failed (ผ่าน API) → เปิดแถวแล้วไม่มีปุ่ม succeed/fail", async () => {
    await ok(await request.post(`${BASE}/groups/${group.id}/fail`, { headers: admin }), "fail group")
    await page.reload()
    await groupRows.first().click()
    await expect(page.getByTestId("gb-memberships-table")).toBeVisible()
    await expect(page.getByTestId("gb-group-succeed")).toHaveCount(0)
    await expect(page.getByTestId("gb-group-fail")).toHaveCount(0)
  })
})

// GB-6d (spec 04 กฎข้อ 23, AC-41): succeed/fail ล้มแล้วตารางกลุ่ม refetch, highlight + ปุ่มปิด, selection ข้ามหน้า
test.describe("GB-6d", () => {
  test.use({ evidenceTarget: { feature: "group-buying", taskId: "GB-6d" } })

  test("AC-41: fail ล้มเพราะกลุ่ม succeeded ไปแล้ว → GET กลุ่มใหม่ แถวเป็น succeeded ปุ่มหาย ไม่ต้อง reload", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const { productId, variantId } = await variantOf(request, pk, "t-shirt")
    const { campaignId, group } = await activePoolGroup(request, admin, productId)
    await join(request, pk, variantId, group.join_token)
    const groupRows = page.getByTestId("gb-groups-table").locator("tbody tr")

    await step("หน้าแสดงกลุ่ม open + ปุ่ม fail แล้วตั้งกลุ่มเป็น succeeded ทาง API", async () => {
      await loginAdmin(page)
      await page.goto(`${BACKEND_URL}/app/group-buying/${campaignId}`)
      await groupRows.first().click()
      await expect(groupRows.first()).toContainText("open")
      await expect(page.getByTestId("gb-group-fail")).toBeVisible()
      await ok(
        await request.post(`${BASE}/groups/${group.id}/succeed`, {
          headers: admin,
        }),
        "succeed group"
      )
    })

    await step("กด fail + ยืนยัน → 4xx แล้ว GET กลุ่มใหม่ status succeeded ภายใน 5 วินาที ปุ่มหาย", async () => {
      const groupGets = countRequests(page, "GET", `/admin/group-buy/campaigns/${campaignId}/groups`)
      const failRes = page.waitForResponse(
        (r) =>
          r.request().method() === "POST" && new URL(r.url()).pathname === `/admin/group-buy/groups/${group.id}/fail`
      )
      await page.getByTestId("gb-group-fail").click()
      await page.getByRole("alertdialog").getByRole("button", { name: "Fail" }).click()
      const status = (await failRes).status()
      expect(status).toBeGreaterThanOrEqual(400)
      expect(status).toBeLessThan(500)
      await expect(groupRows.first()).toContainText("succeeded", {
        timeout: 5_000,
      })
      expect(groupGets.length).toBeGreaterThan(0)
      await expect(page.getByTestId("gb-group-succeed")).toHaveCount(0)
      await expect(page.getByTestId("gb-group-fail")).toHaveCount(0)
      await evidence("01-fail-rejected-refetched")
    })
  })

  test("AC-41: แถวที่เลือกมี highlight + ปุ่มปิด; เปลี่ยนหน้าไปหน้าที่ไม่มีแถวที่เลือก → ปิดตาราง membership", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const { productId } = await variantOf(request, pk, "t-shirt")
    const { campaignId } = await activePoolGroup(request, admin, productId)
    // ขนาดหน้าของตารางกลุ่ม = 20 → 21 กลุ่มให้มีหน้าที่สอง
    for (let i = 0; i < 20; i++) {
      await ok(
        await request.post(`${BASE}/campaigns/${campaignId}/groups`, {
          headers: admin,
          data: { name: `Pool ${i}` },
        }),
        "create pool group",
        201
      )
    }
    const groupsTable = page.getByTestId("gb-groups-table")
    const groupRows = groupsTable.locator("tbody tr")
    const selectedRows = groupsTable.locator("tbody tr:has([data-testid=gb-group-selected])")
    const membersTable = page.getByTestId("gb-memberships-table")
    const bg = (row: typeof groupRows) => row.evaluate((el) => getComputedStyle(el).backgroundColor)

    await step("คลิกแถว → แถวนั้นมี highlight ต่างจากแถวอื่น; กดปุ่มปิด → ตาราง membership หาย", async () => {
      await loginAdmin(page)
      await page.goto(`${BACKEND_URL}/app/group-buying/${campaignId}`)
      await expect(groupRows).toHaveCount(20)
      await groupRows.nth(1).click()
      await expect(membersTable).toBeVisible()
      await expect(selectedRows).toHaveCount(1)
      await page.mouse.move(0, 0)
      await expect.poll(() => bg(groupRows.nth(1))).not.toBe(await bg(groupRows.nth(2)))
      await evidence("02-selected-row-highlight")
      await page.getByTestId("gb-memberships-close").click()
      await expect(membersTable).toHaveCount(0)
      await expect(selectedRows).toHaveCount(0)
    })

    await step("เลือกแถวในหน้า 1 แล้วไปหน้า 2 → ไม่มีตาราง membership; กลับหน้า 1 ก็ไม่เปิดค้าง", async () => {
      await groupRows.first().click()
      await expect(membersTable).toBeVisible()
      await groupsTable.getByRole("button", { name: "Next", exact: true }).click()
      await expect(groupRows).toHaveCount(1)
      await expect(membersTable).toHaveCount(0)
      await groupsTable.getByRole("button", { name: "Prev", exact: true }).click()
      await expect(groupRows).toHaveCount(20)
      await expect(membersTable).toHaveCount(0)
      await expect(selectedRows).toHaveCount(0)
    })
  })
})
