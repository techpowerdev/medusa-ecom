import type { CDPSession, Locator, Page } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"

// SFUI-14 (spec 09 กฎ 38, AC-38): สถานะ autofill ของ Chrome ต้องไม่เปลี่ยนขอบของช่องกรอก —
// กฎ `:-webkit-autofill` ของ starter ใน globals.css (`@layer utilities`, specificity 0,1,1 > `.border-0` 0,1,0)
// เคยตั้ง `border: 1px solid #212121` ทับ `border-0` ของ `InputGroupInput` (กล่องเหลี่ยมซ้อนในช่องรหัสผ่าน) และ `border-input` ของ `Input`
// channel "chromium" = Chromium เต็ม (ติดตั้งมากับ `playwright install chromium`) — headless shell ไม่มี CDP domain `Autofill`
test.use({ evidenceTarget: { feature: "storefront-forms", taskId: "SFUI-14" }, channel: "chromium" })

const SIDES = ["top", "right", "bottom", "left"] as const

/** ความกว้าง/สีขอบทั้งสี่ด้านของ control (computed) */
const borderOf = (control: Locator) =>
  control.evaluate(
    (el, sides) => {
      const cs = getComputedStyle(el)
      return sides.map((s) => [cs.getPropertyValue(`border-${s}-width`), cs.getPropertyValue(`border-${s}-color`)].join(" "))
    },
    [...SIDES]
  )

const AUTOFILL = /:(?:-webkit-)?autofill/g
const SIM_ATTR = "data-sfui14-autofill"

/**
 * กฎ CSS ทุกข้อที่ selector มี `:-webkit-autofill`/`:autofill` (ไล่ทุก @layer/@media) → รายการ property ที่ประกาศ
 * และ (ถ้า `simulate`) แทรกสำเนาของกฎเดียวกัน**ใน layer และตำแหน่งถัดจากกฎเดิม**โดยเปลี่ยน `:-webkit-autofill` เป็น `[data-sfui14-autofill]`
 * (specificity เท่ากัน 0,1,0) — ใช้จำลอง cascade ของสถานะ autofill กับช่องที่ Chrome autofill ผ่าน CDP ไม่ได้ (รหัสผ่าน)
 */
const autofillRules = (page: Page, simulate: boolean) =>
  page.evaluate(
    ({ source, flags, attr, simulate }) => {
      const re = new RegExp(source, flags)
      const found: { selector: string; props: string[] }[] = []
      const walk = (parent: CSSStyleSheet | CSSGroupingRule) => {
        const list = parent.cssRules
        for (let i = list.length - 1; i >= 0; i--) {
          const rule = list[i]
          if (rule instanceof CSSStyleRule) {
            re.lastIndex = 0
            if (!re.test(rule.selectorText)) continue
            found.push({ selector: rule.selectorText, props: Array.from(rule.style) })
            if (simulate) parent.insertRule(rule.cssText.replace(re, `[${attr}]`), i + 1)
          } else if (rule instanceof CSSGroupingRule) {
            walk(rule)
          }
        }
      }
      for (const sheet of Array.from(document.styleSheets)) walk(sheet)
      return found
    },
    { source: AUTOFILL.source, flags: AUTOFILL.flags, attr: SIM_ATTR, simulate }
  )

test("AC-38 (1): กฎ autofill ของ globals.css ไม่ตั้งขอบ และช่องรหัสผ่าน/อีเมลของ login ในสถานะ autofill ขอบเท่าสถานะปกติ", async ({
  page,
  step,
  evidence,
}) => {
  const login = page.getByTestId("login-page")
  const email = login.getByTestId("email-input")
  const password = login.getByTestId("password-input")

  await step("เปิดหน้า login แล้ววัดขอบสถานะปกติ", async () => {
    await page.goto(`/${CC}/account`)
    await expect(password).toBeVisible()
    await expect(password).toHaveAttribute("data-slot", "input-group-control")
  })
  // รอ CSS ของหน้าโหลดครบ (ก่อนนั้นเป็นขอบ 2px ของ user agent) — InputGroupInput ปกติ border-0
  await expect.poll(() => borderOf(password), "InputGroupInput ปกติ border-0").toEqual(SIDES.map(() => expect.stringMatching(/^0px /)))
  const normalEmail = await borderOf(email)
  const normalPassword = await borderOf(password)

  let rules: Awaited<ReturnType<typeof autofillRules>> = []
  await step("จำลอง cascade ของ :-webkit-autofill บนอีเมลและรหัสผ่าน", async () => {
    rules = await autofillRules(page, true)
    for (const el of [email, password]) await el.evaluate((e, attr) => e.setAttribute(attr, ""), SIM_ATTR)
    await email.fill("autofill@example.com")
    await password.fill("secret-password")
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  })
  await evidence("login-autofill-simulated")

  expect.soft(await borderOf(password), "ช่องรหัสผ่าน (InputGroupInput) ใน autofill ไม่มีขอบซ้อน").toEqual(normalPassword)
  expect.soft(await borderOf(email), "ช่องอีเมล (Input) ใน autofill ขอบเท่าสถานะปกติ").toEqual(normalEmail)
  // ยังคงกฎ autofill ของ starter ไว้ (กันพื้นสีของ Chrome) — แต่ไม่มี property ขอบ
  expect(rules.length, "พบกฎ autofill ใน CSS ที่โหลด").toBeGreaterThan(0)
  expect(rules.flatMap((r) => r.props)).toEqual(expect.arrayContaining(["-webkit-text-fill-color"]))
  expect(
    rules.filter((r) => r.props.some((p) => p.startsWith("border"))).map((r) => r.selector),
    "กฎ autofill ที่ตั้งขอบ"
  ).toEqual([])
})

test.describe("Chrome autofill จริง (CDP Autofill.trigger)", () => {
  test("AC-38 (2): ฟอร์ม register ที่ Chrome autofill ชื่อ/อีเมล/เบอร์ ขอบของ Input เท่าสถานะปกติ", async ({ page, step, evidence }) => {
    const register = page.getByTestId("register-page")
    const ids = ["first-name-input", "last-name-input", "email-input", "phone-input"]
    const normal: Record<string, string[]> = {}
    let cdp: CDPSession

    await step("เปิดฟอร์ม register แล้ววัดขอบสถานะปกติ", async () => {
      await page.goto(`/${CC}/account`)
      await page.getByTestId("login-to-register-button").click()
      await expect(register.getByTestId("email-input")).toBeVisible()
      // รอ CSS ของหน้าโหลดครบ (ก่อนนั้นเป็นขอบ 2px ของ user agent)
      await expect.poll(() => borderOf(register.getByTestId("email-input"))).toEqual(SIDES.map(() => expect.stringMatching(/^1px /)))
      for (const id of ids) normal[id] = await borderOf(register.getByTestId(id))
    })

    await step("Chrome autofill ที่อยู่ (CDP)", async () => {
      cdp = await page.context().newCDPSession(page)
      const email = register.getByTestId("email-input")
      await email.focus()
      const { root } = await cdp.send("DOM.getDocument")
      const { nodeId } = await cdp.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector: '[data-testid="register-page"] [data-testid="email-input"]',
      })
      const { node } = await cdp.send("DOM.describeNode", { nodeId })
      // ฟอร์มเพิ่ง render — Chrome ต้อง parse ฟอร์มก่อนจึงหา field เจอ (ลองซ้ำจนสำเร็จ)
      await expect(async () => {
        await cdp.send("Autofill.trigger", {
          fieldId: node.backendNodeId,
          address: {
            fields: [
              { name: "NAME_FIRST", value: "สมชาย" },
              { name: "NAME_LAST", value: "ใจดี" },
              { name: "EMAIL_ADDRESS", value: "autofill@example.com" },
              { name: "PHONE_HOME_WHOLE_NUMBER", value: "0812345678" },
            ],
          },
        })
      }).toPass({ timeout: 10_000 })
      await expect(email).toHaveValue("autofill@example.com")
      await expect.poll(() => email.evaluate((e) => e.matches(":-webkit-autofill"))).toBe(true)
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    })

    const filled = await register
      .locator("input:-webkit-autofill")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") ?? ""))
    await evidence("register-autofill-chrome")
    expect(filled).toEqual(expect.arrayContaining(["email-input"]))
    for (const id of filled.filter((t) => ids.includes(t))) {
      expect.soft(await borderOf(register.getByTestId(id)), `${id}: ขอบใน autofill เท่าสถานะปกติ`).toEqual(normal[id])
    }
  })
})
