import { Button } from "@/components/ui/button"
import ChevronDown from "@modules/common/icons/chevron-down"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { convertToLocale } from "@lib/util/money"
import { formatDate } from "@lib/util/date"
import { HttpTypes } from "@medusajs/types"

type OverviewProps = {
  customer: HttpTypes.StoreCustomer | null
  orders: HttpTypes.StoreOrder[] | null
  /** CORE-78 (กฎข้อ 136b): มี membership แบบกลุ่ม ≥ 1 → แสดง "ดูทั้งหมด" แม้ไม่มี order ปกติ */
  hasGroupOrders?: boolean
}

const Overview = ({ customer, orders, hasGroupOrders = false }: OverviewProps) => {
  return (
    <div data-testid="overview-page-wrapper">
      <div className="hidden small:block">
        <div className="text-2xl leading-[36px] font-semibold flex justify-between items-center mb-4">
          <span data-testid="welcome-message" data-value={customer?.first_name}>
            สวัสดี {customer?.first_name}
          </span>
          <span className="text-xs leading-5 font-normal text-foreground">
            เข้าสู่ระบบด้วย:{" "}
            <span
              className="font-semibold"
              data-testid="customer-email"
              data-value={customer?.email}
            >
              {customer?.email}
            </span>
          </span>
        </div>
        <div className="flex flex-col py-8 border-t border-gray-200">
          <div className="flex flex-col gap-y-4 h-full col-span-1 row-span-2 flex-1">
            <div
              className="flex items-start gap-x-16 mb-6"
              data-testid="overview-stats"
            >
              <div className="flex flex-col gap-y-4">
                <h3 className="text-base leading-6 font-semibold">โปรไฟล์</h3>
                <div className="flex items-end gap-x-2">
                  <span
                    className="text-[32px] leading-none font-semibold"
                    data-testid="customer-profile-completion"
                    data-value={getProfileCompletion(customer)}
                  >
                    {getProfileCompletion(customer)}%
                  </span>
                  <span className="uppercase text-sm leading-6 font-normal text-muted-foreground">
                    สมบูรณ์
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-y-4">
                <h3 className="text-base leading-6 font-semibold">ที่อยู่</h3>
                <div className="flex items-end gap-x-2">
                  <span
                    className="text-[32px] leading-none font-semibold"
                    data-testid="addresses-count"
                    data-value={customer?.addresses?.length || 0}
                  >
                    {customer?.addresses?.length || 0}
                  </span>
                  <span className="uppercase text-sm leading-6 font-normal text-muted-foreground">
                    ที่บันทึกไว้
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-y-4">
              <div className="flex items-center justify-between gap-x-2">
                <h3 className="text-base leading-6 font-semibold">คำสั่งซื้อล่าสุด</h3>
                {((orders && orders.length > 0) || hasGroupOrders) && (
                  <LocalizedClientLink
                    href="/account/orders"
                    className="text-xs leading-5 font-normal text-primary underline-offset-4 hover:underline"
                    data-testid="overview-orders-view-all"
                  >
                    ดูทั้งหมด
                  </LocalizedClientLink>
                )}
              </div>
              <ul
                className="flex flex-col gap-y-4"
                data-testid="orders-wrapper"
              >
                {orders && orders.length > 0 ? (
                  orders.map((order) => {
                    return (
                      <li
                        key={order.id}
                        data-testid="order-wrapper"
                        data-value={order.id}
                      >
                        <LocalizedClientLink
                          href={`/account/orders/details/${order.id}`}
                        >
                          <div className="rounded-lg bg-card flex justify-between items-center p-4">
                            <div className="grid grid-cols-3 grid-rows-2 text-xs leading-5 font-normal gap-x-4 flex-1">
                              <span className="font-semibold">วันที่สั่งซื้อ</span>
                              <span className="font-semibold">
                                เลขที่คำสั่งซื้อ
                              </span>
                              <span className="font-semibold">
                                ยอดรวม
                              </span>
                              <span data-testid="order-created-date">
                                {formatDate(order.created_at)}
                              </span>
                              <span
                                data-testid="order-id"
                                data-value={order.display_id}
                              >
                                #{order.display_id}
                              </span>
                              <span data-testid="order-amount">
                                {convertToLocale({
                                  amount: order.total,
                                  currency_code: order.currency_code,
                                })}
                              </span>
                            </div>
                            {/* SFUI-19b (spec 09 กฎ 60, inventory 20): อยู่ในลิงก์ของการ์ดแล้ว → asChild บน <span>
                                (หน้าตา ghost icon โดยไม่ซ้อน element ที่ focus ได้ในลิงก์ — spec 01 กฎ 146b) */}
                            <Button asChild variant="ghost" size="icon">
                              <span
                                role="img"
                                aria-label={`ไปที่คำสั่งซื้อ #${order.display_id}`}
                                data-testid="open-order-button"
                              >
                                <ChevronDown className="-rotate-90" />
                              </span>
                            </Button>
                          </div>
                        </LocalizedClientLink>
                      </li>
                    )
                  })
                ) : (
                  // CORE-92 (กฎข้อ 148a): มีแต่ membership แบบกลุ่ม → ไม่บอกว่า "ยังไม่มีคำสั่งซื้อ" (มีลิงก์ "ดูทั้งหมด" แทน)
                  !hasGroupOrders && (
                    <span data-testid="no-orders-message">ยังไม่มีคำสั่งซื้อ</span>
                  )
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const getProfileCompletion = (customer: HttpTypes.StoreCustomer | null) => {
  let count = 0

  if (!customer) {
    return 0
  }

  if (customer.email) {
    count++
  }

  if (customer.first_name && customer.last_name) {
    count++
  }

  if (customer.phone) {
    count++
  }

  const billingAddress = customer.addresses?.find(
    (addr) => addr.is_default_billing
  )

  if (billingAddress) {
    count++
  }

  return (count / 4) * 100
}

export default Overview
