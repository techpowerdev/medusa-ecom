import CartTotals from "@modules/common/components/cart-totals"
import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OrderDetails from "@modules/order/components/order-details"
import ShippingDetails from "@modules/order/components/shipping-details"
import PaymentDetails from "@modules/order/components/payment-details"
import { HttpTypes } from "@medusajs/types"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
}

export default async function OrderCompletedTemplate({
  order,
}: OrderCompletedTemplateProps) {
  return (
    <div className="py-6 min-h-[calc(100vh-64px)]">
      <div className="content-container flex flex-col justify-center items-center gap-y-10 max-w-4xl h-full w-full">
        <div
          className="flex flex-col gap-4 max-w-4xl h-full bg-white w-full py-10"
          data-testid="order-complete-container"
        >
          <h1
            className="flex flex-col gap-y-3 text-foreground text-3xl font-semibold mb-4"
            data-testid="order-complete-heading"
          >
            <span>ขอบคุณ!</span>
            <span>เราได้รับคำสั่งซื้อของคุณเรียบร้อยแล้ว</span>
          </h1>
          <OrderDetails order={order} />
          <h2
            className="flex flex-row text-2xl font-semibold"
            data-testid="order-complete-summary-heading"
          >
            สรุปรายการ
          </h2>
          <Items order={order} />
          <CartTotals totals={order} />
          <ShippingDetails order={order} />
          <PaymentDetails order={order} />
          <Help />
        </div>
      </div>
    </div>
  )
}
