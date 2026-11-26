import { HttpTypes } from "@medusajs/types"
import { formatDate } from "@lib/util/date"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
  showStatus?: boolean
}

// สถานะจาก Medusa (enum) → ข้อความไทย; ค่าที่ไม่รู้จักแสดงตามที่ได้รับ
const STATUS_LABELS: Record<string, string> = {
  not_fulfilled: "ยังไม่จัดเตรียม",
  partially_fulfilled: "จัดเตรียมบางส่วน",
  fulfilled: "จัดเตรียมแล้ว",
  partially_shipped: "จัดส่งบางส่วน",
  shipped: "จัดส่งแล้ว",
  partially_delivered: "ส่งถึงบางส่วน",
  delivered: "ส่งถึงแล้ว",
  not_paid: "ยังไม่ชำระ",
  awaiting: "รอชำระเงิน",
  authorized: "อนุมัติการชำระแล้ว",
  partially_authorized: "อนุมัติการชำระบางส่วน",
  captured: "ชำระแล้ว",
  partially_captured: "ชำระบางส่วน",
  partially_refunded: "คืนเงินบางส่วน",
  refunded: "คืนเงินแล้ว",
  requires_action: "ต้องดำเนินการเพิ่มเติม",
  canceled: "ยกเลิกแล้ว",
}

const formatStatus = (status: string) => STATUS_LABELS[status] ?? status

const OrderDetails = ({ order, showStatus }: OrderDetailsProps) => {
  return (
    <div>
      <p className="text-sm leading-[1.4rem]">
        เราได้ส่งรายละเอียดคำสั่งซื้อไปที่{" "}
        <span
          className="font-semibold"
          data-testid="order-email"
        >
          {order.email}
        </span>{" "}
        แล้ว
      </p>
      <p className="text-sm leading-[1.4rem] mt-2">
        วันที่สั่งซื้อ:{" "}
        <span data-testid="order-date">{formatDate(order.created_at)}</span>
      </p>
      <p className="text-sm leading-[1.4rem] mt-2 text-primary">
        เลขที่คำสั่งซื้อ: <span data-testid="order-id">{order.display_id}</span>
      </p>

      <div className="flex items-center text-compact-small gap-x-4 mt-4">
        {showStatus && (
          <>
            <p className="text-sm leading-[1.4rem]">
              สถานะคำสั่งซื้อ:{" "}
              <span className="text-muted-foreground " data-testid="order-status">
                {formatStatus(order.fulfillment_status)}
              </span>
            </p>
            <p className="text-sm leading-[1.4rem]">
              สถานะการชำระเงิน:{" "}
              <span
                className="text-muted-foreground "
                data-testid="order-payment-status"
              >
                {formatStatus(order.payment_status)}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default OrderDetails
