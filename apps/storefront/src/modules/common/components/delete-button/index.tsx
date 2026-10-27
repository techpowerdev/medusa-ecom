import { deleteLineItem } from "@lib/data/cart"
import { notifyCartUpdated } from "@lib/util/cart-events"
import { Spinner, Trash } from "@medusajs/icons"
import { clx } from "@modules/common/components/ui"
import { useState } from "react"

// CORE-19c (spec 01 กฎข้อ 64): ลบล้มต้องบอกผู้ใช้ ไม่กลืน error เงียบ
// ใช้ข้อความกลางข้อความเดียว: error จาก server action ใน prod ถูก Next ซ่อนรายละเอียด (ไม่มี status ให้แยกกรณี)
const REMOVE_FAILED_MESSAGE = "ลบสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"

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
    await deleteLineItem(id)
      .then(notifyCartUpdated)
      .catch(() => {
        setError(REMOVE_FAILED_MESSAGE)
        setIsDeleting(false)
      })
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
