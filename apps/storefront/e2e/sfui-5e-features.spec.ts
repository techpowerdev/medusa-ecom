import { expect, test } from "./support/fixtures"
import { teamGroup } from "./support/group-buy"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"

// SFUI-5e (spec 09 กฎ 20–21, AC-15): หน้ากลุ่มใช้ token ของ shadcn แทนสี interactive ของ preset (ฟ้า) และปุ่มของ shadcn ตรง
// — สีที่เปลี่ยนจริงในขอบเขตนี้คือ text/bg-ui-fg-interactive → primary (= brand-900 #171717 ผ่าน --primary, ADR-030 ข้อ 7)
const PRIMARY = "rgb(23, 23, 23)"

test("หน้ากลุ่ม: ส่วนลด ลิงก์แชร์ และแถบความคืบหน้าใช้สี primary; ปุ่มเพิ่มในรายการเป็น outline ของ shadcn", async ({
  page,
  request,
}) => {
  const ctx = await teamGroup(request, 3)
  await page.goto(`/${CC}/g/${ctx.token}`)

  const color = (testId: string) => page.getByTestId(testId).evaluate((el) => getComputedStyle(el).color)
  expect(await color("group-discount")).toBe(PRIMARY)
  expect(await color("group-share-link")).toBe(PRIMARY)

  const fill = page.getByRole("progressbar").locator("div")
  expect(await fill.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(PRIMARY)

  const add = page.getByTestId("group-add-variant")
  await expect(add).toHaveAttribute("data-slot", "button")
  await expect(add).toHaveAttribute("data-variant", "outline")
  await expect(page.getByTestId("group-join-button")).toHaveAttribute("data-variant", "default")
})
