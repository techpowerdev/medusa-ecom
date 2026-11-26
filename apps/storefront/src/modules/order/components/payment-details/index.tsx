import { isStripeLike, paymentInfoMap } from "@lib/constants"
import Divider from "@modules/common/components/divider"
import { convertToLocale } from "@lib/util/money"
import { formatDateTime } from "@lib/util/date"
import { HttpTypes } from "@medusajs/types"

type PaymentDetailsProps = {
  order: HttpTypes.StoreOrder
}

const PaymentDetails = ({ order }: PaymentDetailsProps) => {
  const payment = order.payment_collections?.[0].payments?.[0]

  return (
    <div>
      <h2
        className="flex flex-row text-2xl font-semibold my-6"
        data-testid="payment-details-heading"
      >
        การชำระเงิน
      </h2>
      <div>
        {payment && (
          <div className="flex items-start gap-x-1 w-full">
            <div className="flex flex-col w-1/3">
              <p className="text-sm leading-[1.4rem] font-medium text-foreground mb-1">
                วิธีชำระเงิน
              </p>
              <p
                className="text-sm leading-[1.4rem] text-muted-foreground"
                data-testid="payment-method"
              >
                {paymentInfoMap[payment.provider_id].title}
              </p>
            </div>
            <div className="flex flex-col w-2/3">
              <p className="text-sm leading-[1.4rem] font-medium text-foreground mb-1">
                รายละเอียดการชำระเงิน
              </p>
              <div className="flex gap-2 text-sm leading-[1.4rem] text-muted-foreground items-center">
                <div className="rounded-lg flex items-center h-7 w-fit p-2 bg-muted">
                  {paymentInfoMap[payment.provider_id].icon}
                </div>
                <p className="text-sm leading-[1.4rem]" data-testid="payment-amount">
                  {isStripeLike(payment.provider_id) && payment.data?.card_last4
                    ? `**** **** **** ${payment.data.card_last4}`
                    : `${convertToLocale({
                        amount: payment.amount,
                        currency_code: order.currency_code,
                      })}${
                        // review #102: ไม่มี created_at → ไม่แสดงเวลา (Intl.DateTimeFormat throw RangeError กับวันที่ไม่ถูกต้อง)
                        payment.created_at
                          ? ` ชำระเมื่อ ${formatDateTime(payment.created_at)}`
                          : ""
                      }`}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <Divider className="mt-8" />
    </div>
  )
}

export default PaymentDetails
