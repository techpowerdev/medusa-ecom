import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { assertCartCustomer } from "../../lib/customer-only"

// CORE-6 (spec 01 "ไม่มี guest"): ด่านสำรองหลัง middleware ของ /store/carts — ทุกทางที่สร้าง cart
// ต้องมี customer ที่มีบัญชี (input.customer_id มาจาก auth context หรือจาก customer ที่ Medusa สร้างจาก email)
// อ่านอย่างเดียว ไม่มี compensation
createCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const customerId = input.customer_id
  if (!customerId) {
    return assertCartCustomer(null)
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "has_account"],
    filters: { id: customerId },
  })
  assertCartCustomer(data[0])
})
