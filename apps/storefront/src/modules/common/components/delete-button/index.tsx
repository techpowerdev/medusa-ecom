import { deleteLineItem } from "@lib/data/cart"
import { actionErrorMessage, settleAction } from "@lib/util/action-result"
import { notifyCartUpdated } from "@lib/util/cart-events"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { cn } from "@/lib/utils"
import { LoaderCircle, Trash2 } from "lucide-react"
import { useState } from "react"

// CORE-19c (spec 01 กฎข้อ 64): ลบล้มต้องบอกผู้ใช้ ไม่กลืน error เงียบ
// CORE-19d (กฎข้อ 68): action คืน `{ error }` แทนการ throw จึงแยก unauthorized ได้; action ที่ reject
// (เช่น request ของ action ล้มเอง) ไม่มีรายละเอียดใน prod → ใช้ข้อความ fallback
// CORE-4i (กฎข้อ 72): unauthorized ใช้ SIGN_IN_AGAIN_MESSAGE ตัวเดียวทั้งเว็บ (ผ่าน actionErrorMessage)
const REMOVE_FAILED_MESSAGE = "ลบสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"

/** ลบ line แล้วคืนข้อความ error ที่จะแสดง (null = ลบสำเร็จ) */
export const removeLineItem = async (id: string): Promise<string | null> => {
  const result = await settleAction(deleteLineItem(id))
  if ("error" in result) {
    return actionErrorMessage(result.error, REMOVE_FAILED_MESSAGE)
  }
  notifyCartUpdated()
  return null
}

const DeleteButton = ({
  id,
  children,
  className,
  "data-testid": dataTestId,
}: {
  id: string
  children?: React.ReactNode
  className?: string
  "data-testid"?: string
}) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    setError(null)
    const message = await removeLineItem(id)
    if (message) {
      setError(message)
      setIsDeleting(false)
    }
  }

  const icon = isDeleting ? (
    <LoaderCircle className="animate-spin" data-testid="cart-item-remove-spinner" />
  ) : (
    <Trash2 />
  )

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between text-xs leading-5 font-normal",
        className
      )}
    >
      {/* SFUI-19b (spec 09 กฎ 60, inventory 18): ghost; ไม่มีข้อความ → size="icon" + aria-label ไทย */}
      {children ? (
        <Button variant="ghost" onClick={() => handleDelete(id)} disabled={isDeleting} data-testid={dataTestId}>
          {icon}
          <span>{children}</span>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          aria-label="ลบสินค้าออกจากตะกร้า"
          onClick={() => handleDelete(id)}
          disabled={isDeleting}
          data-testid={dataTestId}
        >
          {icon}
        </Button>
      )}
      {error && (
        // qa #142 D-2: ขึ้นบรรทัดใหม่เต็มความกว้างของแถว (order-last) ไม่ถูกบีบข้างปุ่ม
        // SFUI-21d (spec 09 กฎ 74 (b)): error ในแถว = FieldError (role="alert" จาก component)
        <FieldError className="basis-full order-last" data-testid="cart-item-remove-error">
          {error}
        </FieldError>
      )}
    </div>
  )
}

export default DeleteButton
