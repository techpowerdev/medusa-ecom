import { APIRequestContext, Page, Request, Response, expect } from "@playwright/test"

import { BACKEND_URL } from "./fixtures"
import { Customer } from "./medusa"

// CORE-43 (spec 01 กฎข้อ 101): รอผลจริงของ server action แทน timeout default ของ assertion ถัดไป
// trace ตอนเครื่องโหลดสูง: action (add-to-cart, login, setAddresses) ใช้ 4–5 วินาทีขึ้นไป — `toBeEnabled()`/`toHaveURL()` 5s ล้ม
// `page.waitForResponse` ไม่มี timeout ของ assertion (ใช้ timeout ของ test) จึงรอจนกว่า action ตอบจริง

type ActionRequest = Pick<Request, "method" | "headers" | "postData">

/** request ของ Next server action = POST ที่มี header `next-action`; `matches` เลือกจาก body (หน้าเดียวกันยิง action อื่นเองได้) */
export const isServerAction = (request: ActionRequest, matches: (body: string) => boolean = () => true) =>
  request.method() === "POST" &&
  request.headers()["next-action"] !== undefined &&
  matches(request.postData() ?? "")

/**
 * body ของ `addToCart({ variantId, quantity, countryCode })` — action ตอนโหลด PDP ส่ง variant id เป็น array
 * (`["reg_…",["variant_…"]]`) จึงเลือกจาก id อย่างเดียวไม่ได้
 */
export const isAddToCartBody = (body: string) => {
  try {
    const [arg] = JSON.parse(body)
    return typeof arg?.variantId === "string" && typeof arg?.quantity === "number"
  } catch {
    return false
  }
}

/** เริ่มรอ **ก่อน** กดปุ่ม แล้ว await หลังกด — คืน response ของ action ที่ body ตรงเงื่อนไข */
export const waitForServerAction = (page: Pick<Page, "waitForResponse">, matches?: (body: string) => boolean) =>
  page.waitForResponse((res: Response) => isServerAction(res.request(), matches))

type CartCheck = { request: APIRequestContext; pk: string; customer: Customer }

/** จำนวนสินค้ารวมใน cart ของ cookie `_medusa_cart_id` ตาม Store API (ยังไม่มี cookie = 0) */
async function cartQuantity(page: Page, { request, pk, customer }: CartCheck): Promise<number> {
  const cartId = (await page.context().cookies()).find((c) => c.name === "_medusa_cart_id")?.value
  if (!cartId) return 0
  const res = await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=id,*items`, {
    headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
  })
  if (!res.ok()) return 0
  const { cart } = await res.json()
  return (cart.items ?? []).reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0)
}

/**
 * CORE-43 (กฎข้อ 101a): กด `add-product-button` บน PDP ที่เปิดอยู่แล้วรอผลจริง — action ของ addToCart ตอบสำเร็จ
 * และจำนวนสินค้าใน cart (Store API ด้วย token ของลูกค้า) เพิ่มขึ้น `quantity` แทน `click()` + `toBeEnabled()`
 * (ปุ่มอาจยัง enabled ก่อน action เริ่ม หรือ disabled นานกว่า 5s ตอนเครื่องโหลดสูง)
 */
export async function addToCartFromPdp(page: Page, check: CartCheck & { quantity?: number }) {
  const { quantity = 1 } = check
  const before = await cartQuantity(page, check)
  const added = waitForServerAction(page, isAddToCartBody)
  await page.getByTestId("add-product-button").click()
  const res = await added
  expect(res.status(), "server action ของ addToCart").toBe(200)
  await expect
    .poll(() => cartQuantity(page, check), { message: "จำนวนสินค้าใน cart ตาม Store API" })
    .toBe(before + quantity)
}
