import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { addToCartFromPdp } from "./support/server-action"
import { THAI } from "./support/thai-text"

// SFUI-3c (spec 09 กฎ 4, 9, 12, AC-11): ที่อยู่ที่บันทึกไว้ใน checkout เป็น `Select` ของ shadcn (Radix) ใช้คีย์บอร์ดได้,
// แผงแก้ไขในหน้า profile เป็น `Collapsible` ที่คง `data-open` เดิม, dropdown ตะกร้าเป็น `Popover` และตัวเลือกประเทศใน side menu เป็น `Select`
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-3c" } })

const PRODUCT = "t-shirt"

const address = (address_1: string, first_name: string) => ({
  first_name,
  last_name: "ใจดี",
  address_1,
  postal_code: "10110",
  city: "วัฒนา",
  province: "กรุงเทพมหานคร",
  country_code: CC,
  phone: "0812345678",
})

test("AC-11: เลือกที่อยู่ที่บันทึกไว้ด้วย ArrowDown + Enter และ Escape ไม่เปลี่ยนค่า", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const store = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  for (const data of [address("11 ถนนพระราม 4", "สมชาย"), address("22 ถนนสีลม", "สมหญิง")]) {
    const saved = await request.post(`${BACKEND_URL}/store/customers/me/addresses`, { headers: store, data })
    expect(saved.status(), "saved address").toBe(200)
  }
  await signInAs(context, baseURL!, customer)
  await page.goto(`/${CC}/products/${PRODUCT}`)
  await addToCartFromPdp(page, { request, pk, customer })
  await page.goto(`/${CC}/checkout?step=address`)

  const select = page.getByTestId("shipping-address-select")
  const options = page.getByTestId("shipping-address-options")
  const addressInput = page.getByTestId("shipping-address-input")
  const option = page.getByTestId("shipping-address-option")
  /** Radix ย้าย highlight ไปที่ตัวเลือกหลังจัดตำแหน่งรายการเสร็จ — รอให้ highlight ถึงตัวที่คาดก่อนกดปุ่มถัดไป */
  const highlighted = (index: number) => expect(option.nth(index)).toHaveAttribute("data-highlighted", "")
  let second = ""

  await step("trigger เป็น SelectTrigger ของ shadcn (role combobox) ที่ยังไม่มีค่า", async () => {
    await expect(select).toHaveAttribute("data-slot", "select-trigger")
    await expect(select).toHaveAttribute("role", "combobox")
    await expect(select).toHaveText(/เลือกที่อยู่/)
  })

  await step("focus แล้ว ArrowDown เปิดรายการ, ArrowDown + Enter เลือกตัวที่สอง → ฟอร์มเปลี่ยนตาม", async () => {
    await select.focus()
    await page.keyboard.press("ArrowDown")
    await expect(options).toBeVisible()
    await expect(option).toHaveCount(2)
    await highlighted(0)
    second = (await option.nth(1).textContent()) ?? ""
    const secondAddress = ["11 ถนนพระราม 4", "22 ถนนสีลม"].find((a) => second.includes(a))
    expect(secondAddress, `ตัวเลือกที่สอง: ${second}`).toBeTruthy()
    second = secondAddress!
    await page.keyboard.press("ArrowDown")
    await highlighted(1)
    await page.keyboard.press("Enter")
    await expect(options).toBeHidden()
    await expect(addressInput).toHaveValue(second)
    await expect(select).toHaveText(second)
    await evidence("01-checkout-address-select-keyboard")
  })

  await step("เปิดอีกครั้ง เลื่อนด้วยลูกศรแล้ว Escape → ค่าเดิม", async () => {
    await select.focus()
    await page.keyboard.press("ArrowDown")
    await expect(options).toBeVisible()
    await highlighted(1)
    await page.keyboard.press("ArrowUp")
    await highlighted(0)
    await page.keyboard.press("Escape")
    await expect(options).toBeHidden()
    await expect(addressInput).toHaveValue(second)
    await expect(select).toHaveText(second)
  })
})

test("AC-11: กดแก้ไขเบอร์โทร → edit-panel ของเบอร์โทร data-open=true แผงอื่น false (Collapsible)", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const editors = ["account-name-editor", "account-phone-editor", "account-billing-address-editor"]
  const phone = page.getByTestId("account-phone-editor")

  await step("ทุกแผงปิดอยู่ (data-open=false) และเป็น CollapsibleContent ที่ render ตลอด", async () => {
    await page.goto(`/${CC}/account/profile`)
    for (const id of editors) {
      const panel = page.getByTestId(id).getByTestId("edit-panel")
      await expect(panel, id).toHaveAttribute("data-open", "false")
      await expect(panel, id).toHaveAttribute("data-slot", "collapsible-content")
    }
  })

  await step("กดแก้ไขเบอร์โทร → แผงเบอร์โทร true, ปุ่มบอกสถานะ aria-expanded, แผงอื่น false", async () => {
    await phone.getByTestId("edit-button").click()
    await expect(phone.getByTestId("edit-panel")).toHaveAttribute("data-open", "true")
    await expect(phone.getByTestId("edit-button")).toHaveAttribute("aria-expanded", "true")
    await expect(phone.getByTestId("phone-input")).toBeVisible()
    for (const id of editors.filter((e) => e !== "account-phone-editor")) {
      await expect(page.getByTestId(id).getByTestId("edit-panel"), id).toHaveAttribute("data-open", "false")
    }
    await evidence("02-profile-phone-collapsible-open")
  })
})

test("กฎ 4b: ชี้ nav-cart-link → nav-cart-dropdown เป็น PopoverContent ภาษาไทย, ออกจากพื้นที่ → ปิด", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const dropdown = page.getByTestId("nav-cart-dropdown")

  await step("ก่อน hover ไม่มี dropdown ใน DOM (ไม่ forceMount)", async () => {
    await page.goto(`/${CC}/products/${PRODUCT}`)
    await expect(page.getByTestId("nav-cart-link")).toBeVisible()
    await expect(dropdown).toHaveCount(0)
  })

  await step("hover → PopoverContent ที่มีข้อความไทย และลิงก์ไม่อยู่ใน <button>", async () => {
    await page.getByTestId("nav-cart-link").hover()
    await expect(dropdown).toBeVisible()
    await expect(dropdown).toHaveAttribute("data-slot", "popover-content")
    await expect(dropdown).toHaveText(THAI)
    const insideButton = await page.getByTestId("nav-cart-link").evaluate((el) => !!el.closest("button"))
    expect(insideButton, "nav-cart-link ต้องไม่อยู่ใน <button>").toBe(false)
  })

  await step("mouse ออกจาก nav → dropdown ปิด", async () => {
    await page.mouse.move(5, 600)
    await expect(dropdown).toHaveCount(0)
  })
})

// SFUI-20c (spec 09 กฎ 72): seed มีไทยประเทศเดียว → เมนูข้างไม่ render ตัวเลือกประเทศ (Select แบบหลายประเทศตรวจด้วย unit side-menu)
test("กฎ 4 + กฎ 72: side menu ของร้านที่มีประเทศเดียวไม่มีตัวเลือกประเทศ", async ({ page }) => {
  await page.goto(`/${CC}`)
  await page.getByTestId("nav-menu-button").click()
  await expect(page.getByTestId("nav-menu-popup")).toBeVisible()
  await expect(page.getByTestId("country-select-button")).toHaveCount(0)
})
