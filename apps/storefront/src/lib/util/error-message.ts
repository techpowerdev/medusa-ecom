// spec 01 กฎข้อ 45: ข้อความ error ที่ผู้ใช้เห็นใช้ `error.message` — `String(error)` จะได้คำนำหน้า "Error: "
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)
