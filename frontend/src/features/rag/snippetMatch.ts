/**
 * Locates a citation snippet inside the OCR text of a page.
 *
 * The backend returns a snippet, not coordinates, so the scanner anchors its
 * neon box to the matched character span. Snippets are often elided
 * ("…bearing wear…") or re-whitespaced by the chunker, so matching walks down
 * from the full string to a shorter distinctive prefix before giving up.
 */
export interface SnippetMatch {
  start: number
  end: number
  /** False when only a shortened prefix of the snippet could be located. */
  exact: boolean
}

const MIN_MATCH_CHARS = 18

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function locateSnippet(pageText: string, snippet: string): SnippetMatch | null {
  if (!pageText || !snippet) return null

  // Compare on a whitespace-normalized copy, then map the offset back.
  const map: number[] = []
  let normalized = ''
  let prevWasSpace = false

  for (let i = 0; i < pageText.length; i += 1) {
    const ch = pageText[i]
    if (/\s/.test(ch)) {
      if (prevWasSpace || normalized.length === 0) continue
      normalized += ' '
      map.push(i)
      prevWasSpace = true
    } else {
      normalized += ch
      map.push(i)
      prevWasSpace = false
    }
  }

  const haystack = normalized.toLowerCase()
  const needleFull = normalizeWhitespace(snippet.replace(/^[.…\s]+|[.…\s]+$/g, '')).toLowerCase()
  if (!needleFull) return null

  const attempt = (needle: string): number => (needle.length >= MIN_MATCH_CHARS ? haystack.indexOf(needle) : -1)

  let needle = needleFull
  let index = attempt(needle)
  let exact = index !== -1

  // Progressively trim trailing words until a distinctive prefix matches.
  while (index === -1 && needle.length > MIN_MATCH_CHARS) {
    const cut = needle.lastIndexOf(' ')
    if (cut < MIN_MATCH_CHARS) break
    needle = needle.slice(0, cut)
    index = attempt(needle)
  }

  if (index === -1) return null

  const start = map[index] ?? 0
  const endIndex = Math.min(index + needle.length - 1, map.length - 1)
  const end = (map[endIndex] ?? start) + 1

  return { start, end, exact }
}
