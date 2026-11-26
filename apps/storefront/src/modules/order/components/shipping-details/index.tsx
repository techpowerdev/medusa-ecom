import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

import Divider from "@modules/common/components/divider"

type ShippingDetailsProps = {
  order: HttpTypes.StoreOrder
}

const ShippingDetails = ({ order }: ShippingDetailsProps) => {
  // CORE-52 (กฎข้อ 110c): order voucher ล้วนไม่มีการจัดส่ง — ไม่แสดง section นี้ (หน้า confirmed และรายละเอียด order)
  if (!order.shipping_methods?.length) {
    return null
  }

  return (
    <div>
      <h2
        className="flex flex-row text-2xl font-semibold my-6"
        data-testid="shipping-details-heading"
      >
        การจัดส่ง
      </h2>
      <div className="flex items-start gap-x-8">
        <div
          className="flex flex-col w-1/3"
          data-testid="shipping-address-summary"
        >
          <p className="text-sm leading-[1.4rem] font-medium text-foreground mb-1">
            ที่อยู่จัดส่ง
          </p>
          <p className="text-sm leading-[1.4rem] text-muted-foreground">
            {order.shipping_address?.first_name}{" "}
            {order.shipping_address?.last_name}
          </p>
          <p className="text-sm leading-[1.4rem] text-muted-foreground">
            {order.shipping_address?.address_1}{" "}
            {order.shipping_address?.address_2}
          </p>
          <p className="text-sm leading-[1.4rem] text-muted-foreground">
            {order.shipping_address?.postal_code},{" "}
            {order.shipping_address?.city}
          </p>
          <p className="text-sm leading-[1.4rem] text-muted-foreground">
            {order.shipping_address?.country_code?.toUpperCase()}
          </p>
        </div>

        <div
          className="flex flex-col w-1/3 "
          data-testid="shipping-contact-summary"
        >
          <p className="text-sm leading-[1.4rem] font-medium text-foreground mb-1">ข้อมูลติดต่อ</p>
          <p className="text-sm leading-[1.4rem] text-muted-foreground">
            {order.shipping_address?.phone}
          </p>
          <p className="text-sm leading-[1.4rem] text-muted-foreground">{order.email}</p>
        </div>

        <div
          className="flex flex-col w-1/3"
          data-testid="shipping-method-summary"
        >
          <p className="text-sm leading-[1.4rem] font-medium text-foreground mb-1">วิธีจัดส่ง</p>
          <p className="text-sm leading-[1.4rem] text-muted-foreground">
            {(order.shipping_methods?.[0] as { name?: string })?.name} (
            {convertToLocale({
              amount: order.shipping_methods?.[0]?.total ?? 0,
              currency_code: order.currency_code,
            })}
            )
          </p>
        </div>
      </div>
      <Divider className="mt-8" />
    </div>
  )
}

export default ShippingDetails
