import { useState, type FormEvent } from 'react'
import { FileText, Loader2, ShieldCheck, Upload } from 'lucide-react'
import { useDocuments, useUploadDocument } from '@/hooks/useApi'
import { useAuthStore } from '@/store/authStore'
import { useSound } from '@/hooks/useSound'
import { ApiError } from '@/lib/apiClient'
import { bytes, dateTime } from '@/lib/format'
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Panel } from '@/components/ui'

const CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']
const ACCEPT = '.pdf,.txt,.md,.png,.jpg,.jpeg'

const CLASS_TONE: Record<string, 'ok' | 'warn' | 'crit' | 'info' | 'muted'> = {
  PUBLIC: 'ok',
  INTERNAL: 'info',
  CONFIDENTIAL: 'warn',
  RESTRICTED: 'crit',
}

export default function DocumentsPage() {
  const canUpload = useAuthStore((s) => s.permissions.includes('documents:upload'))
  const documents = useDocuments()
  const upload = useUploadDocument()
  const { play } = useSound()

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [classification, setClassification] = useState('INTERNAL')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) return
    setError(null)
    setOk(null)
    play('toggle')
    try {
      const doc = await upload.mutateAsync({ file, title: title.trim(), classification })
      setOk(`${doc.doc_id} indexed — OCR complete, chunks embedded into the local vector store.`)
      setFile(null)
      setTitle('')
      play('hydraulic')
    } catch (err) {
      play('denied')
      setError(err instanceof ApiError ? err.detail : 'Upload failed.')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Document intelligence"
        subtitle="Local OCR, chunking and embedding — documents never leave the workstation"
        right={documents.data && <Badge severity="info">{documents.data.length} indexed</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-1" title="Upload &amp; index" subtitle={`Allowed: ${ACCEPT.replace(/\./g, '')} · max 15 MB`}>
          {!canUpload ? (
            <EmptyState
              label="Upload requires documents:upload"
              hint="Your role can read the indexed corpus but cannot add to it."
              icon={<ShieldCheck className="h-6 w-6" />}
            />
          ) : (
            <form className="space-y-3.5" onSubmit={submit}>
              <div>
                <label className="label-xs" htmlFor="doc-file">
                  File
                </label>
                <input
                  id="doc-file"
                  type="file"
                  accept={ACCEPT}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    setFile(f)
                    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''))
                  }}
                  className="mt-1.5 block w-full text-xs text-muted file:mr-3 file:min-h-[44px] file:cursor-pointer
                    file:rounded-ctl file:border file:border-hairline file:bg-raised file:px-4 file:text-xs file:text-ink
                    hover:file:border-accent/50"
                />
                {file && (
                  <p className="tnum mt-1.5 text-[11px] text-muted">
                    {file.name} · {bytes(file.size)}
                  </p>
                )}
              </div>

              <div>
                <label className="label-xs" htmlFor="doc-title">
                  Title
                </label>
                <input
                  id="doc-title"
                  className="field mt-1.5"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Defaults to the filename"
                />
              </div>

              <div>
                <label className="label-xs" htmlFor="doc-class">
                  Classification
                </label>
                <select
                  id="doc-class"
                  className="field mt-1.5"
                  value={classification}
                  onChange={(e) => setClassification(e.target.value)}
                >
                  {CLASSIFICATIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-muted">
                  Retrieval filters chunks by classification against the querying role.
                </p>
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={!file || upload.isPending}>
                {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload &amp; index
              </button>

              {error && <p className="rounded-ctl border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{error}</p>}
              {ok && <p className="rounded-ctl border border-ok/40 bg-ok/10 px-3 py-2 text-xs text-ok">{ok}</p>}
            </form>
          )}
        </Panel>

        <Panel className="lg:col-span-2" title="Indexed corpus" bodyClass="p-0">
          {documents.isPending && <Loading label="Loading corpus…" />}
          {documents.isError && <ErrorState error={documents.error} onRetry={() => documents.refetch()} />}
          {documents.data?.length === 0 && (
            <EmptyState label="No documents indexed yet" hint="Upload a manual, SOP or inspection report to seed the RAG index." />
          )}
          {documents.data && documents.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className="label-xs px-4 py-2.5">Document</th>
                    <th className="label-xs px-4 py-2.5">Type</th>
                    <th className="label-xs px-4 py-2.5">Size</th>
                    <th className="label-xs px-4 py-2.5">Classification</th>
                    <th className="label-xs px-4 py-2.5">Uploaded by</th>
                    <th className="label-xs px-4 py-2.5">Indexed</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.data.map((d) => (
                    <tr key={d.doc_id} className="border-b border-hairline/60 last:border-0 hover:bg-raised/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted" />
                          <div className="min-w-0">
                            <div className="truncate text-ink" title={d.title}>
                              {d.title}
                            </div>
                            <div className="tnum truncate text-[10px] text-muted">
                              {d.doc_id} · {d.filename}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="tnum px-4 py-3 text-muted">{d.file_type}</td>
                      <td className="tnum px-4 py-3 text-muted">{bytes(d.file_size_bytes)}</td>
                      <td className="px-4 py-3">
                        <Badge severity={CLASS_TONE[d.classification] ?? 'muted'}>{d.classification}</Badge>
                      </td>
                      <td className="tnum px-4 py-3 text-muted">{d.uploaded_by}</td>
                      <td className="tnum px-4 py-3 text-muted">
                        {d.is_indexed ? dateTime(d.created_at) : 'pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
