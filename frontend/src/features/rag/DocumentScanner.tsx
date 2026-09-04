import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSearch, ScanLine } from 'lucide-react'
import { api } from '@/lib/apiClient'
import { useSettingsStore } from '@/store/settingsStore'
import { num } from '@/lib/format'
import { EmptyState, ErrorState, Loading } from '@/components/ui'
import { locateSnippet } from './snippetMatch'
import type { DocumentCitation, DocumentPagesResponse } from '@/types/api'

/**
 * Showstopper: the neon bounding-box scanner.
 *
 * Renders the locally OCR-extracted page beside the RAG answer and animates a
 * neon box onto the exact span the citation came from. The box is positioned
 * from the real matched text range, not a fixed rectangle.
 */
export default function DocumentScanner({ citation }: { citation: DocumentCitation | null }) {
  const perfMode = useSettingsStore((s) => s.perfMode)
  const lite = perfMode === 'lite'

  const markRef = useRef<HTMLElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [scanning, setScanning] = useState(false)

  const pages = useQuery({
    queryKey: ['document-pages', citation?.doc_id],
    queryFn: () => api.get<DocumentPagesResponse>(`/api/documents/${citation!.doc_id}/pages`),
    enabled: Boolean(citation?.doc_id),
  })

  const page = useMemo(() => {
    if (!pages.data || !citation) return null
    return (
      pages.data.pages.find((p) => p.page_number === citation.page_number) ??
      pages.data.pages[0] ??
      null
    )
  }, [pages.data, citation])

  const match = useMemo(() => {
    if (!page || !citation) return null
    return locateSnippet(page.content, citation.snippet)
  }, [page, citation])

  // Measure the highlighted span so the neon frame can be drawn over it.
  useEffect(() => {
    if (!match || !markRef.current || !pageRef.current) {
      setBox(null)
      return
    }
    const measure = () => {
      const mark = markRef.current
      const container = pageRef.current
      if (!mark || !container) return
      const m = mark.getBoundingClientRect()
      const c = container.getBoundingClientRect()
      setBox({
        top: m.top - c.top + container.scrollTop - 4,
        left: m.left - c.left - 4,
        width: m.width + 8,
        height: m.height + 8,
      })
    }
    measure()
    // Re-measure on resize so the box follows reflowed text on a tablet.
    const observer = new ResizeObserver(measure)
    observer.observe(pageRef.current)
    return () => observer.disconnect()
  }, [match, page])

  // Sweep animation replays whenever a different citation is selected.
  useEffect(() => {
    if (!citation || lite) {
      setScanning(false)
      return
    }
    setScanning(true)
    const id = window.setTimeout(() => setScanning(false), 2600)
    return () => window.clearTimeout(id)
  }, [citation, lite])

  // Bring the highlight into view.
  useEffect(() => {
    if (box && markRef.current) {
      markRef.current.scrollIntoView({ block: 'center', behavior: lite ? 'auto' : 'smooth' })
    }
  }, [box, lite])

  if (!citation) {
    return (
      <EmptyState
        icon={<FileSearch className="h-6 w-6" />}
        label="No citation selected"
        hint="Run a query, then pick a citation to scan the source page."
      />
    )
  }

  if (pages.isPending) return <Loading label="Loading OCR page…" />
  if (pages.isError) return <ErrorState error={pages.error} onRetry={() => pages.refetch()} />
  if (!page) return <EmptyState label="This document has no extracted pages." />

  const before = match ? page.content.slice(0, match.start) : page.content
  const hit = match ? page.content.slice(match.start, match.end) : ''
  const after = match ? page.content.slice(match.end) : ''

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="tnum truncate text-xs text-ink">{pages.data?.title}</span>
        <span className="tnum text-[10px] text-muted">
          page {page.page_number} / {pages.data?.page_count} · {pages.data?.classification}
        </span>
      </div>

      <div
        ref={pageRef}
        className="relative max-h-[46vh] overflow-y-auto rounded-ctl border border-hairline bg-[#0b0e13] p-4
          font-mono text-[11px] leading-relaxed text-muted sm:max-h-[56vh]"
      >
        {/* Scan sweep line, Full mode only */}
        {scanning && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 animate-scan-sweep bg-gradient-to-b from-transparent via-info/20 to-transparent" />
        )}

        <pre className="whitespace-pre-wrap break-words font-mono">
          {before}
          {match && (
            <mark
              ref={markRef}
              className="rounded-[3px] bg-info/20 px-0.5 text-ink"
              style={{ boxShadow: lite ? 'none' : '0 0 10px rgba(34,211,238,0.35)' }}
            >
              {hit}
            </mark>
          )}
          {after}
        </pre>

        {/* Neon bounding box drawn over the measured span */}
        {box && (
          <div
            className={`pointer-events-none absolute z-20 rounded-[5px] border-2 border-info ${
              lite ? '' : 'animate-node-pulse'
            }`}
            style={{
              top: box.top,
              left: box.left,
              width: box.width,
              height: box.height,
              boxShadow: lite ? 'none' : '0 0 14px rgba(34,211,238,0.65), inset 0 0 10px rgba(34,211,238,0.2)',
              color: '#22d3ee',
            }}
          >
            <span
              className={`absolute left-2 whitespace-nowrap rounded-full border border-info/60 bg-[#0b1416] px-2 py-0.5 text-[9px] text-info ${
                // Flip below the box when there is no room above it.
                box.top < 22 ? 'top-full mt-1' : '-top-2 -translate-y-full'
              }`}
            >
              <ScanLine className="mr-1 inline h-2.5 w-2.5" />
              Extracted via local OCR — relevance: {num(citation.relevance_score, 2)}
            </span>
          </div>
        )}
      </div>

      {!match && (
        <p className="mt-2 rounded-ctl border border-warn/40 bg-warn/5 px-3 py-2 text-[11px] text-warn">
          The cited snippet could not be located verbatim on this page (the chunker re-flows whitespace). Showing the
          full extracted page instead.
        </p>
      )}
      {match && !match.exact && (
        <p className="mt-2 text-[11px] text-muted">Anchored on the longest matching prefix of the citation snippet.</p>
      )}
    </div>
  )
}
