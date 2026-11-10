import { describe, expect, it } from "vitest"

import {
  EVOUCHER_POOL_FIELDS,
  VOUCHERS_PAGE_SIZE,
  evoucherPoolOf,
  partnerBlockPool,
  safeHttpUrl,
  voucherVariantsOf,
  vouchersHasNext,
  vouchersPagination,
} from "./evoucher"

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

// EV-7e (spec 02 กฎข้อ 26, 29)
describe("safeHttpUrl (กฎข้อ 26)", () => {
  it("คืน URL เดิมเฉพาะ scheme http/https", () => {
    expect(safeHttpUrl("https://example.com/terms")).toBe("https://example.com/terms")
    expect(safeHttpUrl("http://example.com/logo.png")).toBe("http://example.com/logo.png")
  })

  it("scheme อื่น ค่าที่ parse ไม่ได้ หรือค่าว่าง → null", () => {
    for (const url of [
      "javascript:alert(1)",
      " JavaScript:alert(1)",
      "data:text/html,x",
      "vbscript:msgbox(1)",
      "//example.com/x",
      "/relative",
      "not a url",
      "",
      null,
      undefined,
    ]) {
      expect(safeHttpUrl(url), String(url)).toBeNull()
    }
  })
})

describe("vouchersPagination (กฎข้อ 29a)", () => {
  it("หน้าละ 20 รายการ และคำนวณ offset จาก ?page=", () => {
    expect(VOUCHERS_PAGE_SIZE).toBe(20)
    expect(vouchersPagination(undefined)).toEqual({ page: 1, offset: 0 })
    expect(vouchersPagination("2")).toEqual({ page: 2, offset: 20 })
  })

  it("?page= ที่ไม่ใช่จำนวนเต็มบวก → หน้า 1", () => {
    for (const p of ["0", "-1", "abc", "1.5", "", ["2", "3"]]) {
      expect(vouchersPagination(p as string), String(p)).toEqual({ page: 1, offset: 0 })
    }
  })

  it("มีหน้าก่อน/ถัดไปตาม count", () => {
    expect(vouchersHasNext({ page: 1, offset: 0 }, 25)).toBe(true)
    expect(vouchersHasNext({ page: 2, offset: 20 }, 25)).toBe(false)
    expect(vouchersHasNext({ page: 1, offset: 0 }, 20)).toBe(false)
  })
})

describe("partnerBlockPool (กฎข้อ 29c)", () => {
  const variants = [variant("a", pool("A"), 0), variant("b", pool("B")), variant("c", null)]

  it("ก่อน ProductActions เขียน v_id ลง URL → variant ที่ ProductActions จะเลือก (v_id ที่มีจริง ไม่งั้นตัวตั้งต้น)", () => {
    expect(partnerBlockPool(variants, null, false)?.partner.name).toBe("Partner B")
    expect(partnerBlockPool(variants, "a", false)?.partner.name).toBe("Partner A")
    expect(partnerBlockPool(variants, "zzz", false)?.partner.name).toBe("Partner B")
  })

  it("หลัง sync แล้ว → เฉพาะ variant ตาม v_id; ไม่ได้เลือก variant ใด (ไม่มี v_id) → null", () => {
    expect(partnerBlockPool(variants, "a", true)?.partner.name).toBe("Partner A")
    expect(partnerBlockPool(variants, null, true)).toBeNull()
    expect(partnerBlockPool(variants, "c", true)).toBeNull()
  })
})
