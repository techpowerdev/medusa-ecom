"use client"

import { leaveGroupBuyMembership } from "@lib/data/group-buy"
import { GENERIC_ERROR_MESSAGE } from "@lib/util/error-message"
import { Button } from "@modules/common/components/ui"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

// GB-7b (spec 04 กฎข้อ 13): ออกจากกลุ่ม = ยกเลิก draft order ของ membership นี้ — ยืนยันก่อนส่ง และกันกดซ้ำด้วย ref (in-flight) + disabled
// render ทุกแถวเสมอ (review #223): ถ้าถอด component เมื่อ canLeave เป็น false หลัง router.refresh() state error จะหายไปด้วย
// → ผู้ใช้ไม่เห็นเหตุผลที่ออกไม่ได้; จึงซ่อนเฉพาะปุ่มเมื่อออกไม่ได้ แต่คง error ไว้
export default function LeaveGroupButton({ membershipId, canLeave }: { membershipId: string; canLeave: boolean }) {
  const router = useRouter()
  const inFlight = useRef(false)
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const leave = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      const result = await leaveGroupBuyMembership(membershipId)
      if (result.error) {
        setError(result.error)
        setConfirming(false)
      }
      // สำเร็จหรือล้ม (เช่น กลุ่มปิดไปแล้ว) อ่านสถานะใหม่จาก GB-8 ให้รายการตรง backend
      router.refresh()
    } catch {
      // server action ไม่ถึง server (network) — ไม่รู้ผล ให้ลองใหม่ได้ (leave ซ้ำได้ 400 ไม่ยกเลิกซ้ำ)
      setError(GENERIC_ERROR_MESSAGE)
      setConfirming(false)
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  if (!canLeave && !error) return null

  return (
    <div className="flex flex-col items-end gap-y-2">
      {!canLeave ? null : confirming ? (
        <div className="flex gap-2" data-testid="group-leave-confirm-box">
          <span className="text-small-regular self-center">ยืนยันออกจากกลุ่ม? คำสั่งซื้อนี้จะถูกยกเลิก</span>
          <Button variant="secondary" disabled={pending} onClick={() => setConfirming(false)} data-testid="group-leave-cancel">
            ไม่ใช่
          </Button>
          <Button isLoading={pending} onClick={leave} data-testid="group-leave-confirm">
            ออกจากกลุ่ม
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)} data-testid="group-leave-button">
          ออกจากกลุ่ม
        </Button>
      )}
      {error && (
        <p className="text-small-regular text-ui-fg-error" data-testid="group-leave-error">
          {error}
        </p>
      )}
    </div>
  )
}
