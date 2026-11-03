import { Client } from "pg"

import { createVoucher, placeCapturedOrder, waitDelivered } from "./support/evoucher"
import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY, adminHeaders, createCustomer, publishableKey, signInAs } from "./support/medusa"
import { THAI } from "./support/thai-text"

// EV-7e (spec 02 กฎข้อ 26, 29; AC-43): หน้า /account/vouchers แบ่งหน้าละ 20, support_contact บน voucher-card,
// ลิงก์/รูป partner เฉพาะ http(s) (ข้อมูลเก่าก่อน EV-14) และ PDP มี evoucher-partner-block ไม่เกิน 1 ตัวระหว่างโหลด
test.use({ evidenceTarget: { feature: "evoucher", taskId: "EV-7e" } })

const VOUCHERS_URL = `/${STOREFRONT_COUNTRY}/account/vouchers`
const SUPPORT_CONTACT = "โทร 02-000-0000 (ทุกวัน 9:00–18:00)"

/** admin API ปฏิเสธ scheme อื่นแล้ว (EV-14) → จำลองข้อมูลเก่าด้วยการตั้งตรงใน DB ของ e2e (CI ตั้ง DATABASE_URL) */
async function setUnsafePartnerUrls(partnerId: string) {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    const { rowCount } = await db.query(
      "UPDATE evoucher_partner SET terms_url = $1, logo_url = $2 WHERE id = $3",
      ["javascript:alert(1)", "data:text/html,x", partnerId]
    )
    expect(rowCount, "อัปเดต URL ของ partner").toBe(1)
  } finally {
    await db.end()
  }
}

test("AC-43: vouchers แบ่งหน้า 20 + support_contact, ลิงก์ javascript: ไม่ถูก render, PDP บล็อกเดียวระหว่างโหลด", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const voucher = await createVoucher(request, admin, 25, {}, { support_contact: SUPPORT_CONTACT })
  await setUnsafePartnerUrls(voucher.partnerId)
  const a = await createCustomer(request, pk)
  const order = await placeCapturedOrder(request, admin, pk, a, voucher.variantId, 25)
  await waitDelivered(request, admin, order, 25)

  const noUnsafeUrls = async () => {
    await expect(page.locator('a[href^="javascript:" i]')).toHaveCount(0)
    await expect(page.locator('img[src^="data:" i]')).toHaveCount(0)
  }

  await step("หน้าแรก 20 การ์ด และการ์ดแสดง support_contact ของ partner", async () => {
    await signInAs(context, baseURL!, a)
    await page.goto(VOUCHERS_URL)
    const cards = page.getByTestId("voucher-card")
    await expect(cards).toHaveCount(20)
    await expect(cards.first().getByTestId("voucher-support-contact")).toContainText(SUPPORT_CONTACT)
    await expect(cards.first().getByTestId("voucher-support-contact")).toHaveText(THAI)
    await expect(page.getByTestId("vouchers-prev")).toHaveCount(0)
    await noUnsafeUrls()
    await evidence("01-vouchers-page-1")
  })

  await step("vouchers-next → หน้า 2 มี 5 การ์ด และ vouchers-prev กลับหน้าแรก", async () => {
    await page.getByTestId("vouchers-next").click()
    await expect(page).toHaveURL(new RegExp(`${VOUCHERS_URL}\\?page=2$`))
    await expect(page.getByTestId("voucher-card")).toHaveCount(5)
    await expect(page.getByTestId("vouchers-next")).toHaveCount(0)
    await expect(page.getByTestId("vouchers-prev")).toHaveText(THAI)
    await noUnsafeUrls()
    await evidence("02-vouchers-page-2")
    await page.getByTestId("vouchers-prev").click()
    await expect(page.getByTestId("voucher-card")).toHaveCount(20)
  })

  await step("PDP: evoucher-partner-block ไม่เกิน 1 ตัวตลอดการโหลด และไม่มีลิงก์ javascript:/รูป data:", async () => {
    // นับจำนวนบล็อกสูงสุดที่เคยอยู่ใน DOM พร้อมกัน ตั้งแต่ก่อน HTML แรกถูก parse จนหลัง hydrate
    await page.addInitScript(() => {
      const w = window as unknown as { __maxPartnerBlocks: number }
      w.__maxPartnerBlocks = 0
      const count = () => {
        w.__maxPartnerBlocks = Math.max(
          w.__maxPartnerBlocks,
          document.querySelectorAll('[data-testid="evoucher-partner-block"]').length
        )
      }
      new MutationObserver(count).observe(document, { childList: true, subtree: true })
    })
    await page.goto(`/${STOREFRONT_COUNTRY}/products/${voucher.handle}`)
    const block = page.getByTestId("evoucher-partner-block")
    await expect(block.getByTestId("evoucher-partner-name")).toHaveText(voucher.partnerName)
    // หลัง hydrate ProductActions เขียน v_id ของ variant ตั้งต้นลง URL — บล็อกยังแสดงของ variant นั้น
    await expect(page).toHaveURL(new RegExp(`v_id=${voucher.variantId}`))
    await expect(block).toHaveCount(1)
    await expect(block.getByTestId("evoucher-terms-link")).toHaveCount(0)
    await noUnsafeUrls()
    expect(await page.evaluate(() => (window as unknown as { __maxPartnerBlocks: number }).__maxPartnerBlocks)).toBe(1)
    await evidence("03-pdp-partner-block-safe-urls")
  })
})
