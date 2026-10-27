import { CustomerEvoucher } from "@lib/util/evoucher"
import { formatDate } from "@lib/util/date"
import VoucherCopyButton from "@modules/evoucher/components/voucher-copy-button"

/** EV-7b (spec 02 AC-6, AC-36): บัตรกำนัลหนึ่งใบของลูกค้าเจ้าของ — แสดงเฉพาะบนหน้า /account/vouchers */
export default function VoucherCard({ voucher }: { voucher: CustomerEvoucher }) {
  const { partner, pool } = voucher

  return (
    <li
      className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-4 text-small-regular"
      data-testid="voucher-card"
    >
      <div className="flex flex-col">
        <span className="text-base-semi" data-testid="voucher-partner-name">
          {partner.name}
        </span>
        <span className="text-ui-fg-subtle">{pool.name}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-ui-fg-muted">รหัส</span>
        <code className="break-all font-mono text-base-semi" data-testid="voucher-code">
          {voucher.code}
        </code>
        <VoucherCopyButton code={voucher.code} />
      </div>
      {voucher.pin && (
        <div className="flex gap-x-3">
          <span className="text-ui-fg-muted">รหัสลับ</span>
          <code className="font-mono" data-testid="voucher-pin">
            {voucher.pin}
          </code>
        </div>
      )}
      <div className="flex gap-x-3" data-testid="voucher-expires-at">
        <span className="text-ui-fg-muted">หมดอายุ</span>
        <span>{voucher.expires_at ? formatDate(voucher.expires_at) : "ไม่มีวันหมดอายุ"}</span>
      </div>
      <details>
        <summary className="cursor-pointer">วิธีใช้</summary>
        <p className="mt-2 whitespace-pre-line">{pool.how_to_use}</p>
        {pool.validity_note && <p className="mt-2">{pool.validity_note}</p>}
      </details>
    </li>
  )
}
