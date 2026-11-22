import { Page, Response, expect, test } from "@playwright/test"

import {
  isAddToCartBody,
  isCartIdActionBody,
  isServerAction,
  isLoginFormBody,
  isUpdateCustomerBody,
  waitForServerAction,
} from "./server-action"

// CORE-43 (spec 01 กฎข้อ 101a, AC-137): เลือก response ของ server action ให้ถูกตัว
// หน้า PDP ยิง action อื่นเองระหว่างโหลด/หลังคลิก (เช่น ราคาตาม variant ที่ส่ง array ของ variant id) — ต้องไม่ถูกนับเป็นการเพิ่มลงตะกร้า

const fakeResponse = (method: string, headers: Record<string, string>, body: string | null, status = 200) =>
  ({
    status: () => status,
    request: () => ({ method: () => method, headers: () => headers, postData: () => body }),
  }) as unknown as Response

const ACTION = { "next-action": "40459f38" }
const PDP_PRICES = fakeResponse("POST", { "next-action": "60aed914" }, '["reg_1",["variant_A","variant_B"]]')
const AUTH_REASON = fakeResponse("POST", { "next-action": "7099c07e" }, '["$undefined","$undefined",{"fresh":true}]')
const ADD = fakeResponse("POST", ACTION, '[{"variantId":"variant_A","quantity":1,"countryCode":"th"}]')
const LOGIN = fakeResponse("POST", ACTION, '------x\r\nContent-Disposition: form-data; name="email"\r\n\r\na@example.com\r\n')

/** page ปลอม: `waitForResponse` คืน response แรกที่ predicate ยอมรับตามลำดับที่เกิด */
const fakePage = (responses: Response[]) =>
  ({
    waitForResponse: async (predicate: (r: Response) => boolean) => {
      const found = responses.find(predicate)
      if (!found) throw new Error("ไม่มี response ที่ตรงเงื่อนไข")
      return found
    },
  }) as unknown as Page

test("isServerAction: ต้องเป็น POST ที่มี header next-action", () => {
  expect(isServerAction(ADD.request())).toBe(true)
  expect(isServerAction(fakeResponse("GET", ACTION, null).request())).toBe(false)
  expect(isServerAction(fakeResponse("POST", {}, "{}").request())).toBe(false)
})

test("isAddToCartBody: รับเฉพาะ argument { variantId, quantity } ของ addToCart", () => {
  expect(isAddToCartBody('[{"variantId":"variant_A","quantity":2,"countryCode":"th"}]')).toBe(true)
  expect(isAddToCartBody('["reg_1",["variant_A","variant_B"]]')).toBe(false)
  expect(isAddToCartBody('["$undefined","$undefined",{"fresh":true}]')).toBe(false)
  expect(isAddToCartBody("------x\r\nContent-Disposition: form-data")).toBe(false)
  expect(isAddToCartBody("")).toBe(false)
})

test("waitForServerAction(isAddToCartBody): ข้าม action อื่นของ PDP ที่เกิดก่อน แล้วได้ response ของการเพิ่มลงตะกร้า", async () => {
  const res = await waitForServerAction(fakePage([PDP_PRICES, AUTH_REASON, ADD]), isAddToCartBody)
  expect(res).toBe(ADD)
})

test("waitForServerAction(body มีอีเมล): ได้ action ของฟอร์มที่ส่งอีเมลนั้น ไม่ใช่ action ตอนโหลดหน้า", async () => {
  const res = await waitForServerAction(fakePage([AUTH_REASON, LOGIN]), (body) => body.includes("a@example.com"))
  expect(res).toBe(LOGIN)
})

// EV-7d: placeOrder ส่ง country เพิ่มเป็น argument ที่ 3 — matcher ของ e2e PromptPay ต้องยังแยกจาก action อื่นของ cart เดียวกัน
test.describe("isCartIdActionBody", () => {
  const CART = "cart_1"

  for (const [name, body] of [
    ["getPromptPayState(cartId)", '["cart_1"]'],
    ["placeOrder(cartId, undefined, cc)", '["cart_1","$undefined","th"]'],
  ]) {
    test(`นับ ${name}`, () => {
      expect(isCartIdActionBody(body, CART)).toBe(true)
    })
  }

  for (const [name, body] of [
    ["syncCartAffiliate(cartId, null)", '["cart_1",null]'],
    ["syncCartAffiliate(cartId, metadata)", '["cart_1",{"aff":"x"}]'],
    ["renewPromptPaySession(cart, provider)", '[{"id":"cart_1"},"pp_promptpay_stripe"]'],
    ["cart อื่น", '["cart_2"]'],
    ["body แบบ form-data", '------x\r\nContent-Disposition: form-data; name="email"\r\n'],
  ]) {
    test(`ไม่นับ ${name}`, () => {
      expect(isCartIdActionBody(body, CART)).toBe(false)
    })
  }
})

// hotfix CORE-22 (AC-84): หน้า profile ยิง `retrieveCart(undefined, undefined, { fresh: true })` ของ nav เองหลัง hydrate
// — นับเฉพาะ `updateCustomer(body)` ของ editor ชื่อ/เบอร์โทร
test.describe("isUpdateCustomerBody", () => {
  for (const [name, body] of [
    ["updateCustomer({ phone })", '[{"phone":"0812345678"}]'],
    ["updateCustomer({ phone: null })", '[{"phone":null}]'],
    ["updateCustomer({ first_name, last_name })", '[{"first_name":"ก","last_name":"ข"}]'],
  ]) {
    test(`นับ ${name}`, () => {
      expect(isUpdateCustomerBody(body)).toBe(true)
    })
  }

  for (const [name, body] of [
    ["retrieveCart(undefined, undefined, { fresh: true }) ของ nav", '["$undefined","$undefined",{"fresh":true}]'],
    ["addToCart({ variantId, quantity })", '[{"variantId":"variant_A","quantity":1,"countryCode":"th"}]'],
    ["getPromptPayState(cartId)", '["cart_1"]'],
    ["body แบบ form-data", '------x\r\nContent-Disposition: form-data; name="email"\r\n'],
    ["body ว่าง", ""],
  ]) {
    test(`ไม่นับ ${name}`, () => {
      expect(isUpdateCustomerBody(body)).toBe(false)
    })
  }
})

// hotfix CORE-4h (AC-105): หน้า login อยู่ใน (main) มี nav → retrieveCart ของ nav ยิงหลัง hydrate ปนกับ action ของฟอร์ม login
// body จริงของ `<form action={formAction}>` (useActionState) เป็น multipart ที่ชื่อ field มี prefix `_<n>_`
test.describe("isLoginFormBody", () => {
  const EMAIL = "e2e-core6-1@example.com"
  const field = (name: string, value: string) =>
    `------x\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
  const LOGIN_FORM =
    field("_1_$ACTION_REF_1", "") + field("_1_email", EMAIL) + field("_1_password", "pw-wrong") + field("0", '[null,"$K1"]')

  test("นับ submit ของฟอร์ม login ด้วยอีเมลนั้น", () => {
    expect(isLoginFormBody(LOGIN_FORM, EMAIL)).toBe(true)
  })

  for (const [name, body] of [
    ["retrieveCart(undefined, undefined, { fresh: true }) ของ nav", '["$undefined","$undefined",{"fresh":true}]'],
    ["ฟอร์มของอีเมลอื่น", LOGIN_FORM.replace(EMAIL, "other@example.com")],
    ["อีเมลที่เป็น prefix ของอีกอีเมล", LOGIN_FORM.replace(EMAIL, `${EMAIL}.th`)],
    ["ไม่มี field password", field("_1_email", EMAIL)],
    ["body ว่าง", ""],
  ]) {
    test(`ไม่นับ ${name}`, () => {
      expect(isLoginFormBody(body, EMAIL)).toBe(false)
    })
  }
})
