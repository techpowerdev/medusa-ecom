import type { CDPSession, Locator, Page } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"

// SFUI-14 (spec 09 กฎ 38, AC-38): สถานะ autofill ของ Chrome ต้องไม่เปลี่ยนขอบ/เงา/พื้นของช่องกรอก —
// กฎ `:-webkit-autofill` ของ starter ใน globals.css (`@layer utilities`, specificity 0,1,1 > utility 0,1,0)
// เคยตั้ง `border: 1px solid #212121` ทับ `border-0` ของ `InputGroupInput` (กล่องเหลี่ยมซ้อนในช่องรหัสผ่าน) และ `border-input` ของ `Input`
// และ `-webkit-box-shadow: 0 0 0 1000px #fff inset` ทับขอบของ `InputGroup` (control สูงเท่ากลุ่ม) กับ ring โฟกัส/`shadow-xs`
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

const shadowOf = (el: Locator) => el.evaluate((e) => getComputedStyle(e).boxShadow)
const bgOf = (el: Locator) => el.evaluate((e) => getComputedStyle(e).backgroundColor)
/** ring โฟกัสของ shadcn (`focus-visible:ring-[3px]`) = box-shadow ที่ spread 3px ไม่ใช่ inset */
const RING = /\) 0px 0px 0px 3px(?!.*inset)/
const softExpect = expect.configure({ soft: true })
const blur = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

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

test("AC-38 (1): กฎ autofill ของ globals.css ไม่ตั้งขอบ/เงา และช่องรหัสผ่าน/อีเมลของ login ในสถานะ autofill ขอบ เงา ring โฟกัสเท่าสถานะปกติ", async ({
  page,
  step,
  evidence,
}) => {
  const login = page.getByTestId("login-page")
  const email = login.getByTestId("email-input")
  const password = login.getByTestId("password-input")
  const group = password.locator("xpath=ancestor::*[@data-slot='input-group'][1]")

  await step("เปิดหน้า login แล้ววัดขอบสถานะปกติ", async () => {
    await page.goto(`/${CC}/account`)
    await expect(password).toBeVisible()
    await expect(password).toHaveAttribute("data-slot", "input-group-control")
  })
  // รอ CSS ของหน้าโหลดครบ (ก่อนนั้นเป็นขอบ 2px ของ user agent) — InputGroupInput ปกติ border-0
  await expect.poll(() => borderOf(password), "InputGroupInput ปกติ border-0").toEqual(SIDES.map(() => expect.stringMatching(/^0px /)))
  const normalEmail = await borderOf(email)
  const normalPassword = await borderOf(password)
  const normalShadow = { email: await shadowOf(email), password: await shadowOf(password) }
  // ring มี transition (`transition-[color,box-shadow]`) — รอจนถึงค่าสุดท้ายก่อนอ่าน
  await password.focus()
  await expect.poll(() => shadowOf(group), "InputGroup โฟกัสปกติมี ring 3px").toMatch(RING)
  const focusedPassword = { control: await shadowOf(password), group: await shadowOf(group) }
  await email.focus()
  await expect.poll(() => shadowOf(email), "Input โฟกัสปกติมี ring 3px").toMatch(RING)
  const focusedEmail = await shadowOf(email)
  await blur(page)

  let rules: Awaited<ReturnType<typeof autofillRules>> = []
  await step("จำลอง cascade ของ :-webkit-autofill บนอีเมลและรหัสผ่าน", async () => {
    rules = await autofillRules(page, true)
    for (const el of [email, password]) await el.evaluate((e, attr) => e.setAttribute(attr, ""), SIM_ATTR)
    await email.fill("autofill@example.com")
    await password.fill("secret-password")
    await blur(page)
  })
  await evidence("login-autofill-simulated")

  expect.soft(await borderOf(password), "ช่องรหัสผ่าน (InputGroupInput) ใน autofill ไม่มีขอบซ้อน").toEqual(normalPassword)
  expect.soft(await borderOf(email), "ช่องอีเมล (Input) ใน autofill ขอบเท่าสถานะปกติ").toEqual(normalEmail)
  // เงาของ control เท่าปกติ (InputGroupInput = shadow-none) → ไม่มีพื้นขาว inset ทับขอบของ InputGroup
  expect.soft(await shadowOf(password), "InputGroupInput ใน autofill ไม่มี box-shadow ทับขอบกลุ่ม").toEqual(normalShadow.password)
  expect.soft(await shadowOf(email), "Input ใน autofill เงาเท่าปกติ (shadow-xs)").toEqual(normalShadow.email)

  await step("โฟกัสช่องที่ autofill — ring โฟกัสยังเห็น", async () => {
    await password.focus()
    await softExpect.poll(() => shadowOf(password), "InputGroupInput โฟกัสใน autofill").toEqual(focusedPassword.control)
    await softExpect.poll(() => shadowOf(group), "ring ของ InputGroup โฟกัสใน autofill").toEqual(focusedPassword.group)
    await email.focus()
    await softExpect.poll(() => shadowOf(email), "ring ของ Input โฟกัสใน autofill").toEqual(focusedEmail)
    await blur(page)
  })

  // คงกฎ autofill ของ starter ไว้เฉพาะ text-fill + transition (กันพื้นสีของ Chrome) — ไม่มี property ขอบ/เงา
  expect(rules.length, "พบกฎ autofill ใน CSS ที่โหลด").toBeGreaterThan(0)
  expect(rules.flatMap((r) => r.props)).toEqual(expect.arrayContaining(["-webkit-text-fill-color", "transition-property"]))
  expect(
    rules.filter((r) => r.props.some((p) => p.startsWith("border") || p.includes("box-shadow"))).map((r) => r.selector),
    "กฎ autofill ที่ตั้งขอบหรือเงา"
  ).toEqual([])
})

test.describe("Chrome autofill จริง (CDP Autofill.trigger)", () => {
  test("AC-38 (2): ฟอร์ม register ที่ Chrome autofill ชื่อ/อีเมล/เบอร์ ขอบ เงา พื้น และ ring โฟกัสของ Input เท่าสถานะปกติ", async ({ page, step, evidence }) => {
    const register = page.getByTestId("register-page")
    const ids = ["first-name-input", "last-name-input", "email-input", "phone-input"]
    const normal: Record<string, string[]> = {}
    const normalShadow: Record<string, string> = {}
    const normalBg: Record<string, string> = {}
    let focusedEmail = ""
    let cdp: CDPSession

    await step("เปิดฟอร์ม register แล้ววัดขอบสถานะปกติ", async () => {
      await page.goto(`/${CC}/account`)
      await page.getByTestId("login-to-register-button").click()
      await expect(register.getByTestId("email-input")).toBeVisible()
      // รอ CSS ของหน้าโหลดครบ (ก่อนนั้นเป็นขอบ 2px ของ user agent)
      await expect.poll(() => borderOf(register.getByTestId("email-input"))).toEqual(SIDES.map(() => expect.stringMatching(/^1px /)))
      for (const id of ids) {
        normal[id] = await borderOf(register.getByTestId(id))
        normalShadow[id] = await shadowOf(register.getByTestId(id))
        normalBg[id] = await bgOf(register.getByTestId(id))
      }
      // ring มี transition (`transition-[color,box-shadow]`) — รอจนถึงค่าสุดท้ายก่อนอ่าน
      await register.getByTestId("email-input").focus()
      await expect.poll(() => shadowOf(register.getByTestId("email-input")), "Input โฟกัสปกติมี ring 3px").toMatch(RING)
      focusedEmail = await shadowOf(register.getByTestId("email-input"))
      await blur(page)
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
      await blur(page)
    })

    const filled = await register
      .locator("input:-webkit-autofill")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") ?? ""))
    expect(filled).toEqual(expect.arrayContaining(["email-input"]))
    for (const id of filled.filter((t) => ids.includes(t))) {
      const control = register.getByTestId(id)
      expect.soft(await borderOf(control), `${id}: ขอบใน autofill เท่าสถานะปกติ`).toEqual(normal[id])
      expect.soft(await shadowOf(control), `${id}: เงาใน autofill เท่าสถานะปกติ`).toEqual(normalShadow[id])
      // พื้นไม่เป็นสีฟ้าของ autofill: Chrome ตั้งพื้นแบบ !important แต่ transition 5000s ค้างไว้ที่ค่าเดิม (โปร่ง) — alpha 0 เท่าปกติ
      expect.soft(normalBg[id], `${id}: พื้นปกติโปร่ง`).toMatch(/^rgba\(.*, 0\)$/)
      expect.soft(await bgOf(control), `${id}: พื้นใน autofill โปร่งเท่าปกติ`).toMatch(/^rgba\(.*, 0\)$/)
    }

    await step("โฟกัสช่องอีเมลที่ autofill — ring โฟกัสยังเห็น", async () => {
      const email = register.getByTestId("email-input")
      await email.focus()
      await expect.poll(() => email.evaluate((e) => e.matches(":-webkit-autofill"))).toBe(true)
      await softExpect.poll(() => shadowOf(email), "ring ของ Input โฟกัสใน autofill").toEqual(focusedEmail)
    })
    await evidence("register-autofill-focus")
  })
})
