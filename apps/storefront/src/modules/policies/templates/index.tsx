import { STORE_CONTENT } from "@lib/store-content"
import { convertToLocale } from "@lib/util/money"
import { formatDayRange, StorePolicies } from "@lib/util/store-policies"

export const formatShippingRate = (rate: number, currencyCode: string) =>
  rate === 0 ? "ฟรี" : convertToLocale({ amount: rate, currency_code: currencyCode })

export const PolicyPage = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <div className="content-container py-12 max-w-3xl" data-testid="policy-page">
    <h1 className="text-2xl-semi mb-8" data-testid="policy-title">
      {title}
    </h1>
    <div
      className="flex flex-col gap-6 text-base-regular text-ui-fg-base"
      data-testid="policy-content"
    >
      {children}
    </div>
  </div>
)

export const PoliciesUnavailable = () => (
  <p className="text-ui-fg-subtle">
    ยังไม่ได้เผยแพร่รายละเอียดนโยบายสำหรับภูมิภาคนี้
  </p>
)

export const ShippingSummary = ({
  policies,
  currencyCode,
}: {
  policies: StorePolicies
  currencyCode: string
}) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
    <dt className="text-ui-fg-subtle">ค่าจัดส่ง</dt>
    <dd>{formatShippingRate(policies.shippingRate, currencyCode)}</dd>
    <dt className="text-ui-fg-subtle">ระยะเวลาเตรียมสินค้า</dt>
    <dd>{formatDayRange(policies.handlingDays)} วันทำการ</dd>
    <dt className="text-ui-fg-subtle">ระยะเวลาขนส่ง</dt>
    <dd>{formatDayRange(policies.transitDays)} วันทำการหลังส่งออก</dd>
  </dl>
)

export const PlaceholderNotice = () => (
  <p className="text-ui-fg-subtle" data-testid="policy-placeholder">
    {STORE_CONTENT.policyPlaceholderNotice}
  </p>
)
