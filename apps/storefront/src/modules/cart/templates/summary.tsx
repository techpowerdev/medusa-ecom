"use client"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import DiscountCode from "@modules/checkout/components/discount-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { checkoutStep } from "@lib/util/digital-checkout"

type SummaryProps = {
  cart: HttpTypes.StoreCart
}

const Summary = ({ cart }: SummaryProps) => {
  const step = checkoutStep(cart)

  return (
    <div className="flex flex-col gap-y-4">
      <h2
        className="font-semibold text-[2rem] leading-[2.75rem]"
        data-testid="cart-summary-title"
      >
        สรุปคำสั่งซื้อ
      </h2>
      <DiscountCode cart={cart} />
      <Divider />
      <CartTotals totals={cart} />
      <LocalizedClientLink
        href={"/checkout?step=" + step}
        className={cn(buttonVariants(), "w-full")}
        data-testid="checkout-button"
      >
        ไปชำระเงิน
      </LocalizedClientLink>
    </div>
  )
}

export default Summary
