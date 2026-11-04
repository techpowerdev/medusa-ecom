import { describe, expect, it } from "vitest"

import { findVariantByOptions, optionsAsKeymap } from "./product-variant-options"

// GB-7a2 (กฎข้อ 31a): helper หา variant จาก option ที่ PDP และหน้ากลุ่มใช้ร่วมกัน
const variant = (id: string, size: string, color: string) => ({
  id,
  options: [
    { option_id: "opt_size", value: size },
    { option_id: "opt_color", value: color },
  ],
})

describe("optionsAsKeymap / findVariantByOptions", () => {
  const variants = [variant("v_s_red", "S", "Red"), variant("v_m_red", "M", "Red")]

  it("option ของ variant → map option_id → value", () => {
    expect(optionsAsKeymap(variants[0].options as never)).toEqual({ opt_size: "S", opt_color: "Red" })
    expect(optionsAsKeymap(null)).toBeUndefined()
  })

  it("เลือกครบทุก option → variant ที่ตรง; ไม่ครบ/ไม่มี → undefined", () => {
    expect(findVariantByOptions(variants as never, { opt_size: "M", opt_color: "Red" })?.id).toBe("v_m_red")
    expect(findVariantByOptions(variants as never, { opt_size: "M" })).toBeUndefined()
    expect(findVariantByOptions(variants as never, { opt_size: "L", opt_color: "Red" })).toBeUndefined()
    expect(findVariantByOptions(undefined, { opt_size: "S" })).toBeUndefined()
  })
})
