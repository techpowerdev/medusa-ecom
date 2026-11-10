import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ILockingModule, IPaymentModuleService, RemoteQueryFunction } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { PAYMENT_ALREADY_COMPLETED } from "./errors"

// PAY-6 (spec 06 กฎข้อ 7A, ADR-015 A): Medusa 2.22.1 ลบ session เดิมตอนสร้าง session ใหม่ได้แม้ PI `succeeded` แล้ว
// → ก่อนให้ route ของ Medusa ลบ ตรวจ session Stripe เดิมผ่าน `authorizePaymentSession` ของ payment module (ไม่เรียก Stripe ตรง)
// ถ้าชำระแล้วหรือกำลังชำระ → 409 ผ่าน businessErrorHandler (PROMO-2) และ session เดิมยังอยู่ให้ webhook complete cart

const LOCK_TIMEOUT_SECONDS = 30 // เท่ากับ lock ของ processPaymentWorkflow

type ExistingSession = {
  id: string
  provider_id: string
  data?: { id?: unknown } | null
  authorized_at?: Date | string | null
  payment?: { id: string } | null
}

const alreadyCompleted = () =>
  new MedusaError(
    MedusaError.Types.CONFLICT,
    "Payment for this payment collection has already been completed",
    PAYMENT_ALREADY_COMPLETED
  )

const isStripeSessionWithIntent = (session: ExistingSession) =>
  session.provider_id.startsWith("pp_stripe") && typeof session.data?.id === "string" && !!session.data.id

async function assertNotPaid(payment: IPaymentModuleService, session: ExistingSession): Promise<void> {
  if (session.authorized_at || session.payment) {
    throw alreadyCompleted()
  }
  try {
    // คืน payment (PI succeeded / requires_capture) หรือ null (PI processing แบบ async) = ห้ามลบ session
    await payment.authorizePaymentSession(session.id, {})
  } catch (error) {
    if ((error as MedusaError)?.type === MedusaError.Types.NOT_ALLOWED) {
      return // PI ยังไม่ชำระ / ถูกยกเลิก → สร้าง session ใหม่ตามปกติ
    }
    throw error // fail closed: ไม่รู้สถานะ PI → ไม่ลบ session
  }
  throw alreadyCompleted()
}

export async function guardPaidStripeSession(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const query = req.scope.resolve<RemoteQueryFunction>(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "payment_collection",
    fields: [
      "id",
      "cart.id",
      "payment_sessions.id",
      "payment_sessions.provider_id",
      "payment_sessions.data",
      "payment_sessions.authorized_at",
      "payment_sessions.payment.id",
    ],
    filters: { id: req.params.id },
  })
  const collection = data[0]
  const sessions = ((collection?.payment_sessions ?? []) as ExistingSession[]).filter(isStripeSessionWithIntent)
  if (!sessions.length) {
    return next()
  }

  // key เดียวกับ processPaymentWorkflow (cart_id); collection ของ order ไม่มี cart → payment_collection_id (ภาคผนวก ADR-015)
  const lockKey: string = collection.cart?.id ?? collection.id
  const payment = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const locking = req.scope.resolve<ILockingModule>(Modules.LOCKING)
  await locking.execute(
    lockKey,
    async () => {
      for (const session of sessions) {
        await assertNotPaid(payment, session)
      }
    },
    { timeout: LOCK_TIMEOUT_SECONDS }
  )
  next()
}
