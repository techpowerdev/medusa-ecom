import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { FLASH_SALE_MODULE } from ".."
import { FLASH_LIMIT_EXCEEDED, FLASH_SOLD_OUT } from "../errors"
import FlashSaleConfig from "../models/flash-sale-config"
import FlashSaleReservation from "../models/flash-sale-reservation"
import FlashSaleUsage from "../models/flash-sale-usage"
import FlashSaleModuleService from "../service"

jest.setTimeout(60 * 1000)

// FS-3 (spec 03 "Workflows / hooks" ข้อ 3 + Compensation): จอง usage + units_sold + reservation ใน transaction เดียว
moduleIntegrationTestRunner<FlashSaleModuleService>({
  moduleName: FLASH_SALE_MODULE,
  moduleModels: [FlashSaleConfig, FlashSaleUsage, FlashSaleReservation],
  resolve: "./src/modules/flash_sale",
  testSuite: ({ service }) => {
    const unitsSold = async (campaign_id: string) =>
      (await service.listFlashSaleConfigs({ campaign_id }))[0].units_sold

    const usageOf = async (campaign_id: string, customer_id: string) =>
      (await service.listFlashSaleUsages({ campaign_id, customer_id }))[0]?.units ?? 0

    const reservationsOf = (cart_id: string) => service.listFlashSaleReservations({ cart_id })

    const rejectionCode = (promise: Promise<unknown>) =>
      promise.then(
        () => "resolved",
        (e: { code?: string }) => e.code
      )

    describe("reserveForCart", () => {
      it("reserves usage, units_sold and a reservation row", async () => {
        await service.createFlashSaleConfigs({ campaign_id: "camp_1", per_customer_limit: 2, total_cap: 10 })

        const reserved = await service.reserveForCart({
          cart_id: "cart_1",
          customer_id: "cus_1",
          campaigns: [{ campaign_id: "camp_1", units: 2 }],
        })

        expect(reserved).toEqual([{ campaign_id: "camp_1", units: 2 }])
        expect(await unitsSold("camp_1")).toEqual(2)
        expect(await usageOf("camp_1", "cus_1")).toEqual(2)
        expect(await reservationsOf("cart_1")).toEqual([
          expect.objectContaining({
            id: expect.stringMatching(/^fsres_/),
            cart_id: "cart_1",
            campaign_id: "camp_1",
            customer_id: "cus_1",
            units: 2,
            released_at: null,
          }),
        ])
      })

      it("accumulates usage of the same customer across carts", async () => {
        await service.createFlashSaleConfigs({ campaign_id: "camp_1", per_customer_limit: 3 })

        await service.reserveForCart({
          cart_id: "cart_1",
          customer_id: "cus_1",
          campaigns: [{ campaign_id: "camp_1", units: 1 }],
        })
        await service.reserveForCart({
          cart_id: "cart_2",
          customer_id: "cus_1",
          campaigns: [{ campaign_id: "camp_1", units: 2 }],
        })

        expect(await usageOf("camp_1", "cus_1")).toEqual(3)
        expect(await unitsSold("camp_1")).toEqual(3)
      })

      it("counts units_sold even when total_cap and per_customer_limit are null", async () => {
        await service.createFlashSaleConfigs({ campaign_id: "camp_1" })

        await service.reserveForCart({
          cart_id: "cart_1",
          customer_id: "cus_1",
          campaigns: [{ campaign_id: "camp_1", units: 5 }],
        })

        expect(await unitsSold("camp_1")).toEqual(5)
        expect(await usageOf("camp_1", "cus_1")).toEqual(5)
      })

      it("ignores campaigns without a flash sale config", async () => {
        const reserved = await service.reserveForCart({
          cart_id: "cart_1",
          customer_id: "cus_1",
          campaigns: [{ campaign_id: "camp_plain", units: 5 }],
        })

        expect(reserved).toEqual([])
        expect(await reservationsOf("cart_1")).toEqual([])
        expect(await service.listFlashSaleUsages({})).toEqual([])
      })

      it("fails FLASH_LIMIT_EXCEEDED when usage + units > per_customer_limit, changing nothing", async () => {
        await service.createFlashSaleConfigs({ campaign_id: "camp_1", per_customer_limit: 2 })
        await service.reserveForCart({
          cart_id: "cart_1",
          customer_id: "cus_1",
          campaigns: [{ campaign_id: "camp_1", units: 2 }],
        })

        const code = await rejectionCode(
          service.reserveForCart({
            cart_id: "cart_2",
            customer_id: "cus_1",
            campaigns: [{ campaign_id: "camp_1", units: 1 }],
          })
        )

        expect(code).toEqual(FLASH_LIMIT_EXCEEDED)
        expect(await usageOf("camp_1", "cus_1")).toEqual(2)
        expect(await unitsSold("camp_1")).toEqual(2)
        expect(await reservationsOf("cart_2")).toEqual([])
      })

      it("fails FLASH_LIMIT_EXCEEDED for a new customer whose cart alone exceeds the limit", async () => {
        await service.createFlashSaleConfigs({ campaign_id: "camp_1", per_customer_limit: 2 })

        const code = await rejectionCode(
          service.reserveForCart({
            cart_id: "cart_1",
            customer_id: "cus_1",
            campaigns: [{ campaign_id: "camp_1", units: 3 }],
          })
        )

        expect(code).toEqual(FLASH_LIMIT_EXCEEDED)
        expect(await usageOf("camp_1", "cus_1")).toEqual(0)
        expect(await unitsSold("camp_1")).toEqual(0)
      })

      it("fails FLASH_SOLD_OUT when units_sold + units > total_cap and rolls back the usage", async () => {
        await service.createFlashSaleConfigs({ campaign_id: "camp_1", total_cap: 3 })
        await service.reserveForCart({
          cart_id: "cart_1",
          customer_id: "cus_1",
          campaigns: [{ campaign_id: "camp_1", units: 2 }],
        })

        const code = await rejectionCode(
          service.reserveForCart({
            cart_id: "cart_2",
            customer_id: "cus_2",
            campaigns: [{ campaign_id: "camp_1", units: 2 }],
          })
        )

        expect(code).toEqual(FLASH_SOLD_OUT)
        expect(await unitsSold("camp_1")).toEqual(2)
        expect(await usageOf("camp_1", "cus_2")).toEqual(0)
        expect(await reservationsOf("cart_2")).toEqual([])
      })

      it("fails FLASH_SOLD_OUT when total_cap was lowered below units_sold (rule 12)", async () => {
        await service.createFlashSaleConfigs({ campaign_id: "camp_1", total_cap: 5, units_sold: 10 })

        const code = await rejectionCode(
          service.reserveForCart({
            cart_id: "cart_1",
            customer_id: "cus_1",
            campaigns: [{ campaign_id: "camp_1", units: 1 }],
          })
        )

        expect(code).toEqual(FLASH_SOLD_OUT)
        expect(await unitsSold("camp_1")).toEqual(10)
      })

      it("rolls back every campaign when a later campaign fails", async () => {
        await service.createFlashSaleConfigs([
          { campaign_id: "camp_a", total_cap: 10 },
          { campaign_id: "camp_b", total_cap: 1 },
        ])

        const code = await rejectionCode(
          service.reserveForCart({
            cart_id: "cart_1",
            customer_id: "cus_1",
            campaigns: [
              { campaign_id: "camp_a", units: 2 },
              { campaign_id: "camp_b", units: 2 },
            ],
          })
        )

        expect(code).toEqual(FLASH_SOLD_OUT)
        expect(await unitsSold("camp_a")).toEqual(0)
        expect(await usageOf("camp_a", "cus_1")).toEqual(0)
        expect(await reservationsOf("cart_1")).toEqual([])
      })

      it("sells exactly total_cap units under concurrent reservations", async () => {
        await service.createFlashSaleConfigs({ campaign_id: "camp_1", total_cap: 10 })

        const results = await Promise.all(
          Array.from({ length: 30 }, (_, i) =>
            rejectionCode(
              service.reserveForCart({
                cart_id: `cart_${i}`,
                customer_id: `cus_${i}`,
                campaigns: [{ campaign_id: "camp_1", units: 1 }],
              })
            )
          )
        )

        expect(results.filter((r) => r === "resolved")).toHaveLength(10)
        expect(results.filter((r) => r === FLASH_SOLD_OUT)).toHaveLength(20)
        expect(await unitsSold("camp_1")).toEqual(10)
        expect(await service.listFlashSaleReservations({ campaign_id: "camp_1" })).toHaveLength(10)
      })
    })

    describe("releaseCartReservations (compensation)", () => {
      it("returns usage + units_sold and deletes the reservations of the cart; idempotent", async () => {
        await service.createFlashSaleConfigs([
          { campaign_id: "camp_a", per_customer_limit: 5 },
          { campaign_id: "camp_b" },
        ])
        await service.reserveForCart({
          cart_id: "cart_0",
          customer_id: "cus_1",
          campaigns: [{ campaign_id: "camp_a", units: 1 }],
        })
        await service.reserveForCart({
          cart_id: "cart_1",
          customer_id: "cus_1",
          campaigns: [
            { campaign_id: "camp_a", units: 2 },
            { campaign_id: "camp_b", units: 3 },
          ],
        })

        await service.releaseCartReservations("cart_1")
        await service.releaseCartReservations("cart_1")

        expect(await reservationsOf("cart_1")).toEqual([])
        expect(await usageOf("camp_a", "cus_1")).toEqual(1)
        expect(await unitsSold("camp_a")).toEqual(1)
        expect(await usageOf("camp_b", "cus_1")).toEqual(0)
        expect(await unitsSold("camp_b")).toEqual(0)
        expect(await reservationsOf("cart_0")).toHaveLength(1)
      })

      it("does not return units of a reservation that was already released", async () => {
        await service.createFlashSaleConfigs({ campaign_id: "camp_a" })
        await service.reserveForCart({
          cart_id: "cart_1",
          customer_id: "cus_1",
          campaigns: [{ campaign_id: "camp_a", units: 2 }],
        })
        const [reservation] = await reservationsOf("cart_1")
        await service.updateFlashSaleReservations({ id: reservation.id, released_at: new Date() })

        await service.releaseCartReservations("cart_1")

        expect(await reservationsOf("cart_1")).toEqual([])
        expect(await unitsSold("camp_a")).toEqual(2)
        expect(await usageOf("camp_a", "cus_1")).toEqual(2)
      })

      it("does nothing for a cart without reservations", async () => {
        await expect(service.releaseCartReservations("cart_none")).resolves.not.toThrow()
      })
    })

    describe("FlashSaleReservation", () => {
      it("allows only one reservation per (cart_id, campaign_id)", async () => {
        await service.createFlashSaleReservations({
          cart_id: "cart_1",
          campaign_id: "camp_1",
          customer_id: "cus_1",
          units: 1,
        })

        await expect(
          service.createFlashSaleReservations({
            cart_id: "cart_1",
            campaign_id: "camp_1",
            customer_id: "cus_1",
            units: 1,
          })
        ).rejects.toThrow()
      })
    })
  },
})
