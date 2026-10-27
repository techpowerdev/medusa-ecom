import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type Knex = { destroy: () => Promise<unknown>; initialize: () => unknown }
type Container = { hasRegistration: (key: string) => boolean; resolve: (key: string) => unknown }

/**
 * OPS-15: medusa-test-utils restore DB จาก template ก่อนทุก test โดย terminate ทุก backend ของ DB นั้น
 * connection ที่ว่างอยู่ใน pool ของ app จึงตายและ knex เตือนตอนหยิบมาใช้ครั้งถัดไป — ปิด pool เดิม
 * (รอ connection ที่ใช้อยู่คืนก่อน) แล้วสร้าง pool ใหม่บน knex instance เดิมที่ module ทุกตัวอ้างถึง
 */
export async function releaseIdlePgConnections(container: Container): Promise<void> {
  if (!container.hasRegistration(ContainerRegistrationKeys.PG_CONNECTION)) {
    return
  }
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex
  await knex.destroy()
  knex.initialize()
}
