import { MedusaError } from "@medusajs/framework/utils"
import { GB_SHIPPING_PROFILE_NOT_COVERED } from "../errors"
import { assertShippingProfilesCovered, type ShippingCart } from "../utils/shipping-profile"

const line = (profileId: string | undefined, requires_shipping = true) => ({
  requires_shipping,
  variant: { product: { shipping_profile: profileId ? { id: profileId } : null } },
})
const methods = (...optionIds: string[]) => optionIds.map((shipping_option_id) => ({ shipping_option_id }))
const OPTIONS = [
  { id: "so_std", shipping_profile_id: "sp_phys" },
  { id: "so_dig", shipping_profile_id: "sp_dig" },
]

const run = (cart: ShippingCart) => () => assertShippingProfilesCovered(cart, OPTIONS)

// spec 04 กฎข้อ 35 (GB-14, AC-54): กฎเทียบ profile เดียวกับ validateShippingStep ของ Medusa ยกเว้น cart ที่ไม่มี shipping method (35c)
describe("assertShippingProfilesCovered", () => {
  it("ผ่านเมื่อ shipping method ครอบ profile ของทุก line ที่ต้องจัดส่ง", () => {
    expect(run({ items: [line("sp_phys")], shipping_methods: methods("so_std") })).not.toThrow()
    expect(
      run({ items: [line("sp_phys"), line("sp_dig")], shipping_methods: methods("so_std", "so_dig") })
    ).not.toThrow()
  })

  it("ไม่ครอบ → NOT_ALLOWED code GB_SHIPPING_PROFILE_NOT_COVERED ข้อความขึ้นต้นด้วยชื่อ code", () => {
    let error: unknown
    try {
      run({ items: [line("sp_phys")], shipping_methods: methods("so_dig") })()
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(MedusaError)
    expect(error).toEqual(
      expect.objectContaining({ type: MedusaError.Types.NOT_ALLOWED, code: GB_SHIPPING_PROFILE_NOT_COVERED })
    )
    expect((error as MedusaError).message.startsWith(`${GB_SHIPPING_PROFILE_NOT_COVERED}:`)).toBe(true)
  })

  it("ครอบแค่บาง line → ล้ม", () => {
    expect(run({ items: [line("sp_phys"), line("sp_dig")], shipping_methods: methods("so_std") })).toThrow(
      GB_SHIPPING_PROFILE_NOT_COVERED
    )
  })

  it("line ที่สินค้าไม่มี shipping profile + มี method → ล้ม (แม้ option ไม่รู้ profile)", () => {
    expect(run({ items: [line(undefined)], shipping_methods: methods("so_std") })).toThrow(
      GB_SHIPPING_PROFILE_NOT_COVERED
    )
    expect(run({ items: [line(undefined)], shipping_methods: methods("so_unknown") })).toThrow(
      GB_SHIPPING_PROFILE_NOT_COVERED
    )
  })

  it("ไม่มี shipping method เลย → ไม่ตรวจ (กฎข้อ 35c)", () => {
    expect(run({ items: [line("sp_phys")], shipping_methods: [] })).not.toThrow()
    expect(run({ items: [line("sp_phys")] })).not.toThrow()
  })

  it("ทุก line ไม่ต้องจัดส่ง → ผ่านไม่ว่าวิธีส่งใด", () => {
    expect(run({ items: [line("sp_phys", false)], shipping_methods: methods("so_dig") })).not.toThrow()
    expect(run({ items: [line(undefined, false)], shipping_methods: methods("so_dig") })).not.toThrow()
  })
})
