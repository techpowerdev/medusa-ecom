import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { IFulfillmentModuleService, RemoteQueryFunction } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"

// CORE-17 (owner 2026-10-26): POST /store/returns ของ Medusa 2.22.1 ไม่ตรวจ return_shipping.option_id
// (createAndCompleteReturnOrderWorkflow รับ option ขาออกได้) → store ต้องใช้ option คืนของที่เปิดใน store
// และอยู่ใน service zone ที่ครอบที่อยู่จัดส่งของ order
type Rule = { attribute: string; operator: string; value: unknown }

// rule ของ attribute นั้นต้องมีอย่างน้อยหนึ่งข้อและทุกข้อเป็น eq "true" — option ที่ไม่มี rule ถือว่าไม่ผ่าน
// (dashboard ของ Medusa คัด return option ด้วย rule is_return = "true"; store flow ส่ง context enabled_in_store = "true")
const ruleIsTrue = (rules: Rule[], attribute: string) => {
  const own = rules.filter((r) => r.attribute === attribute)
  return own.length > 0 && own.every((r) => r.operator === "eq" && r.value === "true")
}

export function storeReturnOptionRuleError(rules: Rule[]): string | null {
  if (!ruleIsTrue(rules, "is_return")) {
    return "Shipping option is not a return option"
  }
  if (!ruleIsTrue(rules, "enabled_in_store")) {
    return "Return shipping option is not available in store"
  }
  return null
}

const invalid = (message: string) => new MedusaError(MedusaError.Types.INVALID_DATA, message)

// ต่อจาก ownership check (CORE-13) และ rejectStoreReturnOverrides (CORE-16) — body ที่ไม่มี option_id แบบ string
// ปล่อยให้ validator ของ core ตอบ 400 เอง
export async function validateStoreReturnShippingOption(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const body = (req.body ?? {}) as { order_id?: unknown; return_shipping?: { option_id?: unknown } }
  const optionId = body.return_shipping?.option_id
  if (typeof optionId !== "string") {
    return next()
  }

  const query = req.scope.resolve<RemoteQueryFunction>(ContainerRegistrationKeys.QUERY)
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: [
      "id",
      "rules.attribute",
      "rules.operator",
      "rules.value",
      // CORE-21: location ของ fulfillment set ที่ service zone ของ option สังกัด
      "service_zone.fulfillment_set.location.sales_channels.id",
    ],
    filters: { id: optionId },
  })
  if (!options[0]) {
    // กฎข้อ 37 (CORE-21): ข้อความคงที่ ไม่ต่อ option_id จาก input
    throw invalid("Return shipping option was not found")
  }
  const ruleError = storeReturnOptionRuleError((options[0].rules ?? []) as Rule[])
  if (ruleError) {
    throw invalid(ruleError)
  }

  // order มีอยู่และเป็นของลูกค้าแล้ว (ownership check ก่อนหน้า)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "sales_channel_id",
      "shipping_address.country_code", "shipping_address.province", "shipping_address.city", "shipping_address.postal_code"],
    filters: { id: body.order_id as string },
  })
  const address = orders[0]?.shipping_address
  // ไม่มี country_code → Medusa ไม่กรอง geo zone เลย จึงต้องปฏิเสธเอง
  const covered =
    !!address?.country_code &&
    (
      await req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT).listShippingOptionsForContext({
        id: optionId,
        // map เหมือน listShippingOptionsForCartWorkflow ของ Medusa
        address: {
          country_code: address.country_code,
          province_code: address.province ?? undefined,
          city: address.city ?? undefined,
          postal_expression: address.postal_code ?? undefined,
        },
      })
    ).length > 0
  if (!covered) {
    throw invalid("Return shipping option does not serve the order's shipping address")
  }

  // CORE-21: createAndCompleteReturnOrderWorkflow ของ Medusa 2.22.1 ไม่ตรวจว่า stock location ของ option
  // อยู่ใน sales channel ของ order → ปฏิเสธเอง
  const channels = options[0].service_zone?.fulfillment_set?.location?.sales_channels ?? []
  if (!channels.some((c) => c?.id === orders[0]?.sales_channel_id)) {
    throw invalid("Return shipping option is not available for the order's sales channel")
  }
  next()
}
