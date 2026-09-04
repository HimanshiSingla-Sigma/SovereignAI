import { Fragment, type ReactNode } from 'react'

/**
 * Minimal Markdown renderer for model output.
 *
 * The local gateway emits Markdown (headings, bold, lists, code spans) and
 * showing the raw asterisks reads as broken. This builds React elements
 * directly — no HTML injection, no parser dependency, nothing to fetch — which
 * is what an air-gapped bundle needs.
 *
 * Supported: #/##/### headings, **bold**, *italic*, `code`, "- " and "* "
 * bullets, "1." ordered lists, and blank-line-separated paragraphs.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // One pass over bold / italic / code, longest marker first.
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g
  let last = 0
  let match: RegExpExecArray | null
  let i = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${i++}`

    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-[#0b0e13] px-1 py-0.5 font-mono text-[0.92em] text-accent">
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      )
    }
    last = match.index + token.length
  }

  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

interface Block {
  type: 'h' | 'p' | 'ul' | 'ol'
  level?: number
  lines: string[]
}

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = []
  const lines = source.replace(/\r\n/g, '\n').split('\n')

  for (const raw of lines) {
    const line = raw.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      blocks.push({ type: 'p', lines: [] }) // paragraph break marker
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed)
    if (heading) {
      blocks.push({ type: 'h', level: heading[1].length, lines: [heading[2]] })
      continue
    }

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed)
    if (bullet) {
      const prev = blocks[blocks.length - 1]
      if (prev?.type === 'ul') prev.lines.push(bullet[1])
      else blocks.push({ type: 'ul', lines: [bullet[1]] })
      continue
    }

    const ordered = /^\d+[.)]\s+(.*)$/.exec(trimmed)
    if (ordered) {
      const prev = blocks[blocks.length - 1]
      if (prev?.type === 'ol') prev.lines.push(ordered[1])
      else blocks.push({ type: 'ol', lines: [ordered[1]] })
      continue
    }

    const prev = blocks[blocks.length - 1]
    if (prev?.type === 'p' && prev.lines.length > 0) prev.lines.push(trimmed)
    else blocks.push({ type: 'p', lines: [trimmed] })
  }

  return blocks.filter((b) => b.lines.length > 0)
}

export default function Markdown({ children, className = '' }: { children: string; className?: string }) {
  const blocks = parseBlocks(children ?? '')

  return (
    <div className={`space-y-2.5 text-sm leading-relaxed text-ink ${className}`}>
      {blocks.map((block, i) => {
        const key = `b-${i}`
        if (block.type === 'h') {
          const size = block.level === 1 ? 'text-base' : block.level === 2 ? 'text-sm' : 'text-xs'
          return (
            <h3 key={key} className={`${size} font-semibold text-accent`}>
              {renderInline(block.lines[0], key)}
            </h3>
          )
        }
        if (block.type === 'ul') {
          return (
            <ul key={key} className="space-y-1.5 pl-1">
              {block.lines.map((line, j) => (
                <li key={`${key}-${j}`} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted" />
                  <span className="min-w-0">{renderInline(line, `${key}-${j}`)}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (block.type === 'ol') {
          return (
            <ol key={key} className="space-y-1.5 pl-1">
              {block.lines.map((line, j) => (
                <li key={`${key}-${j}`} className="flex gap-2">
                  <span className="tnum shrink-0 text-muted">{j + 1}.</span>
                  <span className="min-w-0">{renderInline(line, `${key}-${j}`)}</span>
                </li>
              ))}
            </ol>
          )
        }
        return (
          <p key={key}>
            {block.lines.map((line, j) => (
              <Fragment key={`${key}-${j}`}>
                {j > 0 && ' '}
                {renderInline(line, `${key}-${j}`)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
