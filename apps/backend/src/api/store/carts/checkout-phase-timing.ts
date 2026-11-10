import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logCheckoutPhase } from "../../../lib/checkout-phase-timing"
import { setSamplerPool } from "../../../lib/saturation-sampler"

// OPS-20a (spec 07 AC-31): จุดเข้า middleware ของ POST /store/carts/:id/complete → `res` finish
// = ต้นของ (b) และท้ายของ (d) — ทำงานหลัง authenticate/ownership ที่ไม่ระบุ method (bucket global/wildcard ของ Medusa)
export function checkoutPhaseTiming(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  if (logger.shouldLog("debug")) {
    // OPS-20b (AC-32): instrumentation ไม่มี container → ส่ง pool ของ knex ให้ sampler (รอ pool ในช่วง checkout)
    setSamplerPool(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION))
    const cartId = String(req.params.id)
    const enteredAt = Date.now()
    res.on("finish", () =>
      logCheckoutPhase(logger, {
        phase: "route",
        cart_id: cartId,
        entered_at: enteredAt,
        finished_at: Date.now(),
        status: res.statusCode,
      })
    )
  }
  next()
}
