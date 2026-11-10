/**
 * `alternates.languages` ของหน้าที่มีหลายประเทศ (หน้าแรก, PDP) — เนื้อหาเป็นภาษาไทยทุกประเทศ (ADR-014)
 * จึงประกาศเป็น `th-<CC>` ชี้ไปที่ `/<cc><path>`
 */
export const hreflangAlternates = (
  origin: string,
  countryCodes: string[],
  path = ""
): Record<string, string> =>
  Object.fromEntries(
    countryCodes.map((code) => [
      `th-${code.toUpperCase()}`,
      `${origin}/${code}${path}`,
    ])
  )
