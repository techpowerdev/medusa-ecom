import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { assignStoreReturnLocation, RETURN_ITEM_NOT_STOCKED_MESSAGE } from "../return-location"
import { storeOwnershipMiddlewares } from "../middlewares"
import { validateStoreReturnWindow } from "../return-window"

// CORE-55 (spec 01 กฎข้อ 113, ADR-022): location ของ return จากหน้าเว็บมาจาก return option ฝั่ง server
type Rows = { shipping_option?: unknown[]; order?: unknown[] }

const setup = (rows: Rows, validatedBody: Record<string, unknown> | undefined, body: Record<string, unknown> = {}) => {
  const calls: { entity: string; fields: string[]; filters: unknown }[] = []
  const warn = jest.fn()
  const query = {
    graph: jest.fn(async (args: { entity: keyof Rows; fields: string[]; filters: unknown }) => {
      calls.push(args)
      return { data: rows[args.entity] ?? [] }
    }),
  }
  const req = {
    body,
    validatedBody,
    scope: { resolve: (key: string) => (key === "logger" ? { warn } : query) },
  } as unknown as MedusaRequest
  const next = jest.fn() as unknown as MedusaNextFunction
  const run = () => assignStoreReturnLocation(req, {} as MedusaResponse, next)
  return { req, next, run, calls, warn }
}

const option = (locationId: string | null) => ({
  id: "so_return",
  service_zone: { fulfillment_set: { location: locationId ? { id: locationId } : null } },
})
const line = (id: string, manage_inventory: boolean, locations: string[]) => ({
  id,
  variant: {
    manage_inventory,
    inventory_items: [{ inventory: { location_levels: locations.map((location_id) => ({ location_id })) } }],
  },
})
const validated = (items: string[] = ["ordli_1"]) => ({
  order_id: "order_1",
  items: items.map((id) => ({ id, quantity: 1 })),
  return_shipping: { option_id: "so_return" },
})

describe("assignStoreReturnLocation", () => {
  it("sets validatedBody.location_id from the return option's stock location (Query) and calls next()", async () => {
    const t = setup(
      { shipping_option: [option("sloc_return")], order: [{ id: "order_1", items: [line("ordli_1", true, ["sloc_return"])] }] },
      validated()
    )
    await t.run()
    expect((t.req.validatedBody as { location_id?: string }).location_id).toBe("sloc_return")
    expect(t.next).toHaveBeenCalledWith()
    expect(t.calls[0]).toEqual(
      expect.objectContaining({
        entity: "shipping_option",
        fields: expect.arrayContaining(["service_zone.fulfillment_set.location.id"]),
        filters: { id: "so_return" },
      })
    )
  })

  it("never reads req.body.location_id (the core route passes validatedBody to the workflow)", async () => {
    const body = new Proxy({} as Record<string, unknown>, {
      get: (_t, key) => {
        if (key === "location_id") {
          throw new Error("read req.body.location_id")
        }
        return undefined
      },
    })
    const t = setup(
      { shipping_option: [option("sloc_return")], order: [{ id: "order_1", items: [line("ordli_1", true, ["sloc_return"])] }] },
      validated(),
      body
    )
    await t.run()
    expect((t.req.validatedBody as { location_id?: string }).location_id).toBe("sloc_return")
  })

  it("overwrites a location_id already on validatedBody with the option's location", async () => {
    const t = setup(
      { shipping_option: [option("sloc_return")], order: [{ id: "order_1", items: [line("ordli_1", false, [])] }] },
      { ...validated(), location_id: "sloc_other" }
    )
    await t.run()
    expect((t.req.validatedBody as { location_id?: string }).location_id).toBe("sloc_return")
  })

  it("rejects 400 invalid_data with a constant message when the option has no stock location (113b)", async () => {
    for (const rows of [{ shipping_option: [option(null)] }, { shipping_option: [] }]) {
      const t = setup(rows, validated())
      await expect(t.run()).rejects.toEqual(
        new MedusaError(MedusaError.Types.INVALID_DATA, "Return shipping option has no stock location")
      )
      expect(t.next).not.toHaveBeenCalled()
      expect((t.req.validatedBody as { location_id?: string }).location_id).toBeUndefined()
    }
  })

  it("rejects 400 when any managed line in the body has no level at the location, and logs order/location (113c)", async () => {
    const t = setup(
      {
        shipping_option: [option("sloc_return")],
        order: [
          {
            id: "order_1",
            items: [line("ordli_1", true, ["sloc_return"]), line("ordli_2", true, ["sloc_other"])],
          },
        ],
      },
      validated(["ordli_1", "ordli_2"])
    )
    await expect(t.run()).rejects.toEqual(new MedusaError(MedusaError.Types.INVALID_DATA, RETURN_ITEM_NOT_STOCKED_MESSAGE))
    expect(RETURN_ITEM_NOT_STOCKED_MESSAGE).toBe("This item cannot be returned online")
    expect(t.next).not.toHaveBeenCalled()
    expect(t.warn).toHaveBeenCalledWith(expect.stringContaining("order_1"))
    expect(t.warn).toHaveBeenCalledWith(expect.stringContaining("sloc_return"))
  })

  it("ignores lines of the order that are not in the body, and unmanaged lines", async () => {
    const t = setup(
      {
        shipping_option: [option("sloc_return")],
        order: [
          {
            id: "order_1",
            items: [line("ordli_1", false, []), line("ordli_2", true, ["sloc_other"])],
          },
        ],
      },
      validated(["ordli_1"])
    )
    await t.run()
    expect(t.next).toHaveBeenCalledWith()
    expect(t.calls[1]).toEqual(expect.objectContaining({ entity: "order", filters: { id: "order_1" } }))
  })

  it("fails loudly (not silently null) when core did not validate the body first", async () => {
    const t = setup({ shipping_option: [option("sloc_return")] }, undefined)
    await expect(t.run()).rejects.toThrow(MedusaError)
    expect(t.next).not.toHaveBeenCalled()
  })
})

describe("POST /store/returns middleware order (CORE-55)", () => {
  it("ends with validateStoreReturnWindow → assignStoreReturnLocation", () => {
    const chain = storeOwnershipMiddlewares.find((m) => m.matcher === "/store/returns")!.middlewares!
    expect(chain.slice(-2)).toEqual([validateStoreReturnWindow, assignStoreReturnLocation])
  })
})
