import { useTranslation } from "react-i18next"

/**
 * AI18N-N2 (spec 10 กฎ 6): ข้อความแถบแบ่งหน้าของ `DataTable.Pagination` (@medusajs/ui) สำหรับ prop `translations` —
 * ไม่ส่ง = ค่าเริ่มต้นภาษาอังกฤษ ("of"/"results"/"pages"/"Prev"/"Next") ทุกภาษา ใช้ key ของ Medusa ชุดเดียวกับที่ `DataTable` ของ
 * `@medusajs/dashboard` ส่งเอง (dashboard ไม่ export ชุดนี้) ค่า `en` เท่าค่าเริ่มต้นเดิม; `translations` แทนทั้ง object จึงต้องครบ 5 ค่า
 */
export const usePaginationTranslations = () => {
  const { t } = useTranslation("ecom-common")
  return {
    of: t("general.of", { ns: "translation" }),
    results: t("general.results", { ns: "translation" }),
    pages: t("general.pages", { ns: "translation" }),
    prev: t("general.prev", { ns: "translation" }),
    next: t("general.next", { ns: "translation" }),
  }
}
