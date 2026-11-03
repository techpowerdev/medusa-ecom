import type { FlashSale } from "@lib/util/flash-sale"
import CampaignCountdown from "./campaign-countdown"

/** GB-7c (spec 04 กฎข้อ 29a): การ์ดแคมเปญ flash บนหน้าแรก — ชื่อ/banner/นับถอยหลังจาก FS-4 */
export default function FlashCampaignCard({ sale, now }: { sale: FlashSale; now: number }) {
  return (
    <li
      className="flex flex-col gap-y-2 rounded-rounded border border-ui-fg-interactive p-4"
      data-testid="flash-campaign-card"
      data-campaign-id={sale.id}
    >
      <span className="text-small-regular text-ui-fg-interactive">แฟลชเซล</span>
      <h3 className="text-base-semi break-words">{sale.name}</h3>
      <p className="text-small-regular break-words">{sale.banner_text || "ราคาพิเศษช่วงเวลาจำกัด"}</p>
      {sale.show_countdown && <CampaignCountdown endsAt={sale.ends_at} now={now} testId="flash-campaign-countdown" />}
      {sale.sold_out ? (
        <p className="text-small-regular text-ui-fg-error">สินค้าหมดแล้ว</p>
      ) : (
        sale.show_remaining &&
        sale.remaining_units != null && <p className="text-small-regular">เหลือ {sale.remaining_units} ชิ้น</p>
      )}
    </li>
  )
}
