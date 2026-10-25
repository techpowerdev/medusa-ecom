import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { evoucherApi, evoucherKeys, ImportResult } from "../../lib/evoucher"

// import CSV `code,pin?,expires_at?` → แสดงสรุปจำนวนที่เพิ่ม / ข้ามเพราะซ้ำ (AC-1)
export const ImportCodes = ({ poolId }: { poolId: string }) => {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

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
      toast.success(`Imported ${res.inserted} codes`)
    },
    onError: (e: Error) => {
      setResult(null)
      toast.error(e.message)
    },
  })

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-y-1 px-6 py-4">
        <Heading level="h2">Import codes</Heading>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          CSV columns: code, pin (optional), expires_at (optional, YYYY-MM-DD). Duplicates are skipped.
        </Text>
      </div>
      <div className="flex items-center gap-x-3 px-6 py-4">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          className="txt-compact-small text-ui-fg-subtle"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button
          size="small"
          disabled={!file}
          isLoading={upload.isPending}
          onClick={() => file && upload.mutate(file)}
        >
          Import
        </Button>
      </div>
      {result && (
        <div className="flex flex-col gap-y-1 px-6 py-4" data-testid="evoucher-import-result">
          <Text size="small" leading="compact" weight="plus">
            Imported {result.inserted} codes, skipped {result.skipped_duplicates} duplicates
          </Text>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Batch {result.batch_ref}
          </Text>
        </div>
      )}
    </Container>
  )
}
