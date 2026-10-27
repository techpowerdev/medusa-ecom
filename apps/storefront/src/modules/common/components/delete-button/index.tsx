import { deleteLineItem } from "@lib/data/cart"
import { notifyCartUpdated } from "@lib/util/cart-events"
import { Spinner, Trash } from "@medusajs/icons"
import { clx } from "@modules/common/components/ui"
import { useState } from "react"

// CORE-19c (spec 01 กฎข้อ 64): ลบล้มต้องบอกผู้ใช้ ไม่กลืน error เงียบ
// CORE-19d (กฎข้อ 68): action คืน `{ error }` แทนการ throw จึงแยก unauthorized ได้; action ที่ reject
// (เช่น request ของ action ล้มเอง) ไม่มีรายละเอียดใน prod → ใช้ข้อความ fallback
const REMOVE_FAILED_MESSAGE = "ลบสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
const REMOVE_UNAUTHORIZED_MESSAGE = "ลบสินค้าไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่"

/** ลบ line แล้วคืนข้อความ error ที่จะแสดง (null = ลบสำเร็จ) */
export const removeLineItem = async (id: string): Promise<string | null> => {
  const result = await deleteLineItem(id).catch(
    () => ({ error: "failed" }) as const
  )
  if ("error" in result) {
    return result.error === "unauthorized"
      ? REMOVE_UNAUTHORIZED_MESSAGE
      : REMOVE_FAILED_MESSAGE
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

  return (
    <div
      className={clx(
        "flex flex-wrap items-center justify-between text-small-regular",
        className
      )}
    >
      <button
        className="flex gap-x-1 text-ui-fg-subtle hover:text-ui-fg-base cursor-pointer"
        onClick={() => handleDelete(id)}
        disabled={isDeleting}
        data-testid={dataTestId}
      >
        {isDeleting ? (
          <Spinner
            className="animate-spin"
            data-testid="cart-item-remove-spinner"
          />
        ) : (
          <Trash />
        )}
        <span>{children}</span>
      </button>
      {error && (
        // qa #142 D-2: ขึ้นบรรทัดใหม่เต็มความกว้างของแถว (order-last) ไม่ถูกบีบข้างปุ่ม
        <span
          className="basis-full order-last text-ui-fg-error text-small-regular"
          role="alert"
          data-testid="cart-item-remove-error"
        >
          {error}
        </span>
      )}
    </div>
  )
}

export default DeleteButton
