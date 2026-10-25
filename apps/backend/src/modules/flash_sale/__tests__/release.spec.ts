import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { FLASH_SALE_MODULE } from ".."
import FlashSaleConfig from "../models/flash-sale-config"
import FlashSaleReservation from "../models/flash-sale-reservation"
import FlashSaleUsage from "../models/flash-sale-usage"
import FlashSaleModuleService from "../service"

jest.setTimeout(60 * 1000)

// FS-2 (spec 03 "FS-2 คืนค่า", กฎข้อ 10): ตั้ง released_at แล้วคืน usage + units_sold ใน transaction เดียว — idempotent
moduleIntegrationTestRunner<FlashSaleModuleService>({
  moduleName: FLASH_SALE_MODULE,
  moduleModels: [FlashSaleConfig, FlashSaleUsage, FlashSaleReservation],
  resolve: "./src/modules/flash_sale",
  testSuite: ({ service }) => {
    const unitsSold = async (campaign_id: string) =>
      (await service.listFlashSaleConfigs({ campaign_id }))[0].units_sold

    const usageOf = async (campaign_id: string, customer_id: string) =>
      (await service.listFlashSaleUsages({ campaign_id, customer_id }))[0]?.units ?? 0

    const reserve = (cart_id: string, customer_id: string, campaigns: { campaign_id: string; units: number }[]) =>
      service.reserveForCart({ cart_id, customer_id, campaigns })

    describe("releaseReservationsOfCart", () => {
      beforeEach(async () => {
        await service.createFlashSaleConfigs([
          { campaign_id: "camp_a", per_customer_limit: 5 },
          { campaign_id: "camp_b" },
        ])
        await reserve("cart_0", "cus_1", [{ campaign_id: "camp_a", units: 1 }])
        await reserve("cart_1", "cus_1", [
          { campaign_id: "camp_a", units: 2 },
          { campaign_id: "camp_b", units: 3 },
        ])
      })

      it("sets released_at and returns usage + units_sold of the cart's reservations", async () => {
        const released = await service.releaseReservationsOfCart("cart_1")

        expect(released).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ campaign_id: "camp_a", customer_id: "cus_1", units: 2 }),
            expect.objectContaining({ campaign_id: "camp_b", customer_id: "cus_1", units: 3 }),
          ])
        )
        expect(released).toHaveLength(2)
        expect(await usageOf("camp_a", "cus_1")).toEqual(1)
        expect(await unitsSold("camp_a")).toEqual(1)
        expect(await usageOf("camp_b", "cus_1")).toEqual(0)
        expect(await unitsSold("camp_b")).toEqual(0)

        const reservations = await service.listFlashSaleReservations({ cart_id: "cart_1" })
        expect(reservations).toHaveLength(2)
        reservations.forEach((r) => expect(r.released_at).toBeInstanceOf(Date))
        const [untouched] = await service.listFlashSaleReservations({ cart_id: "cart_0" })
        expect(untouched.released_at).toBeNull()
      })

      it("releases only once when called again (sequential)", async () => {
        await service.releaseReservationsOfCart("cart_1")
        const second = await service.releaseReservationsOfCart("cart_1")

        expect(second).toEqual([])
        expect(await usageOf("camp_a", "cus_1")).toEqual(1)
        expect(await unitsSold("camp_a")).toEqual(1)
        expect(await unitsSold("camp_b")).toEqual(0)
      })

      it("releases only once under concurrent calls", async () => {
        const results = await Promise.all(
          Array.from({ length: 5 }, () => service.releaseReservationsOfCart("cart_1"))
        )

        expect(results.flat()).toHaveLength(2)
        expect(await usageOf("camp_a", "cus_1")).toEqual(1)
        expect(await unitsSold("camp_a")).toEqual(1)
        expect(await usageOf("camp_b", "cus_1")).toEqual(0)
        expect(await unitsSold("camp_b")).toEqual(0)
      })

      it("does nothing for a cart without reservations", async () => {
        expect(await service.releaseReservationsOfCart("cart_none")).toEqual([])
        expect(await unitsSold("camp_a")).toEqual(3)
      })

      it("FS-3 compensation does not return units of a released reservation again", async () => {
        await service.releaseReservationsOfCart("cart_1")
        await service.releaseCartReservations("cart_1")

        expect(await usageOf("camp_a", "cus_1")).toEqual(1)
        expect(await unitsSold("camp_a")).toEqual(1)
      })
    })

    describe("restoreReleasedReservations (compensation)", () => {
      it("clears released_at and books usage + units_sold again; idempotent", async () => {
        await service.createFlashSaleConfigs({ campaign_id: "camp_a" })
        await reserve("cart_1", "cus_1", [{ campaign_id: "camp_a", units: 2 }])
        const released = await service.releaseReservationsOfCart("cart_1")

        await service.restoreReleasedReservations(released.map((r) => r.id))
        await service.restoreReleasedReservations(released.map((r) => r.id))

        expect(await usageOf("camp_a", "cus_1")).toEqual(2)
        expect(await unitsSold("camp_a")).toEqual(2)
        const [reservation] = await service.listFlashSaleReservations({ cart_id: "cart_1" })
        expect(reservation.released_at).toBeNull()
      })

      it("does nothing for an empty list", async () => {
        await expect(service.restoreReleasedReservations([])).resolves.not.toThrow()
      })
    })
  },
})
