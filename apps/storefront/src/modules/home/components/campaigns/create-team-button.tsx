"use client"

import { createGroupBuyTeam } from "@lib/data/group-buy"
import { settleAction } from "@lib/util/action-result"
import { groupJoinErrorMessage } from "@lib/util/group-join-error"
import { loginPathForReturn } from "@lib/util/login-return"
import { Button } from "@modules/common/components/ui"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

// GB-7c (spec 04 กฎข้อ 29e, 29g): สร้างทีมแล้วพาไปหน้าทีมใหม่ (มีลิงก์แชร์; ผู้สร้าง join เองที่หน้านั้น)
// route สร้างทีมไม่ idempotent → in-flight ref + disabled; สำเร็จ/ไปหน้า login แล้วคงปุ่ม disabled จนเปลี่ยนหน้า
export default function CreateTeamButton({ campaignId, countryCode }: { campaignId: string; countryCode: string }) {
  const router = useRouter()
  const inFlight = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    const result = await settleAction(createGroupBuyTeam(campaignId))
    if ("ok" in result) {
      router.push(`/${countryCode}/g/${encodeURIComponent(result.token)}`)
      return
    }
    if (result.error === "unauthorized") {
      // CORE-30 (spec 01 กฎข้อ 87): login แล้วกลับหน้าแรก — ไม่สร้างทีมให้อัตโนมัติ
      router.push(loginPathForReturn(countryCode, `/${countryCode}`))
      return
    }
    setError("message" in result ? result.message : groupJoinErrorMessage(null))
    inFlight.current = false
    setPending(false)
  }

  return (
    <div className="flex flex-col gap-y-2">
      <Button
        variant="secondary"
        className="w-full"
        isLoading={pending}
        disabled={pending}
        onClick={create}
        data-testid="group-create-team-button"
      >
        สร้างทีมของคุณ
      </Button>
      {error && (
        <p className="text-small-regular text-ui-fg-error" role="alert" data-testid="group-create-team-error">
          {error}
        </p>
      )}
    </div>
  )
}
