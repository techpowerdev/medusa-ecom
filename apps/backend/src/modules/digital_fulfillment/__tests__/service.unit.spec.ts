import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils"
import DigitalFulfillmentProviderService, { DIGITAL_DELIVERY_OPTION_ID } from "../service"

// EV-3 (spec 02, ADR-006): provider `digital` ส่งมอบทันที ไม่มีพัสดุ/label — ตัว code ส่งทางอีเมลใน EV-4
describe("DigitalFulfillmentProviderService", () => {
  // เรียกผ่าน signature ของ AbstractFulfillmentProviderService แบบเดียวกับที่ Fulfillment module เรียก
  const service: AbstractFulfillmentProviderService = new DigitalFulfillmentProviderService()

  it("has identifier `digital` (provider id digital_digital when registered with id `digital`)", () => {
    expect(DigitalFulfillmentProviderService.identifier).toEqual("digital")
  })

  it("offers a single non-return option digital-delivery", async () => {
    expect(await service.getFulfillmentOptions()).toEqual([{ id: DIGITAL_DELIVERY_OPTION_ID }])
  })

  it("accepts option and fulfillment data as-is", async () => {
    expect(await service.validateOption({ id: DIGITAL_DELIVERY_OPTION_ID })).toBe(true)
    expect(await service.validateFulfillmentData({}, { foo: "bar" }, {} as any)).toEqual({ foo: "bar" })
  })

  it("uses flat price only (free option configured in seed)", async () => {
    expect(await service.canCalculate({} as any)).toBe(false)
    await expect(service.calculatePrice({}, {}, {} as any)).rejects.toThrow()
  })

  it("creates a fulfillment instantly without shipping labels", async () => {
    expect(await service.createFulfillment({}, [], {} as any, {} as any)).toEqual({
      data: { channel: "email" },
      labels: [],
    })
  })

  it("allows cancelling a fulfillment (workflow compensation)", async () => {
    expect(await service.cancelFulfillment({})).toEqual({})
  })

  it("rejects return fulfillments — delivered codes cannot be recalled (business rule 6)", async () => {
    await expect(service.createReturnFulfillment({})).rejects.toMatchObject({
      type: MedusaError.Types.NOT_ALLOWED,
    })
  })
})
