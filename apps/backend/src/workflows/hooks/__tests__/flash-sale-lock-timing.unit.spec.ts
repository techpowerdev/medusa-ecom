import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { FLASH_SALE_MODULE } from "../../../modules/flash_sale"
import { LOCK_TIMING_MARKER, reserveFlashSaleForCart } from "../flash-sale-reservation"

// OPS-18 (spec 07 AC-29): log ระดับ debug ของเวลารอ lock (a) และเวลาถือ lock (b) = เวลาภายใน locking.execute
// ด้วย logger เดิมของ Medusa (JSON logger ของ OPS-3) — log เฉพาะเมื่อ logger เปิดระดับ debug
describe("reserveFlashSaleForCart lock timing (OPS-18)", () => {
  const cart = {
    id: "cart_1",
    customer_id: "cus_1",
    items: [{ quantity: 1, adjustments: [{ promotion_id: "promo_1" }] }],
  }

  function setup({ debug = true, reserve = async () => [] as unknown[] } = {}) {
    let now = 1_000
    const clock = jest.spyOn(Date, "now").mockImplementation(() => now)
    const lines: string[] = []
    const logger = { shouldLog: (level: string) => debug && level === "debug", debug: (m: string) => lines.push(m) }
    const locking = {
      execute: async (_keys: string[], job: () => Promise<unknown>) => {
        now += 40 // รอ lock 40ms
        return job()
      },
    }
    const flashSale = {
      listFlashSaleConfigs: async () => [{ campaign_id: "camp_1" }],
      reserveForCart: async () => {
        now += 250 // ถือ lock 250ms
        return reserve()
      },
    }
    const query = { graph: async () => ({ data: [{ id: "promo_1", campaign_id: "camp_1" }] }) }
    const deps: Record<string, unknown> = {
      [ContainerRegistrationKeys.QUERY]: query,
      [ContainerRegistrationKeys.LOGGER]: logger,
      [Modules.LOCKING]: locking,
      [FLASH_SALE_MODULE]: flashSale,
    }
    const container = { resolve: (key: string) => deps[key] } as unknown as MedusaContainer
    return { container, lines, clock }
  }

  afterEach(() => jest.restoreAllMocks())

  const parse = (line: string) => {
    expect(line.startsWith(`${LOCK_TIMING_MARKER} `)).toBe(true)
    return JSON.parse(line.slice(LOCK_TIMING_MARKER.length + 1))
  }

  it("log หนึ่งบรรทัดต่อ checkout: wait_ms = ก่อนได้ lock, hold_ms = เวลาภายใน locking.execute, outcome ok", async () => {
    const { container, lines } = setup()
    await expect(reserveFlashSaleForCart(container, cart)).resolves.toEqual({ cart_id: "cart_1" })
    expect(lines).toHaveLength(1)
    expect(parse(lines[0])).toEqual({
      cart_id: "cart_1",
      requested_at: 1_000,
      acquired_at: 1_040,
      released_at: 1_290,
      wait_ms: 40,
      hold_ms: 250,
      outcome: "ok",
    })
  })

  it("sold out ใน lock → ยัง log (outcome = code ของ error) แล้วโยน error เดิมต่อ", async () => {
    const soldOut = new MedusaError(MedusaError.Types.CONFLICT, "This flash sale is sold out", "FLASH_SOLD_OUT")
    const { container, lines } = setup({
      reserve: async () => {
        throw soldOut
      },
    })
    await expect(reserveFlashSaleForCart(container, cart)).rejects.toBe(soldOut)
    expect(parse(lines[0])).toMatchObject({ wait_ms: 40, hold_ms: 250, outcome: "FLASH_SOLD_OUT" })
  })

  it("logger ไม่ได้เปิด debug (ค่าเริ่มต้นของ prod) → ไม่ log", async () => {
    const { container, lines } = setup({ debug: false })
    await reserveFlashSaleForCart(container, cart)
    expect(lines).toHaveLength(0)
  })
})
