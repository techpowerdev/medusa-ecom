import { Button, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { evoucherApi, evoucherKeys, ImportResult } from "../../lib/evoucher"
import { createSingleFlight } from "../../lib/single-flight"
import { Container } from "../common/container"
import { Header } from "../common/header"

// import CSV `code,pin?,expires_at?` → แสดงสรุปจำนวนที่เพิ่ม / ข้ามเพราะซ้ำ (AC-1)
export const ImportCodes = ({ poolId }: { poolId: string }) => {
  const { t } = useTranslation("ecom-evoucher")
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  // กฎ 43 (ADM-39): สำเร็จแล้ว hold จนเลือกไฟล์ใหม่ (release) — คลิกซ้ำหลัง response ไม่ import ไฟล์เดิมซ้ำ
  const [importOnce] = useState(createSingleFlight)

  const upload = useMutation({
    mutationFn: (f: File) => evoucherApi.importCodes(poolId, f),
    onSuccess: (res) => {
      setResult(res)
      setFile(null)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
      queryClient.invalidateQueries({ queryKey: evoucherKeys.pool(poolId) })
      queryClient.invalidateQueries({ queryKey: evoucherKeys.codes(poolId) })
      queryClient.invalidateQueries({ queryKey: evoucherKeys.pools })
      toast.success(t("import.toast", { inserted: res.inserted }))
    },
    onError: (e: Error) => {
      setResult(null)
      toast.error(e.message)
    },
  })

  return (
    <Container>
      <Header
        title={t("import.title")}
        subtitle={t("import.subtitle")}
      />
      <div className="flex items-center gap-x-3 px-6 py-4">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label={t("import.fileLabel")}
          className="txt-compact-small text-ui-fg-subtle"
          onChange={(e) => {
            importOnce.release()
            setFile(e.target.files?.[0] ?? null)
          }}
        />
        <Button
          size="small"
          disabled={!file}
          isLoading={upload.isPending}
          onClick={() => file && importOnce(() => upload.mutateAsync(file).then(importOnce.hold, () => undefined))}
        >
          {t("import.submit")}
        </Button>
      </div>
      {result && (
        <div className="flex flex-col gap-y-1 px-6 py-4" data-testid="evoucher-import-result">
          <Text size="small" leading="compact" weight="plus">
            {t("import.result", { inserted: result.inserted, skipped: result.skipped_duplicates })}
          </Text>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            {t("import.batch", { batch: result.batch_ref })}
          </Text>
        </div>
      )}
    </Container>
  )
}
