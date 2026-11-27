type AddressParts = {
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
}

/**
 * SFUI-18a (spec 09 กฎ 57): สรุปที่อยู่ตามลำดับไทย — [ "<บ้านเลขที่…> <ตำบล/แขวง> <เขต/อำเภอ> <จังหวัด> <รหัสไปรษณีย์>", "<COUNTRY>" ]
 * ช่องที่ว่าง/null/ช่องว่างล้วนถูกข้าม (ไม่มีจุลภาคหรือช่องว่างซ้อน) — ที่อยู่เดิมที่ไม่มี `address_2` แสดงได้
 */
export function addressLines(address?: AddressParts | null): [string, string] {
  const line = [address?.address_1, address?.address_2, address?.city, address?.province, address?.postal_code]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
  return [line, address?.country_code?.toUpperCase() ?? ""]
}
