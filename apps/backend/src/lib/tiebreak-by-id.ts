import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

type Direction = "ASC" | "DESC"

// ADM-17 qa D-1 / EV-19 (spec 02 กฎ 35): order ของ Medusa รับ field เดียว — ค่าซ้ำ (created_at ของ import batch,
// ชื่อซ้ำ) ทำให้ offset ข้าม/ซ้ำแถว จึงต่อ id (ทิศเดียวกับ field แรก) เป็นตัวตัดสินที่คงที่
// `defaultOrder`: ใช้เมื่อผู้เรียกไม่ส่ง `order` (ไม่งั้น Postgres ไม่รับประกันลำดับเลย)
// ADM-24 (spec 08 กฎ 28d): แก้เฉพาะ req.queryConfig.pagination.order — route ที่อ่าน req.listConfig.order
// (เช่นส่งต่อให้ service list ตรงๆ) จะไม่ได้ tiebreak; route ที่ใช้ต้องส่ง queryConfig.pagination ให้ query.graph
export const tiebreakById =
  (defaultOrder?: Record<string, Direction>) =>
  (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
    const pagination = req.queryConfig?.pagination
    if (pagination && !pagination.order && defaultOrder) {
      pagination.order = { ...defaultOrder }
    }
    const order = pagination?.order as Record<string, unknown> | undefined
    if (pagination && order && !("id" in order)) {
      const first = Object.values(order)[0]
      pagination.order = { ...order, id: typeof first === "string" ? first : "DESC" }
    }
    next()
  }
