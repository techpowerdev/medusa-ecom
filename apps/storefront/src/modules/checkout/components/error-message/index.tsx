// SFUI-12b (spec 09 กฎ 32d): `id` ไม่บังคับ — ให้ช่องที่เกี่ยวข้องอ้างด้วย aria-describedby (promotion-error)
const ErrorMessage = ({ error, id, 'data-testid': dataTestid }: { error?: string | null, id?: string, 'data-testid'?: string }) => {
  if (!error) {
    return null
  }

  return (
    <div id={id} className="pt-2 text-rose-500 text-xs leading-5 font-normal" data-testid={dataTestid}>
      <span>{error}</span>
    </div>
  )
}

export default ErrorMessage
