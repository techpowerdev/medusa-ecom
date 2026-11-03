import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { CHECKOUT_PHASE_MARKER } from "../../../lib/checkout-phase-timing"

// OPS-20a (spec 07 AC-31): handler รวมของ completeCartWorkflow.hooks.validate (ตัวเดียว — createHook มี handler เดียว)
// log ระดับ debug เวลาต้น/ท้าย handler ผูกด้วย cart_id: (b) จบที่ต้น handler, (c) = ต้น → ท้าย, (d) เริ่มที่ท้าย handler
const validate = jest.fn()
jest.mock("@medusajs/medusa/core-flows", () => ({ completeCartWorkflow: { hooks: { validate } } }))
const reserve = jest.fn()
jest.mock("../flash-sale-reservation", () => ({
  reserveFlashSaleForCart: (...args: unknown[]) => reserve(...args),
  releaseFlashSaleForCart: jest.fn(),
}))
jest.mock("../promotion-exclusivity", () => ({
  assertCompletionCombinable: async () => undefined,
  assertNoGroupBuyCode: () => undefined,
}))

type Handler = (input: { cart: Record<string, unknown> }, ctx: { container: MedusaContainer }) => Promise<unknown>

describe("complete-cart-validate phase timing (OPS-20a)", () => {
  let handler: Handler
  beforeAll(() => {
    jest.isolateModules(() => {
      require("../complete-cart-validate")
    })
    expect(validate).toHaveBeenCalledTimes(1)
    handler = validate.mock.calls[0][0]
  })
  afterEach(() => {
    jest.restoreAllMocks()
    reserve.mockReset()
  })

  function setup(debug = true) {
    let now = 2_000
    jest.spyOn(Date, "now").mockImplementation(() => now)
    const lines: string[] = []
    const logger = { shouldLog: (level: string) => debug && level === "debug", debug: (m: string) => lines.push(m) }
    const container = {
      resolve: (key: string) => (key === ContainerRegistrationKeys.LOGGER ? logger : undefined),
    } as unknown as MedusaContainer
    return { container, lines, advance: (ms: number) => (now += ms) }
  }
  const parse = (line: string) => {
    expect(line.startsWith(`${CHECKOUT_PHASE_MARKER} `)).toBe(true)
    return JSON.parse(line.slice(CHECKOUT_PHASE_MARKER.length + 1))
  }

  it("จองสำเร็จ → log phase hook: started_at = ต้น handler, ended_at = ท้าย handler, outcome ok", async () => {
    const { container, lines, advance } = setup()
    reserve.mockImplementation(async () => {
      advance(700)
      return { cart_id: "cart_1" }
    })
    await handler({ cart: { id: "cart_1" } }, { container })
    expect(lines).toHaveLength(1)
    expect(parse(lines[0])).toEqual({ phase: "hook", cart_id: "cart_1", started_at: 2_000, ended_at: 2_700, outcome: "ok" })
  })

  it("sold out → ยัง log (outcome = code ของ error) แล้วโยน error เดิมต่อ", async () => {
    const { container, lines, advance } = setup()
    const soldOut = new MedusaError(MedusaError.Types.CONFLICT, "This flash sale is sold out", "FLASH_SOLD_OUT")
    reserve.mockImplementation(async () => {
      advance(900)
      throw soldOut
    })
    await expect(handler({ cart: { id: "cart_2" } }, { container })).rejects.toBe(soldOut)
    expect(parse(lines[0])).toMatchObject({ cart_id: "cart_2", started_at: 2_000, ended_at: 2_900, outcome: "FLASH_SOLD_OUT" })
  })

  it("cart ที่ complete แล้ว → log outcome already_completed และไม่จองซ้ำ", async () => {
    const { container, lines } = setup()
    await handler({ cart: { id: "cart_3", completed_at: new Date() } }, { container })
    expect(reserve).not.toHaveBeenCalled()
    expect(parse(lines[0])).toMatchObject({ cart_id: "cart_3", outcome: "already_completed" })
  })

  it("logger ไม่ได้เปิด debug → ไม่ log", async () => {
    const { container, lines } = setup(false)
    reserve.mockResolvedValue(undefined)
    await handler({ cart: { id: "cart_4" } }, { container })
    expect(lines).toHaveLength(0)
  })
})
