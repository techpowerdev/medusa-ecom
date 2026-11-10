import { HttpTypes } from "@medusajs/types"
import { formatDate } from "@lib/util/date"
import { Text } from "@modules/common/components/ui"

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
      <Text>
        เราได้ส่งรายละเอียดคำสั่งซื้อไปที่{" "}
        <span
          className="text-ui-fg-medium-plus font-semibold"
          data-testid="order-email"
        >
          {order.email}
        </span>{" "}
        แล้ว
      </Text>
      <Text className="mt-2">
        วันที่สั่งซื้อ:{" "}
        <span data-testid="order-date">{formatDate(order.created_at)}</span>
      </Text>
      <Text className="mt-2 text-ui-fg-interactive">
        เลขที่คำสั่งซื้อ: <span data-testid="order-id">{order.display_id}</span>
      </Text>

      <div className="flex items-center text-compact-small gap-x-4 mt-4">
        {showStatus && (
          <>
            <Text>
              สถานะคำสั่งซื้อ:{" "}
              <span className="text-ui-fg-subtle " data-testid="order-status">
                {formatStatus(order.fulfillment_status)}
              </span>
            </Text>
            <Text>
              สถานะการชำระเงิน:{" "}
              <span
                className="text-ui-fg-subtle "
                data-testid="order-payment-status"
              >
                {formatStatus(order.payment_status)}
              </span>
            </Text>
          </>
        )}
      </div>
    </div>
  )
}

export default OrderDetails
