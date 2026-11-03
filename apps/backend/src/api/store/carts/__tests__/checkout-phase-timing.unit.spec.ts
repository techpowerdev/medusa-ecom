import { EventEmitter } from "events"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CHECKOUT_PHASE_MARKER } from "../../../../lib/checkout-phase-timing"
import { checkoutPhaseTiming } from "../checkout-phase-timing"

// OPS-20a (spec 07 AC-31): middleware ของ POST /store/carts/:id/complete log เวลาเข้า + เวลา `res` finish
// ระดับ debug ผูกด้วย cart_id — (b) เริ่มที่จุดเข้า, (d) จบที่ finish
describe("checkoutPhaseTiming middleware (OPS-20a)", () => {
  afterEach(() => jest.restoreAllMocks())

  function setup(debug = true) {
    let now = 5_000
    jest.spyOn(Date, "now").mockImplementation(() => now)
    const lines: string[] = []
    const logger = { shouldLog: (level: string) => debug && level === "debug", debug: (m: string) => lines.push(m) }
    const req = {
      params: { id: "cart_1" },
      scope: { resolve: (key: string) => (key === ContainerRegistrationKeys.LOGGER ? logger : undefined) },
    } as unknown as MedusaRequest
    const res = Object.assign(new EventEmitter(), { statusCode: 200 }) as unknown as MedusaResponse
    const next = jest.fn() as unknown as MedusaNextFunction
    return { req, res, next, lines, advance: (ms: number) => (now += ms) }
  }

  it("log หนึ่งบรรทัดตอน res finish: entered_at = ตอนเข้า middleware, finished_at = ตอน finish, status", () => {
    const { req, res, next, lines, advance } = setup()
    checkoutPhaseTiming(req, res, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(lines).toHaveLength(0)
    advance(1_234)
    ;(res as unknown as EventEmitter & { statusCode: number }).statusCode = 409
    ;(res as unknown as EventEmitter).emit("finish")
    expect(lines).toHaveLength(1)
    expect(lines[0].startsWith(`${CHECKOUT_PHASE_MARKER} `)).toBe(true)
    expect(JSON.parse(lines[0].slice(CHECKOUT_PHASE_MARKER.length + 1))).toEqual({
      phase: "route",
      cart_id: "cart_1",
      entered_at: 5_000,
      finished_at: 6_234,
      status: 409,
    })
  })

  it("logger ไม่ได้เปิด debug (ค่าเริ่มต้นของ prod) → ไม่ฟัง finish และไม่ log", () => {
    const { req, res, next, lines } = setup(false)
    checkoutPhaseTiming(req, res, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect((res as unknown as EventEmitter).listenerCount("finish")).toBe(0)
    expect(lines).toHaveLength(0)
  })
})
