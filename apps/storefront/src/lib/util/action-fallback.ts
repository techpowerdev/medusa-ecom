import { unstable_rethrow } from "next/navigation"

export const SAVE_FAILED_MESSAGE = "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"

/**
 * CORE-23c (spec 01 กฎข้อ 74a/b): เรียก server action ที่ล้มระดับ network/5xx → promise ฝั่ง client reject
 * แล้ว `useActionState` โยนเข้า error boundary ("This page couldn't load") — ห่อ action ให้คืนผล error ไทยแทน
 * ให้ฟอร์มแสดง error ในฟอร์มเอง; redirect/notFound ของ Next ส่งต่อตามเดิม
 */
export function withActionFallback<S, R extends { success: boolean; error: string | null }>(
  action: (state: S, formData: FormData) => Promise<R>
) {
  return async (state: S, formData: FormData): Promise<R | { success: false; error: string }> => {
    try {
      return await action(state, formData)
    } catch (error) {
      unstable_rethrow(error)
      console.error(error)
      return { success: false, error: SAVE_FAILED_MESSAGE }
    }
  }
}
