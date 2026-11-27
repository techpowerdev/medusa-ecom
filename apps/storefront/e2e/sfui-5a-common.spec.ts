import type { Locator, Page } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"

// SFUI-5a (spec 09 กฎ 16, 19–21, AC-15): ส่วนร่วมของ storefront หลังย้ายไป shadcn
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-5a" } })

/** จุดกลางของ element ไม่ถูก element อื่นบัง (elementFromPoint คือตัวมันหรือลูก) */
async function isOnTop(page: Page, target: Locator) {
  const box = await target.boundingBox()
  expect(box, "มี bounding box").not.toBeNull()
  const handle = await target.elementHandle()
  return page.evaluate(
    ([el, x, y]) => {
      const hit = document.elementFromPoint(x as number, y as number)
      return !!hit && (el as Element).contains(hit)
    },
    [handle, box!.x + box!.width / 2, box!.y + box!.height / 2] as const
  )
}

// SFUI-11a (spec 09 กฎ 27c, 28): ป้ายลอยถูกแทนด้วย label เหนือช่องของ `field` — label มองเห็น ไม่ถูกบัง และอยู่เหนือกล่องของช่อง
test("label ของช่องกรอก (common/components/input) อยู่เหนือช่องและมองเห็นได้ทั้งก่อนและหลังกรอก", async ({
  page,
  step,
  evidence,
}) => {
  const email = page.getByTestId("email-input")
  const label = page.getByTestId("email-input-label")

  await step("เปิดหน้า login", async () => {
    await page.goto(`/${CC}/account`)
    await expect(email).toBeVisible()
    await expect(label).toBeVisible()
  })

  await step("label ไม่ถูกบังและอยู่เหนือช่อง (ก่อนกรอก)", async () => {
    expect(await isOnTop(page, label), "label ถูกบัง").toBe(true)
    const [l, e] = [(await label.boundingBox())!, (await email.boundingBox())!]
    expect(l.y + l.height, "label อยู่เหนือช่อง").toBeLessThanOrEqual(e.y + 0.5)
  })

  await step("กรอกอีเมลแล้ว label ยังมองเห็น", async () => {
    await email.fill("somchai@example.com")
    await page.getByTestId("password-input").focus()
    expect(await isOnTop(page, label), "label ถูกบังหลังกรอก").toBe(true)
    await evidence("01-login-floating-label")
  })
})

test("404: ลูกศรของลิงก์กลับหน้าแรกมองเห็นและใช้สีเดียวกับข้อความ (token ของ shadcn)", async ({
  page,
  step,
  evidence,
}) => {
  const link = page.getByTestId("not-found-home-link")

  await step("เปิดหน้าที่ไม่มีอยู่", async () => {
    await page.goto(`/${CC}/sfui-5a-no-such-page`)
    await expect(page.getByTestId("not-found-title")).toBeVisible()
    await expect(link).toBeVisible()
  })

  await step("svg ของลูกศรมีขนาดและสีไม่โปร่งใส ตรงกับข้อความ", async () => {
    const arrow = link.locator("svg")
    await expect(arrow).toBeVisible()
    const [arrowColor, textColor] = await Promise.all([
      arrow.evaluate((el) => getComputedStyle(el).stroke),
      link.locator("span, p").first().evaluate((el) => getComputedStyle(el).color),
    ])
    expect(arrowColor).not.toBe("none")
    expect(arrowColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(arrowColor).toBe(textColor)
    await evidence("02-not-found-arrow")
  })
})
