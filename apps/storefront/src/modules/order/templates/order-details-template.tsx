"use client"

import { Button } from "@/components/ui/button"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OrderDetails from "@modules/order/components/order-details"
import OrderSummary from "@modules/order/components/order-summary"
import ShippingDetails from "@modules/order/components/shipping-details"
import { X } from "lucide-react"
import React from "react"

type OrderDetailsTemplateProps = {
  order: HttpTypes.StoreOrder
  canReturn?: boolean
}

const OrderDetailsTemplate: React.FC<OrderDetailsTemplateProps> = ({
  order,
  canReturn = false,
}) => {
  return (
    <div className="flex flex-col justify-center gap-y-4">
      <div className="flex gap-2 justify-between items-center">
        <h1 className="text-3xl font-semibold tracking-tight" data-testid="order-details-heading">
          รายละเอียดคำสั่งซื้อ
        </h1>
        <LocalizedClientLink
          href="/account/orders"
          className="flex gap-2 items-center text-muted-foreground hover:text-foreground"
          data-testid="back-to-overview-button"
        >
          <X className="size-[15px]" /> กลับไปหน้าคำสั่งซื้อ
        </LocalizedClientLink>
      </div>
      <div
        className="flex flex-col gap-4 h-full bg-white w-full"
        data-testid="order-details-container"
      >
        <OrderDetails order={order} showStatus />
        <Items order={order} />
        {canReturn && (
          // SFUI-19b (spec 09 กฎ 60): ลิงก์ navigation หน้าตาปุ่ม = Button asChild ครอบลิงก์ (focus ที่ <a> ตัวเดียว)
          <Button asChild variant="outline" className="self-start">
            <LocalizedClientLink
              href={`/account/orders/details/${order.id}/return`}
              data-testid="order-return-button"
            >
              ขอคืนสินค้า
            </LocalizedClientLink>
          </Button>
        )}
        <ShippingDetails order={order} />
        <OrderSummary order={order} />
        <Help />
      </div>
    </div>
  )
}

export default OrderDetailsTemplate
