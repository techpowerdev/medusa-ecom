import { deleteLineItem } from "@lib/data/cart"
import { notifyCartUpdated } from "@lib/util/cart-events"
import { friendlyErrorMessage } from "@lib/util/error-message"
import { Spinner, Trash } from "@medusajs/icons"
import { clx } from "@modules/common/components/ui"
import { useState } from "react"

// CORE-19c (spec 01 กฎข้อ 64): ลบล้มต้องบอกผู้ใช้ ไม่กลืน error เงียบ
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
      .catch((err) => {
        setError(friendlyErrorMessage(err, REMOVE_FAILED_MESSAGE))
        setIsDeleting(false)
      })
  }

  return (
    <div
      className={clx(
        "flex items-center justify-between text-small-regular",
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
        <span
          className="text-ui-fg-error text-small-regular"
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
