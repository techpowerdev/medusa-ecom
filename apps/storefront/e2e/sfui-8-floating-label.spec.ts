import type { APIRequestContext, BrowserContext, Locator } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import { teamGroup } from "./support/group-buy"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"

// SFUI-8 (spec 09 กฎ 23, AC-23): rule ป้ายลอยเดิมใน globals.css (`input:focus ~ label`, `input:not(:placeholder-shown) ~ label`)
// จับ <label> ทุกตัวที่ตามหลัง <input> พี่น้อง — ย้ายเป็น peer ของ common/components/input
// (1) ยกเลิกใน SFUI-11a (spec 09 กฎ 27c — label เหนือช่องของ `field` แทนป้ายลอย; ตรวจใน sfui-11-form-field.spec.ts)
// (2)(3) label อื่นที่ rule เดิมจับ (option-button ที่มี radio sr-only นำหน้า, label ที่ครอบ product-quantity-select ที่มี input hidden
//     ของ fieldset/flash นำหน้า — บน PDP และหน้า group buy) ได้ค่าตาม className ของตัวเอง (text-small-regular = 12px/20px/400) และไม่เลื่อน
//     — ข้อ (2) ล้มบน commit ฐาน (บั๊กที่แก้)
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-8" } })

type Style = { size: string; lineHeight: string; weight: string; translate: string; left: string; duration: string }

const style = (locator: Locator): Promise<Style> =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      size: s.fontSize,
      lineHeight: s.lineHeight,
      weight: s.fontWeight,
      translate: s.translate,
      left: s.left,
      duration: s.transitionDuration,
    }
  })

const OWN_SMALL = { size: "12px", lineHeight: "20px", weight: "400", translate: "none" }

const ownStyle = async (locator: Locator) => {
  const { size, lineHeight, weight, translate } = await style(locator)
  return { size, lineHeight, weight, translate }
}

async function expectOptionButtons(fieldsets: Locator) {
  await expect(fieldsets.first()).toBeVisible()
  for (const fieldset of await fieldsets.all()) {
    const legend = await fieldset.locator("legend").boundingBox()
    const buttons = fieldset.getByTestId("option-button")
    expect(await buttons.count()).toBeGreaterThan(0)
    for (const button of await buttons.all()) {
      expect(await ownStyle(button), `option-button "${await button.textContent()}"`).toEqual(OWN_SMALL)
      const box = await button.boundingBox()
      expect(box!.y, "option-button ไม่ทับ legend").toBeGreaterThanOrEqual(legend!.y + legend!.height)
    }
  }
}

async function signedIn({ context, request, baseURL }: { context: BrowserContext; request: APIRequestContext; baseURL?: string }) {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  return { pk, customer }
}

// ล้มบน commit ฐาน: rule เดิมจับ label เหล่านี้ → 10px/16px และเลื่อนขึ้น 12px ทับ legend
test("AC-23 (2)(3): PDP และหน้า group buy — option-button และ label ของจำนวน 12px/20px/400 ไม่เลื่อน ไม่ทับ legend", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  await signedIn({ context, request, baseURL })

  await step("PDP /th/products/t-shirt", async () => {
    await page.goto(`/${CC}/products/t-shirt`)
    await expectOptionButtons(page.getByTestId("product-options").locator("xpath=ancestor::fieldset[1]"))
    const quantityLabel = page.getByTestId("product-quantity-select").locator("xpath=ancestor::label[1]")
    expect(await ownStyle(quantityLabel), "label ที่ครอบ product-quantity-select").toEqual(OWN_SMALL)
    await evidence("02-pdp-options-quantity")
  })

  await step("หน้า group buy /th/g/<token>", async () => {
    const team = await teamGroup(request, 3)
    await page.goto(`/${CC}/g/${team.token}`)
    await expectOptionButtons(page.getByTestId("group-options").locator("fieldset"))
    // SFUI-12c (spec 09 กฎ 28, AC-29): label ของ group-quantity เป็น FieldLabel เหนือช่อง (เดิม <label> ครอบ select) — ไม่เลื่อน ไม่ทับช่อง
    const quantityLabel = page.getByTestId("group-quantity-label")
    expect((await style(quantityLabel)).translate, "label ของ group-quantity ไม่เลื่อน").toBe("none")
    const labelBox = (await quantityLabel.boundingBox())!
    const selectBox = (await page.getByTestId("group-quantity").boundingBox())!
    expect(labelBox.y + labelBox.height, "label ของ group-quantity อยู่เหนือช่อง").toBeLessThanOrEqual(selectBox.y + 0.5)
  })
})
