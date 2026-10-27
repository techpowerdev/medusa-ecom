import { describe, expect, it } from "vitest"

import { EVOUCHER_POOL_FIELDS, evoucherPoolOf, voucherVariantsOf } from "./evoucher"

// EV-7b (spec 02 กฎข้อ 23, AC-36): บล็อกพาร์ทเนอร์บน PDP แสดงเฉพาะ variant ที่มี pool
const pool = (name: string) => ({
  name: `Pool ${name}`,
  face_value: 500,
  validity_note: null,
  how_to_use: "แสดง code ที่แคชเชียร์",
  partner: { name: `Partner ${name}`, logo_url: null, terms_url: null },
})

const variant = (id: string, p: ReturnType<typeof pool> | null, stock = 1) => ({
  id,
  manage_inventory: true,
  allow_backorder: false,
  inventory_quantity: stock,
  evoucher_pool: p,
})

describe("evoucherPoolOf", () => {
  it("คืน pool ของ variant ที่เลือกผ่าน v_id", () => {
    const product = { variants: [variant("a", pool("A")), variant("b", pool("B"))] }
    expect(evoucherPoolOf(product, "b")?.partner.name).toBe("Partner B")
  })

  it("variant ที่เลือกไม่มี pool → null แม้ variant อื่นมี", () => {
    const product = { variants: [variant("a", pool("A")), variant("b", null)] }
    expect(evoucherPoolOf(product, "b")).toBeNull()
  })

  it("ไม่มี v_id → ใช้ variant ตั้งต้นแบบเดียวกับ ProductActions (ตัวแรกที่มีของ)", () => {
    const product = { variants: [variant("a", pool("A"), 0), variant("b", pool("B"))] }
    expect(evoucherPoolOf(product, null)?.partner.name).toBe("Partner B")
  })

  it("v_id ที่ไม่มีในสินค้า → ใช้ variant ตั้งต้น", () => {
    const product = { variants: [variant("a", null)] }
    expect(evoucherPoolOf(product, "zzz")).toBeNull()
  })

  it("สินค้าปกติ (ไม่มี field evoucher_pool) → null", () => {
    expect(evoucherPoolOf({ variants: [{ id: "a" }] }, null)).toBeNull()
    expect(evoucherPoolOf({ variants: null }, null)).toBeNull()
  })

  it("ขอ field ของ pool/partner ทีละ path ตามกฎข้อ 23 เท่านั้น (ไม่ขอ code)", () => {
    const paths = EVOUCHER_POOL_FIELDS.split(",")
    expect(paths).toEqual([
      "+variants.evoucher_pool.name",
      "+variants.evoucher_pool.face_value",
      "+variants.evoucher_pool.validity_note",
      "+variants.evoucher_pool.how_to_use",
      "+variants.evoucher_pool.partner.name",
      "+variants.evoucher_pool.partner.logo_url",
      "+variants.evoucher_pool.partner.terms_url",
    ])
  })
})

describe("voucherVariantsOf", () => {
  it("สินค้าที่ไม่มี variant ใดมี pool → null (ไม่ render บล็อก)", () => {
    expect(voucherVariantsOf([{ id: "a" }, variant("b", null)])).toBeNull()
    expect(voucherVariantsOf(undefined)).toBeNull()
  })

  it("ส่งเฉพาะ field ที่บล็อกใช้ไปยัง client component", () => {
    const [picked] = voucherVariantsOf([{ ...variant("a", pool("A")), title: "500", sku: "X" }])!
    expect(Object.keys(picked).sort()).toEqual(
      ["allow_backorder", "evoucher_pool", "id", "inventory_quantity", "manage_inventory"].sort()
    )
  })
})
