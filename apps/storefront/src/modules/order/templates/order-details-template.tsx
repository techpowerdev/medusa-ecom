"use client"

import { XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OrderDetails from "@modules/order/components/order-details"
import OrderSummary from "@modules/order/components/order-summary"
import ShippingDetails from "@modules/order/components/shipping-details"
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
        <h1 className="text-2xl-semi" data-testid="order-details-heading">
          รายละเอียดคำสั่งซื้อ
        </h1>
        <LocalizedClientLink
          href="/account/orders"
          className="flex gap-2 items-center text-ui-fg-subtle hover:text-ui-fg-base"
          data-testid="back-to-overview-button"
        >
          <XMark /> กลับไปหน้าคำสั่งซื้อ
        </LocalizedClientLink>
      </div>
      <div
        className="flex flex-col gap-4 h-full bg-white w-full"
        data-testid="order-details-container"
      >
        <OrderDetails order={order} showStatus />
        <Items order={order} />
        {canReturn && (
          <LocalizedClientLink
            href={`/account/orders/details/${order.id}/return`}
            className="self-start rounded-md border border-ui-border-base px-4 py-2 text-ui-fg-base hover:bg-ui-bg-subtle-hover"
            data-testid="order-return-button"
          >
            ขอคืนสินค้า
          </LocalizedClientLink>
        )}
        <ShippingDetails order={order} />
        <OrderSummary order={order} />
        <Help />
      </div>
    </div>
  )
}

export default OrderDetailsTemplate
