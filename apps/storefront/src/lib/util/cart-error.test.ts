import { describe, expect, it } from "vitest"

import { REFUNDED_NOTICE } from "./checkout-error"
import { cartErrorNotice } from "./cart-error"

// PAY-12 (spec 06 กฎข้อ 14, AC-25): หน้า /<cc>/cart อ่าน ?error= แล้วแสดงข้อความไทยตามค่าใน allow-list เท่านั้น
const THAI = /[฀-๿]/

describe("cartErrorNotice", () => {
  it.each([
    ["refunded", REFUNDED_NOTICE],
    ["order_failed", "สร้างคำสั่งซื้อไม่สำเร็จ หากมีการตัดเงิน ระบบจะคืนเงินให้อัตโนมัติ กรุณาตรวจสอบตะกร้าแล้วสั่งใหม่"],
    ["payment_failed", "ชำระเงินไม่สำเร็จ กรุณาเลือกวิธีชำระเงินอีกครั้ง"],
  ])("%s → ข้อความไทยของค่านั้น", (value, text) => {
    expect(cartErrorNotice(value)).toBe(text)
    expect(cartErrorNotice(value)).toMatch(THAI)
  })

  it.each([undefined, "", "unknown", "<script>alert(1)</script>", "REFUNDED", "toString", "__proto__", ["refunded"]])(
    "%j → null (ไม่ render ค่าจาก URL)",
    (value) => {
      expect(cartErrorNotice(value)).toBeNull()
    }
  )
})
