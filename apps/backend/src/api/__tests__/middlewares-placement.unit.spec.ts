import middlewares from "../middlewares"
import { storeFlashSaleMiddlewares } from "../store/flash-sales/middlewares"
import { storeCustomerMeMiddlewares } from "../store/customers/me/middlewares"

// OPS-34 (spec 07 กฎข้อ 16 g รอบ 41, review #434): matcher ของ `/store/customers/me/*` อยู่ในไฟล์ middleware ของ path นั้น
// ไม่ซ่อนอยู่ในไฟล์ของ `/store/flash-sales` — พฤติกรรมเดิม (validate query ของ allowance) ยังลงทะเบียนอยู่
const ALLOWANCE = "/store/customers/me/flash-sales/allowance"

describe("middleware placement of /store/customers/me/*", () => {
  it("the flash-sales middleware file only has /store/flash-sales matchers", () => {
    expect(storeFlashSaleMiddlewares.map((r) => String(r.matcher)).filter((m) => !m.startsWith("/store/flash-sales"))).toEqual(
      []
    )
  })

  it("the allowance matcher lives in the /store/customers/me middleware file and is registered once", () => {
    expect(storeCustomerMeMiddlewares.map((r) => r.matcher)).toContain(ALLOWANCE)
    const routes = (middlewares.routes ?? []).filter((r) => r.matcher === ALLOWANCE)
    expect(routes).toHaveLength(1)
    expect((routes[0] as { methods?: string[] }).methods).toEqual(["GET"]) // defineMiddlewares แปลง method → methods
    expect(routes[0].middlewares).toHaveLength(1)
  })
})
