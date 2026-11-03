import { formatDate, formatDateTime } from "@lib/util/date"
import { GroupBuyMembership, GroupBuyMembershipView, groupBuyMembershipView } from "@lib/util/group-buy-orders"
import { convertToLocale } from "@lib/util/money"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Button } from "@modules/common/components/ui"
import LeaveGroupButton from "./leave-button"

type Props = {
  /** null = อ่าน GB-8 ล้ม */
  data: { memberships: GroupBuyMembership[]; count: number } | null
  /** เวลาของ request (server component render ครั้งเดียว) */
  now: number
}

const STATUS_LABEL: Record<Exclude<GroupBuyMembershipView["kind"], "pay">, string> = {
  waiting: "รอกลุ่มครบเป้าหมาย",
  expired: "หมดเวลาชำระเงิน",
  paid: "ชำระแล้ว",
  cancelled: "ยกเลิก",
}

// GB-7b (spec 04 Storefront, AC-16): draft order ของกลุ่มในหน้า account — อ่านจาก GB-8, ลิงก์ไปหน้า pay ของ PAY-3b (ไม่สร้างหน้าชำระเงินซ้ำ)
export default function AccountGroupOrders({ data, now }: Props) {
  if (!data) {
    return (
      <p className="text-base-regular text-ui-fg-error mb-8" data-testid="group-orders-error">
        โหลดคำสั่งซื้อแบบกลุ่มไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
      </p>
    )
  }
  if (!data.memberships.length) return null

  return (
    <section className="mb-10 flex flex-col gap-y-4" data-testid="group-orders">
      <h2 className="text-large-semi">คำสั่งซื้อแบบกลุ่ม</h2>
      <ul className="flex flex-col gap-y-6">
        {data.memberships.map((m) => (
          <GroupOrderRow key={m.id} membership={m} view={groupBuyMembershipView(m, now)} />
        ))}
      </ul>
      {data.count > data.memberships.length && (
        <p className="text-small-regular text-ui-fg-subtle" data-testid="group-orders-truncated">
          {`แสดง ${data.memberships.length} รายการล่าสุดจากทั้งหมด ${data.count} รายการ`}
        </p>
      )}
    </section>
  )
}

function GroupOrderRow({ membership: m, view }: { membership: GroupBuyMembership; view: GroupBuyMembershipView }) {
  return (
    <li
      className="flex flex-col gap-y-2 border-b border-gray-200 pb-6"
      data-testid="group-order-card"
      data-membership-id={m.id}
      data-order-id={m.order_id}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-base-semi" data-testid="group-order-campaign">
          {m.campaign?.name ?? "แคมเปญซื้อกลุ่ม"}
        </span>
        {view.kind === "pay" ? (
          <span className="text-small-semi text-ui-fg-interactive" data-testid="group-pay-deadline">
            {`ชำระเงินภายใน ${formatDateTime(view.deadline)}`}
          </span>
        ) : (
          <span className="text-small-semi" data-testid="group-order-status" data-status={view.kind}>
            {STATUS_LABEL[view.kind]}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 text-small-regular text-ui-fg-subtle">
        {m.order && <span data-testid="group-order-display-id">{`คำสั่งซื้อ #${m.order.display_id}`}</span>}
        <span>{`เข้าร่วมเมื่อ ${formatDate(m.joined_at)}`}</span>
        <span>{`${m.units} ชิ้น`}</span>
        {m.order && (
          <span data-testid="group-order-amount">
            {convertToLocale({ amount: m.order.total, currency_code: m.order.currency_code })}
          </span>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {view.kind === "pay" && (
          <LocalizedClientLink href={`/account/orders/${m.order_id}/pay`} data-testid="group-order-pay-link">
            <Button>ชำระเงิน</Button>
          </LocalizedClientLink>
        )}
        {view.kind === "paid" && view.orderDetails && (
          <LocalizedClientLink href={`/account/orders/details/${m.order_id}`} data-testid="group-order-details-link">
            <Button variant="secondary">ดูรายละเอียด</Button>
          </LocalizedClientLink>
        )}
        {view.canLeave && <LeaveGroupButton membershipId={m.id} />}
      </div>
    </li>
  )
}
