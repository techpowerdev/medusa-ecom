import crypto from "node:crypto"

import { Page } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { createVoucher } from "./support/evoucher"
import { addToCartFromPdp } from "./support/server-action"

// CORE-38: spec 01 กฎข้อ 96, AC-132 — สรุปที่อยู่ของ checkout เรียงแนวตั้งที่ < 640px (อีเมลยาวตัดบรรทัดในคอลัมน์ของตัวเอง)
// และ label แบบลอยของ `Input` ไม่ลงไปในพื้นที่ข้อความ (ขอบล่างของ label ≤ input.top + paddingTop) ทุกฟอร์มที่ใช้ `Input`
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-38" } })

const MOBILE = { width: 375, height: 812 }
const DESKTOP = { width: 1280, height: 720 }
const SM = { width: 640, height: 720 }

// qa #267 D-1: ข้อความยาวไม่มีช่องว่างในทุกกล่องสรุป (ไม่ใช่แค่อีเมล)
const LONG_NAME = "Somchaiwithaveryveryverylongfirstnamewithoutspaces"
const LONG_ADDRESS = "Moo9SukhumvitRoadKhlongToeiNueaWattanaBangkokThailand1234567890"
const LONG_CITY = "KhlongToeiNueaWattanaDistrictWithAVeryLongNameWithoutSpaces"

type Box = { x: number; y: number; width: number; height: number }

function intersectionArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

/** blur ช่องที่ focus อยู่ รอ transition/ฟอนต์จบ แล้วคืนทุก input ใน scope ที่ label ลงไปในพื้นที่ข้อความ */
async function labelsOverText(page: Page, scopeTestId: string) {
  return page.evaluate(async (scope) => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    await document.fonts.ready
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)))
    const root = document.querySelector(`[data-testid="${scope}"]`)!
    const inputs = Array.from(root.querySelectorAll<HTMLInputElement>("input")).filter(
      (input) => input.type !== "hidden" && input.parentElement?.querySelector("label")
    )
    return {
      count: inputs.length,
      overlaps: inputs
        .map((input) => {
          const label = input.parentElement!.querySelector("label")!.getBoundingClientRect()
          const limit =
            input.getBoundingClientRect().top + parseFloat(getComputedStyle(input).paddingTop)
          return { name: input.name, labelBottom: label.bottom, limit }
        })
        .filter(({ labelBottom, limit }) => labelBottom > limit),
    }
  }, scopeTestId)
}

async function expectLabelsAboveText(page: Page, scopeTestId: string, minInputs: number) {
  const { count, overlaps } = await labelsOverText(page, scopeTestId)
  expect(count, `${scopeTestId}: จำนวน input ที่ตรวจ`).toBeGreaterThanOrEqual(minInputs)
  expect(overlaps, `${scopeTestId}: label ทับพื้นที่ข้อความ`).toEqual([])
}

/** ทุก text node ในกล่องสรุปต้องอยู่ในกล่องของตัวเอง (วัดด้วย Range) และหน้าไม่ล้นแนวนอน */
async function expectSummaryTextContained(page: Page, ids: string[], width: number) {
  await page.setViewportSize({ width, height: 812 })
  for (const id of ids) await expect(page.getByTestId(id)).toBeVisible()
  const result = await page.evaluate((testIds) => {
    const overflow: string[] = []
    for (const id of testIds) {
      const box = document.querySelector(`[data-testid="${id}"]`)!
      const b = box.getBoundingClientRect()
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        const r = range.getBoundingClientRect()
        if (r.left < b.left - 0.5 || r.right > b.right + 0.5 || r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5) {
          overflow.push(`${id}: "${node.textContent.trim().slice(0, 24)}…" right=${r.right} > box.right=${b.right}`)
        }
      }
    }
    return { overflow, scrollWidth: document.documentElement.scrollWidth }
  }, ids)
  expect(result.overflow, `ข้อความล้นกล่องสรุปที่ ${width}px`).toEqual([])
  expect(result.scrollWidth, `scrollWidth ที่ ${width}px`).toBeLessThanOrEqual(width)
}

for (const viewport of [MOBILE, DESKTOP]) {
  test(`AC-132: label ของฟอร์ม register และ login ไม่ทับค่าที่กรอก (${viewport.width}px)`, async ({
    page,
    step,
    evidence,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto(`/${CC}/account`)

    await step("login: กรอกครบแล้ว blur", async () => {
      const login = page.getByTestId("login-page")
      await login.getByTestId("email-input").fill("somchai.longname@example.com")
      await login.getByTestId("password-input").fill("not-a-real-password")
      await expectLabelsAboveText(page, "login-page", 2)
    })

    await step("register: กรอกครบแล้ว blur", async () => {
      await page.getByTestId("login-page").getByTestId("register-button").click()
      const register = page.getByTestId("register-page")
      await expect(register).toBeVisible()
      await register.getByTestId("first-name-input").fill("สมชาย")
      await register.getByTestId("last-name-input").fill("ใจดี")
      await register.getByTestId("email-input").fill("somchai.longname@example.com")
      await register.getByTestId("phone-input").fill("0812345678")
      await register.getByTestId("password-input").fill("not-a-real-password")
      await expectLabelsAboveText(page, "register-page", 5)
      if (viewport === MOBILE) await evidence("01-register-375")
    })
  })
}

test("AC-132: checkout — label ของฟอร์มที่อยู่ไม่ทับค่า, สรุปที่อยู่ 375 เรียงแนวตั้งและอีเมลยาวไม่ล้น, 1280 แถวเดียว", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  // อีเมลยาว ≥ 40 ตัวไม่มีช่องว่าง (ไม่มีจุดให้ตัดบรรทัดตามปกติ)
  const email = `core38-averyveryverylongcustomeremail-${Date.now()}${crypto.randomInt(1e6)}@example.com`
  expect(email.length).toBeGreaterThanOrEqual(40)
  const customer = await createCustomer(request, pk, email)
  await signInAs(context, baseURL!, customer)
  await page.setViewportSize(MOBILE)

  await page.goto(`/${CC}/products/t-shirt`)
  await addToCartFromPdp(page, { request, pk, customer })
  await page.goto(`/${CC}/checkout?step=address`)
  await expect(page.getByTestId("shipping-first-name-input")).toBeVisible()

  await step("ฟอร์มที่อยู่ที่มีค่าเติม: label ไม่ทับค่า (375)", async () => {
    await page.getByTestId("shipping-first-name-input").fill("สมชาย")
    await page.getByTestId("shipping-last-name-input").fill("ใจดี")
    await page.getByTestId("shipping-address-input").fill("99 ถนนสุขุมวิท")
    await page.getByTestId("shipping-company-input").fill("บริษัท ตัวอย่าง จำกัด")
    await page.getByTestId("shipping-postal-code-input").fill("10110")
    await page.getByTestId("shipping-city-input").fill("วัฒนา")
    await page.getByTestId("shipping-country-select").selectOption(CC)
    await page.getByTestId("shipping-province-input").fill("กรุงเทพมหานคร")
    await page.getByTestId("shipping-phone-input").fill("0812345678")
    await expect(page.getByTestId("shipping-email-input")).toHaveValue(email)
    await expectLabelsAboveText(page, "addresses-section", 8)
  })

  const ids = ["shipping-address-summary", "shipping-contact-summary", "billing-address-summary"]

  await step("375: สรุปที่อยู่เรียงแนวตั้ง ไม่ซ้อนกัน อีเมลอยู่ในกล่องของตัวเอง", async () => {
    await page.getByTestId("submit-address-button").click()
    await expect(page).toHaveURL(/step=delivery/, { timeout: 30_000 })
    for (const id of ids) await expect(page.getByTestId(id)).toBeVisible()
    const [address, contact, billing] = await Promise.all(
      ids.map(async (id) => (await page.getByTestId(id).boundingBox())!)
    )
    expect(intersectionArea(contact, billing), "contact ∩ billing").toBe(0)
    expect(intersectionArea(contact, address), "contact ∩ address").toBe(0)
    expect(intersectionArea(billing, address), "billing ∩ address").toBe(0)
    // เรียงแนวตั้ง: ที่อยู่จัดส่ง → ข้อมูลติดต่อ → ที่อยู่สำหรับออกใบเสร็จ
    expect(contact.y, "contact อยู่ใต้ที่อยู่จัดส่ง").toBeGreaterThanOrEqual(address.y + address.height)
    expect(billing.y, "billing อยู่ใต้ข้อมูลติดต่อ").toBeGreaterThanOrEqual(contact.y + contact.height)

    // ขอบเขตจริงของข้อความอีเมล (Range) ต้องอยู่ในกล่องของ shipping-contact-summary
    const text = await page.getByTestId("shipping-contact-email").evaluate((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const r = range.getBoundingClientRect()
      return { text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    })
    expect(text.text).toBe(email)
    expect(text.left).toBeGreaterThanOrEqual(contact.x - 0.5)
    expect(text.right).toBeLessThanOrEqual(contact.x + contact.width + 0.5)
    expect(text.top).toBeGreaterThanOrEqual(contact.y - 0.5)
    expect(text.bottom).toBeLessThanOrEqual(contact.y + contact.height + 0.5)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      MOBILE.width
    )
    await page.getByTestId("addresses-section").scrollIntoViewIfNeeded()
    await evidence("02-address-summary-375")
  })

  await step("1280: สรุปที่อยู่สามกล่องอยู่แถวเดียว (top เท่ากัน ±2px)", async () => {
    await page.setViewportSize(DESKTOP)
    const tops = await Promise.all(ids.map(async (id) => (await page.getByTestId(id).boundingBox())!.y))
    for (const top of tops) expect(Math.abs(top - tops[0])).toBeLessThanOrEqual(2)
  })
})

test("AC-132 (qa #267 D-1): ชื่อ/ที่อยู่/เมืองยาวไม่มีช่องว่าง + billing ต่างกัน → ข้อความอยู่ในกล่องของตัวเองที่ 375/640/1280", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  await page.setViewportSize(MOBILE)

  await page.goto(`/${CC}/products/t-shirt`)
  await addToCartFromPdp(page, { request, pk, customer })
  await page.goto(`/${CC}/checkout?step=address`)
  await expect(page.getByTestId("shipping-first-name-input")).toBeVisible()

  await step("กรอกที่อยู่จัดส่งและที่อยู่ใบเสร็จ (ต่างกัน) ด้วยข้อความยาวไม่มีช่องว่าง", async () => {
    await page.getByTestId("shipping-first-name-input").fill(LONG_NAME)
    await page.getByTestId("shipping-last-name-input").fill(LONG_NAME)
    await page.getByTestId("shipping-address-input").fill(LONG_ADDRESS)
    await page.getByTestId("shipping-postal-code-input").fill("10110")
    await page.getByTestId("shipping-city-input").fill(LONG_CITY)
    await page.getByTestId("shipping-country-select").selectOption(CC)
    await page.getByTestId("shipping-phone-input").fill("0812345678")
    await page.getByTestId("billing-address-checkbox").click()
    await page.getByTestId("billing-first-name-input").fill(LONG_NAME)
    await page.getByTestId("billing-last-name-input").fill(LONG_NAME)
    await page.getByTestId("billing-address-input").fill(LONG_ADDRESS)
    await page.getByTestId("billing-postal-input").fill("10110")
    await page.getByTestId("billing-city-input").fill(LONG_CITY)
    await page.getByTestId("billing-country-select").selectOption(CC)
    await page.getByTestId("submit-address-button").click()
    await expect(page).toHaveURL(/step=delivery/, { timeout: 30_000 })
  })

  const ids = ["shipping-address-summary", "shipping-contact-summary", "billing-address-summary"]
  for (const width of [MOBILE.width, SM.width, DESKTOP.width]) {
    await step(`${width}px: ข้อความยาวอยู่ในกล่องสรุปของตัวเอง`, async () => {
      await expectSummaryTextContained(page, ids, width)
    })
  }
})

test("AC-132 (qa #267 D-1): digital-only — ชื่อ/ที่อยู่/เมืองยาวไม่มีช่องว่างอยู่ในกล่องของตัวเองที่ 375/640/1280", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const voucher = await createVoucher(request, admin)
  await page.setViewportSize(MOBILE)

  await step("ใส่ voucher แล้วกรอกที่อยู่ใบเสร็จด้วยข้อความยาว", async () => {
    await page.goto(`/${CC}/products/${voucher.handle}`)
    await addToCartFromPdp(page, { request, pk, customer })
    await page.goto(`/${CC}/checkout?step=address`)
    await expect(page.getByTestId("billing-first-name-input")).toBeVisible()
    await page.getByTestId("billing-first-name-input").fill(LONG_NAME)
    await page.getByTestId("billing-last-name-input").fill(LONG_NAME)
    await page.getByTestId("billing-address-input").fill(LONG_ADDRESS)
    await page.getByTestId("billing-postal-input").fill("10110")
    await page.getByTestId("billing-city-input").fill(LONG_CITY)
    await page.getByTestId("billing-country-select").selectOption(CC)
    await page.getByTestId("billing-phone-input").fill("0812345678")
    await page.getByTestId("submit-address-button").click()
    await expect(page).toHaveURL(/step=payment/, { timeout: 30_000 })
  })

  const ids = ["billing-address-summary", "billing-contact-summary"]
  for (const width of [MOBILE.width, SM.width, DESKTOP.width]) {
    await step(`${width}px: ข้อความยาวอยู่ในกล่องสรุปของตัวเอง`, async () => {
      await expectSummaryTextContained(page, ids, width)
    })
  }
})
