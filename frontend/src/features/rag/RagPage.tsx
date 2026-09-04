import { useState, type FormEvent } from 'react'
import { Loader2, ScanSearch, Search } from 'lucide-react'
import { api, ApiError } from '@/lib/apiClient'
import { useSound } from '@/hooks/useSound'
import { num } from '@/lib/format'
import { Badge, EmptyState, PageHeader, Panel } from '@/components/ui'
import Markdown from '@/components/Markdown'
import DocumentScanner from './DocumentScanner'
import type { DocumentCitation, RAGQueryResponse } from '@/types/api'

export default function RagPage() {
  const { play } = useSound()
  const [query, setQuery] = useState('')
  const [topK, setTopK] = useState(4)
  const [minScore, setMinScore] = useState(0.35)
  const [result, setResult] = useState<RAGQueryResponse | null>(null)
  const [selected, setSelected] = useState<DocumentCitation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setBusy(true)
    setError(null)
    play('click')
    try {
      const res = await api.post<RAGQueryResponse>('/api/rag/query', { query: q, top_k: topK, min_score: minScore })
      setResult(res)
      setSelected(res.citations[0] ?? null)
    } catch (err) {
      play('denied')
      setError(err instanceof ApiError ? err.detail : 'Retrieval failed.')
      setResult(null)
      setSelected(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Document scanner"
        subtitle="Private hybrid retrieval over locally OCR'd manuals — the answer and its source page, side by side"
        right={result && <Badge severity="info">{result.retrieval_method}</Badge>}
      />

      <Panel bodyClass="p-3 sm:p-4">
        <form onSubmit={run} className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="field flex-1"
              placeholder="e.g. What is the spindle bearing lubrication interval?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary sm:w-auto" disabled={busy || !query.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Query
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="flex items-baseline justify-between">
                <label className="label-xs" htmlFor="top-k">
                  Top K
                </label>
                <span className="tnum text-xs text-accent">{topK}</span>
              </div>
              <input
                id="top-k"
                type="range"
                min={1}
                max={10}
                step={1}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="mt-1.5 h-11 w-full cursor-pointer accent-[#f5a623]"
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label className="label-xs" htmlFor="min-score">
                  Minimum relevance
                </label>
                <span className="tnum text-xs text-accent">{minScore.toFixed(2)}</span>
              </div>
              <input
                id="min-score"
                type="range"
                min={0}
                max={0.95}
                step={0.05}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="mt-1.5 h-11 w-full cursor-pointer accent-[#f5a623]"
              />
            </div>
          </div>

          {error && <p className="rounded-ctl border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{error}</p>}
        </form>
      </Panel>

      {/* Split view: source page on the left, answer on the right; stacks on mobile. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Source page" subtitle="Neon box marks the cited region" bodyClass="p-3 sm:p-4">
          <DocumentScanner citation={selected} />
        </Panel>

        <div className="space-y-4">
          <Panel title="Answer" subtitle={result ? `Classification checked: ${result.classification_checked}` : undefined}>
            {!result && !busy && (
              <EmptyState
                icon={<ScanSearch className="h-6 w-6" />}
                label="No query run yet"
                hint="Ask a question about the indexed manuals and SOPs."
              />
            )}
            {busy && (
              <div className="flex items-center gap-2 py-8 text-xs text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Retrieving and synthesizing locally…
              </div>
            )}
            {result && !busy && <Markdown>{result.answer}</Markdown>}
          </Panel>

          {result && (
            <Panel title="Citations" subtitle={`${result.citations.length} passages above the score floor`} bodyClass="p-3">
              {result.citations.length === 0 ? (
                <EmptyState
                  label="No passage cleared the relevance floor"
                  hint="Lower the minimum relevance or upload the relevant manual."
                />
              ) : (
                <ul className="space-y-2">
                  {result.citations.map((c, i) => {
                    const active = selected?.doc_id === c.doc_id && selected?.page_number === c.page_number && selected?.snippet === c.snippet
                    return (
                      <li key={`${c.doc_id}-${c.page_number}-${i}`}>
                        <button
                          type="button"
                          onClick={() => {
                            play('click')
                            setSelected(c)
                          }}
                          className={`w-full rounded-ctl border px-3 py-2.5 text-left transition-colors ${
                            active ? 'border-info/60 bg-info/5' : 'border-hairline bg-raised hover:border-info/40'
                          }`}
                        >
                          <div className="flex items-baseline gap-2">
                            <span className="min-w-0 flex-1 truncate text-xs text-ink">{c.title}</span>
                            <span className="tnum shrink-0 text-[10px] text-info">{num(c.relevance_score, 2)}</span>
                          </div>
                          <div className="tnum mt-0.5 text-[10px] text-muted">
                            {c.doc_id} · page {c.page_number}
                          </div>
                          <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-muted">{c.snippet}</p>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
